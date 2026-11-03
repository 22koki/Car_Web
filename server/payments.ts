import { equalSecret, HttpError } from './security-core.ts';
import { base64, hmacBytes } from './crypto.ts';
import { getSettings, paymentsConfigured, requireReceipt } from './dealership.ts';
import { object, text } from './validation.ts';
import type { DealerEnvironment, EnquiryRow, PaymentRow, SqlDatabase, VehicleRow } from './types.ts';

type GatewayFetch = (input: string, init?: RequestInit) => Promise<Response>;
const GATEWAY = 'https://api.flutterwave.com/v3';
const CHECKOUT_MINUTES = 15;
const isoNow = () => new Date().toISOString();
const referencePattern = /^velpay_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function paymentReference(value: unknown): string {
  const reference = text(value, 'Payment reference', 80, true);
  if (!referencePattern.test(reference)) throw new HttpError(400, 'Enter a valid payment reference.', 'invalid_payment_reference');
  return reference;
}

async function getPayment(db: SqlDatabase, reference: string): Promise<PaymentRow> {
  const payment = await db.prepare('SELECT * FROM payments WHERE reference=?').bind(reference).first<PaymentRow>();
  if (!payment) throw new HttpError(404, 'This payment reference was not found.', 'payment_not_found');
  return payment;
}

function safeStatus(payment: PaymentRow, timestamp = isoNow()) {
  const status = ['initiating','pending'].includes(payment.status) && payment.expires_at <= timestamp ? 'expired' : payment.status;
  const messages: Record<string, string> = {
    initiating: 'Your checkout is being prepared. No payment has been verified yet.',
    pending: 'Your payment has not been verified yet. If you completed checkout, check again in a moment.',
    paid: 'Your deposit has been verified and the vehicle is reserved. Keep this reference for the dealership team.',
    review: 'Your payment has been verified, but the vehicle could not be reserved automatically. Contact the dealership with this reference so the team can resolve it.',
    failed: 'This checkout could not be prepared. No payment has been verified for this reference.',
    expired: 'This checkout window has expired. If you completed payment, check again or contact the dealership with this reference.',
  };
  return { reference: payment.reference, status, amountKES: payment.amount_kes, currency: 'KES' as const, message: messages[status] };
}

export async function paymentStatus(db: SqlDatabase, reference: unknown, timestamp = isoNow()) {
  return safeStatus(await getPayment(db, paymentReference(reference)), timestamp);
}

async function boundedGatewayJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.body) throw new HttpError(502, 'The payment provider returned an incomplete response. Please try verification again.', 'payment_provider_response');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new HttpError(502, 'The payment provider response could not be processed.', 'payment_provider_response'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not_object');
    return value as Record<string, unknown>;
  } catch { throw new HttpError(502, 'The payment provider response could not be processed.', 'payment_provider_response'); }
}

async function gatewayRequest(environment: DealerEnvironment, path: string, init: RequestInit, fetcher: GatewayFetch): Promise<Response> {
  if (!environment.FLW_SECRET_KEY || environment.FLW_SECRET_KEY.length < 20) throw new HttpError(503, 'Online deposits are not configured yet. Your enquiry is saved; the dealership can arrange the next step.', 'payments_unavailable');
  try {
    return await fetcher(`${GATEWAY}${path}`, { ...init, redirect: 'error', headers: { 'Authorization': `Bearer ${environment.FLW_SECRET_KEY}`, 'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new HttpError(503, 'We could not reach the payment provider. Keep your reference and check again shortly.', 'payment_provider_unavailable');
  }
}

async function failCheckout(db: SqlDatabase, id: string, vehicleId: string, timestamp: string) {
  await db.batch([
    db.prepare("UPDATE payments SET status='failed',updated_at=? WHERE id=? AND status='initiating'").bind(timestamp, id),
    db.prepare("UPDATE vehicles SET payment_hold_id=NULL,hold_expires_at=NULL WHERE id=? AND payment_hold_id=? AND EXISTS (SELECT 1 FROM payments WHERE id=? AND status='failed')").bind(vehicleId, id, id),
  ]);
}

/** The receipt authorizes only its own enquiry. No amount, currency or car details come from the browser. */
export async function createCheckout(db: SqlDatabase, environment: DealerEnvironment, input: unknown, fetcher: GatewayFetch = fetch, timestamp = isoNow()) {
  const value = object(input); const enquiry = await requireReceipt(db, value.enquiryId, value.receiptToken);
  if (enquiry.is_demo) throw new HttpError(409, 'Demo vehicles cannot accept payments. Ask the dealership about live stock.', 'demo_payment_disabled');
  if (enquiry.request_type !== 'reservation' || !enquiry.vehicle_id) throw new HttpError(400, 'Create a reservation enquiry for a vehicle before opening checkout.', 'reservation_required');
  const settings = await getSettings(db);
  if (!paymentsConfigured(environment, settings.depositKES)) throw new HttpError(503, 'Online deposits are not configured yet. Your enquiry is saved; the dealership can arrange the next step.', 'payments_unavailable');
  // Inspect all verified payments, including older attempts, before reusing a newer pending checkout.
  const verified = await db.prepare("SELECT status FROM payments WHERE enquiry_id=? AND status IN ('paid','review') ORDER BY created_at DESC LIMIT 1").bind(enquiry.id).first<{ status: string }>();
  if (verified?.status === 'paid') throw new HttpError(409, 'A verified deposit is already attached to this enquiry.', 'already_paid');
  if (verified) throw new HttpError(409, 'A payment for this enquiry is being reviewed. Contact the dealership before making another payment.', 'payment_under_review');
  if (!['new','contacted'].includes(enquiry.status)) throw new HttpError(409, 'This enquiry cannot accept a new deposit. Contact the dealership for assistance.', 'enquiry_unavailable');
  const previous = await db.prepare("SELECT * FROM payments WHERE enquiry_id=? AND status IN ('initiating','pending') ORDER BY created_at DESC LIMIT 1").bind(enquiry.id).first<PaymentRow>();
  if (previous && previous.expires_at > timestamp) {
    const reusable = await db.prepare("SELECT p.* FROM payments p JOIN enquiries e ON e.id=p.enquiry_id JOIN vehicles v ON v.id=p.vehicle_id WHERE p.id=? AND p.status='pending' AND p.expires_at>? AND e.status IN ('new','contacted') AND v.status='available' AND v.is_demo=0 AND v.payment_hold_id=p.id AND NOT EXISTS (SELECT 1 FROM payments other WHERE other.enquiry_id=p.enquiry_id AND other.status IN ('paid','review'))")
      .bind(previous.id, timestamp).first<PaymentRow>();
    if (reusable?.checkout_url) return { checkoutUrl: reusable.checkout_url, reference: reusable.reference };
    if (previous.status === 'pending') throw new HttpError(409, 'This reservation changed while checkout was open. Contact the dealership before making a payment.', 'checkout_state_changed');
    throw new HttpError(409, 'A checkout is already being prepared. Wait a moment before trying again.', 'checkout_in_progress');
  }
  const vehicle = await db.prepare('SELECT * FROM vehicles WHERE id=?').bind(enquiry.vehicle_id).first<VehicleRow>();
  if (!vehicle || vehicle.is_demo || vehicle.status !== 'available' || vehicle.reserved_payment_id) throw new HttpError(409, 'This car is no longer available for an online reservation.', 'vehicle_unavailable');
  const vehiclePrice = Number((JSON.parse(vehicle.data) as { price: unknown }).price);
  if (!Number.isFinite(vehiclePrice) || settings.depositKES > vehiclePrice) throw new HttpError(503, 'The dealership needs to review the deposit amount for this car. Your enquiry is saved.', 'deposit_configuration');
  const id = crypto.randomUUID(); const reference = `velpay_${id}`; const expiresAt = new Date(new Date(timestamp).getTime() + CHECKOUT_MINUTES * 60000).toISOString();
  let results;
  try {
    results = await db.batch([
      db.prepare("UPDATE payments SET status='expired',updated_at=? WHERE vehicle_id=? AND status IN ('initiating','pending') AND expires_at<=?").bind(timestamp, vehicle.id, timestamp),
      db.prepare('UPDATE vehicles SET payment_hold_id=NULL,hold_expires_at=NULL WHERE id=? AND hold_expires_at<=? AND reserved_payment_id IS NULL').bind(vehicle.id, timestamp),
      db.prepare("INSERT INTO payments (id,reference,enquiry_id,vehicle_id,amount_kes,currency,status,expires_at,created_at,updated_at) SELECT ?,?,?,v.id,?,'KES','initiating',?,?,? FROM vehicles v WHERE v.id=? AND v.version=? AND json_extract(v.data,'$.price')=? AND json_extract(v.data,'$.price')>=? AND v.status='available' AND v.is_demo=0 AND v.payment_hold_id IS NULL AND v.reserved_payment_id IS NULL AND EXISTS (SELECT 1 FROM enquiries e WHERE e.id=? AND e.status IN ('new','contacted') AND e.is_demo=0) AND NOT EXISTS (SELECT 1 FROM payments other WHERE other.enquiry_id=? AND other.status IN ('paid','review'))")
        .bind(id, reference, enquiry.id, settings.depositKES, expiresAt, timestamp, timestamp, vehicle.id, vehicle.version, vehiclePrice, settings.depositKES, enquiry.id, enquiry.id),
      db.prepare("UPDATE vehicles SET payment_hold_id=?,hold_expires_at=? WHERE id=? AND EXISTS (SELECT 1 FROM payments WHERE id=? AND status='initiating')").bind(id, expiresAt, vehicle.id, id),
    ]);
  } catch (error) {
    if (error instanceof Error && /unique.*payments\.vehicle_id|payments_one_active_vehicle/i.test(error.message)) throw new HttpError(409, 'Another customer is completing a reservation for this car. Please try again later.', 'vehicle_payment_hold');
    throw error;
  }
  if (!results[2].meta.changes) throw new HttpError(409, 'Another checkout or stock update is in progress for this car. Please try again later.', 'vehicle_payment_hold');
  const redirect = new URL('/payment', environment.SITE_URL); redirect.searchParams.set('reference', reference);
  const response = await gatewayRequest(environment, '/payments', {
    method: 'POST', body: JSON.stringify({ tx_ref: reference, amount: settings.depositKES, currency: 'KES', redirect_url: redirect.href,
      payment_options: 'card,mpesa', customer: { email: enquiry.email, name: enquiry.customer_name, ...(enquiry.phone ? { phonenumber: enquiry.phone } : {}) },
      customizations: { title: settings.name, description: `Reservation deposit · ${enquiry.vehicle_label}` },
      configurations: { session_duration: CHECKOUT_MINUTES, max_retry_attempt: 3 }, meta: { enquiry_reference: enquiry.reference, vehicle_id: vehicle.id },
    }),
  }, fetcher);
  if (!response.ok) {
    // A definitive client rejection cannot have produced a usable hosted checkout. Unknown/5xx outcomes retain the hold.
    if (response.status >= 400 && response.status < 500) await failCheckout(db, id, vehicle.id, timestamp);
    throw new HttpError(503, 'The payment provider could not prepare checkout. Your enquiry remains saved.', 'payment_provider_unavailable');
  }
  const payload = await boundedGatewayJson(response); const data = payload.data as { link?: unknown } | undefined;
  let checkoutUrl: URL | null = null;
  try { checkoutUrl = new URL(typeof data?.link === 'string' ? data.link : ''); } catch { /* A malformed gateway result must not create an unsafe redirect. */ }
  if (payload.status !== 'success' || !checkoutUrl || checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.flutterwave.com' || checkoutUrl.username || checkoutUrl.password || checkoutUrl.port) throw new HttpError(502, 'The payment provider returned an invalid checkout. Keep your reference and contact the dealership if needed.', 'payment_provider_response');
  const result = await db.prepare("UPDATE payments SET status='pending',checkout_url=?,updated_at=? WHERE id=? AND status='initiating' AND EXISTS (SELECT 1 FROM vehicles WHERE id=? AND payment_hold_id=?)")
    .bind(checkoutUrl.href, timestamp, id, vehicle.id, id).run();
  if (!result.meta.changes) throw new HttpError(409, 'The reservation window changed. Please contact the dealership before proceeding.', 'checkout_state_changed');
  return { checkoutUrl: checkoutUrl.href, reference };
}

function providerId(value: unknown): string | null {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  const result = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  return /^[1-9][0-9]{0,24}$/.test(result) ? result : null;
}

async function settleVerified(db: SqlDatabase, payment: PaymentRow, transactionId: string, timestamp: string) {
  try {
    await db.batch([
      db.prepare("UPDATE payments SET status=CASE WHEN expires_at>? AND EXISTS (SELECT 1 FROM vehicles v WHERE v.id=payments.vehicle_id AND v.status='available' AND v.is_demo=0 AND v.payment_hold_id=payments.id AND v.hold_expires_at>? AND v.reserved_payment_id IS NULL) AND EXISTS (SELECT 1 FROM enquiries e WHERE e.id=payments.enquiry_id AND e.status IN ('new','contacted')) AND NOT EXISTS (SELECT 1 FROM payments other WHERE other.enquiry_id=payments.enquiry_id AND other.id<>payments.id AND other.status IN ('paid','review')) THEN 'paid' ELSE 'review' END,provider_transaction_id=?,verified_at=?,updated_at=? WHERE id=? AND status IN ('initiating','pending','failed','expired') AND (provider_transaction_id IS NULL OR provider_transaction_id=?)")
        .bind(timestamp, timestamp, transactionId, timestamp, timestamp, payment.id, transactionId),
      db.prepare("UPDATE vehicles SET status='reserved',reserved_payment_id=?,payment_hold_id=NULL,hold_expires_at=NULL,version=version+1,updated_at=? WHERE id=? AND payment_hold_id=? AND EXISTS (SELECT 1 FROM payments WHERE id=? AND status='paid')")
        .bind(payment.id, timestamp, payment.vehicle_id, payment.id, payment.id),
      db.prepare("UPDATE vehicles SET payment_hold_id=NULL,hold_expires_at=NULL WHERE id=? AND payment_hold_id=? AND EXISTS (SELECT 1 FROM payments WHERE id=? AND status='review')").bind(payment.vehicle_id, payment.id, payment.id),
      db.prepare("UPDATE enquiries SET status=CASE WHEN (SELECT status FROM payments WHERE id=?)='paid' THEN 'reserved' ELSE 'payment-review' END,version=version+1,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM payments WHERE id=? AND status IN ('paid','review')) AND status<>CASE WHEN (SELECT status FROM payments WHERE id=?)='paid' THEN 'reserved' ELSE 'payment-review' END")
        .bind(payment.id, timestamp, payment.enquiry_id, payment.id, payment.id),
      db.prepare("INSERT INTO audit_events (id,actor_id,action,target_id,created_at) SELECT ?,'payment-provider','payment.verified',?,? WHERE changes()>0").bind(crypto.randomUUID(), payment.id, timestamp),
    ]);
  } catch (error) {
    if (error instanceof Error && /unique.*payments\.|payments_provider_id_unique|payments_one_active_vehicle/i.test(error.message)) throw new HttpError(409, 'This payment requires dealership review. Keep your reference and contact the team.', 'payment_verification_conflict');
    throw error;
  }
}

/** Browser and webhook claims only trigger this independent, authenticated gateway lookup. */
export async function verifyPayment(db: SqlDatabase, environment: DealerEnvironment, input: unknown, fetcher: GatewayFetch = fetch, timestamp?: string) {
  const value = object(input); const reference = paymentReference(value.reference); const payment = await getPayment(db, reference);
  if (payment.status === 'paid' || payment.status === 'review') return safeStatus(payment, timestamp || isoNow());
  const transactionId = value.transactionId === undefined || value.transactionId === null || value.transactionId === '' ? null : providerId(value.transactionId);
  if (value.transactionId !== undefined && value.transactionId !== null && value.transactionId !== '' && !transactionId) throw new HttpError(400, 'The payment provider transaction identifier is invalid.', 'invalid_transaction_id');
  const path = transactionId ? `/transactions/${transactionId}/verify` : `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
  const response = await gatewayRequest(environment, path, { method: 'GET' }, fetcher);
  if (response.status === 404) return safeStatus(payment, timestamp || isoNow());
  if (!response.ok) throw new HttpError(503, 'The payment provider could not verify this payment yet. Please check again shortly.', 'payment_verification_unavailable');
  const payload = await boundedGatewayJson(response); const data = payload.data as Record<string, unknown> | undefined;
  if (payload.status !== 'success' || !data || typeof data !== 'object' || data.status !== 'successful') return safeStatus(payment, timestamp || isoNow());
  const verifiedId = providerId(data.id); const amount = typeof data.amount === 'number' || typeof data.amount === 'string' ? Number(data.amount) : NaN;
  const enquiry = await db.prepare('SELECT * FROM enquiries WHERE id=?').bind(payment.enquiry_id).first<EnquiryRow>();
  const customer = data.customer as { email?: unknown } | undefined;
  const verifiedEmail = typeof customer?.email === 'string' ? customer.email.trim().toLowerCase() : '';
  if (!verifiedId || (transactionId && transactionId !== verifiedId) || data.tx_ref !== payment.reference || data.currency !== payment.currency || !Number.isFinite(amount) || amount !== payment.amount_kes || !enquiry || verifiedEmail !== enquiry.email) throw new HttpError(409, 'The verified transaction does not match this reservation. No reservation has been confirmed. Contact the dealership with your reference.', 'payment_verification_mismatch');
  await settleVerified(db, payment, verifiedId, timestamp || isoNow());
  return safeStatus(await getPayment(db, reference), timestamp || isoNow());
}

export async function authenticateWebhook(environment: DealerEnvironment, headers: Headers, bytes: Uint8Array): Promise<void> {
  const secret = environment.FLW_WEBHOOK_SECRET || ''; const mode = environment.FLW_WEBHOOK_SIGNATURE_MODE || 'hmac';
  if (secret.length < 16 || secret.length > 512 || secret !== secret.trim() || /^(replace|example|your|change)/i.test(secret) || !['hmac','legacy-verif-hash'].includes(mode)) throw new HttpError(503, 'Payment callbacks are not configured.', 'payments_unavailable');
  if (mode === 'hmac') {
    const signature = headers.get('flutterwave-signature') || '';
    if (!signature || !equalSecret(base64(await hmacBytes(secret, bytes)), signature)) throw new HttpError(401, 'The payment callback signature is invalid.', 'webhook_signature');
  } else if (!equalSecret(secret, headers.get('verif-hash') || '')) {
    throw new HttpError(401, 'The payment callback signature is invalid.', 'webhook_signature');
  }
}

export async function processWebhook(db: SqlDatabase, environment: DealerEnvironment, headers: Headers, bytes: Uint8Array, fetcher: GatewayFetch = fetch) {
  await authenticateWebhook(environment, headers, bytes);
  let payload: Record<string, unknown>;
  try { payload = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); } catch { throw new HttpError(400, 'The payment callback body is invalid.', 'invalid_json'); }
  if (payload.event !== 'charge.completed') return { received: true, ignored: true };
  const data = payload.data as { tx_ref?: unknown; id?: unknown } | undefined;
  if (!data || typeof data.tx_ref !== 'string' || !referencePattern.test(data.tx_ref)) return { received: true, ignored: true };
  const known = await db.prepare('SELECT id FROM payments WHERE reference=?').bind(data.tx_ref).first<{ id: string }>();
  if (!known) return { received: true, ignored: true };
  await verifyPayment(db, environment, { reference: data.tx_ref, ...(providerId(data.id) ? { transactionId: providerId(data.id) } : {}) }, fetcher);
  return { received: true };
}
