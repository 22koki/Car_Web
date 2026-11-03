import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { cars } from '../src/data/cars.ts';
import { archiveVehicle, cancelAppointment, closeSlot, confirmAppointment, consumeRateLimit, createEnquiry, createSlot, createVehicle, getConfig, getSettings, getVehicle, listAppointments, listEnquiries, listSlots, listVehicles, paymentsConfigured, requireReceipt, seedDemo, setVehicleStatus, updateEnquiry, updateSettings, updateVehicle } from '../server/dealership.ts';
import { authenticateWebhook, createCheckout, paymentStatus, processWebhook, verifyPayment } from '../server/payments.ts';
import { base64, hashText, hmacBytes } from '../server/crypto.ts';
import { HttpError } from '../server/security-core.ts';
import { imageSignature, MAX_IMAGE_BYTES, readBoundedBytes, readImageUpload } from '../server/media.ts';
import type { Actor, DealerEnvironment, PaymentRow } from '../server/types.ts';
import { TestDatabase } from './backend-db.ts';

const key = '6a9be2d15f4c8a7e'.repeat(4);
const actor: Actor = { id: 'staff-test', email: 'owner@example.test', displayName: 'Test staff', method: 'service' };
function database(t: TestContext) { const db = new TestDatabase(); t.after(() => db.close()); return db; }
function environment(db: TestDatabase): DealerEnvironment { return { DB: db, PRIVATE_API_KEY: key, SITE_URL: 'https://dealer.example', FLW_SECRET_KEY: 'FLWSECK_TEST_SYNTHETIC_VALUE_FOR_LOCAL_TESTS', FLW_WEBHOOK_SECRET: 'SYNTHETIC_WEBHOOK_SECRET_FOR_LOCAL_TESTS' }; }
function errorCode(code: string) { return (error: unknown) => error instanceof HttpError && error.code === code; }
function enquiryInput(vehicleId?: string, overrides: Record<string, unknown> = {}) {
  return { vehicleId, name: 'Test Visitor', email: `${crypto.randomUUID()}@example.test`, phone: '+254700000000', requestType: 'details', consent: true, idempotencyKey: crypto.randomUUID(), ...overrides };
}
async function liveVehicle(db: TestDatabase, stockNumber = crypto.randomUUID().slice(0,8)) {
  return createVehicle(db, { ...cars[0], stockNumber, status: 'available', condition: 'used', isDemo: false }, actor);
}
function futureHour() { const date = new Date(Date.now() + 2 * 86400000); date.setUTCHours(12,0,0,0); return date.toISOString(); }
const hostedGateway = async () => Response.json({ status: 'success', data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/synthetic-test-link' } });
async function reservation(db: TestDatabase, vehicleId: string) {
  const input = enquiryInput(vehicleId, { requestType: 'reservation' });
  const receipt = await createEnquiry(db, input, key);
  return { ...receipt, email: input.email };
}
async function setupCheckout(db: TestDatabase) {
  const env = environment(db); const vehicle = await liveVehicle(db); const receipt = await reservation(db, vehicle.id);
  await updateSettings(db, { depositKES: 50000 }, actor);
  const checkout = await createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, hostedGateway);
  return { env, vehicle, receipt, checkout };
}
function verification(reference: string, email: string, overrides: Record<string, unknown> = {}) {
  return { status: 'success', data: { id: 123456, tx_ref: reference, status: 'successful', amount: 50000, currency: 'KES', customer: { email }, ...overrides } };
}

test('migration contains no demo data; explicit demo seeding is idempotent and public stock hides drafts and archives', async t => {
  const db = database(t);
  assert.equal((await listVehicles(db)).total, 0);
  assert.equal((await seedDemo(db, { kind: 'demo' }, actor)).created, 8);
  assert.equal((await seedDemo(db, { kind: 'demo' }, actor)).created, 0);
  const seeded = await listVehicles(db); assert.equal(seeded.mode, 'demo'); assert.ok(seeded.vehicles.every(vehicle => vehicle.isDemo));
  await archiveVehicle(db, seeded.vehicles[0].id, actor, { version: 1 });
  await setVehicleStatus(db, seeded.vehicles[1].id, { status: 'draft', version: 1 }, actor);
  await setVehicleStatus(db, seeded.vehicles[2].id, { status: 'sold', version: 1 }, actor);
  assert.equal((await listVehicles(db)).total, 6);
  assert.equal((await listVehicles(db, true)).total, 8);
  assert.ok((await listVehicles(db)).vehicles.some(vehicle => vehicle.status === 'sold'));
});

test('optimistic stock versions reject stale updates and archive requests; stock numbers remain unique', async t => {
  const db = database(t); const vehicle = await liveVehicle(db, 'STOCK-001');
  const saved = await updateVehicle(db, vehicle.id, { ...vehicle, price: vehicle.price + 1000 }, actor);
  assert.equal(saved.version, 2);
  await assert.rejects(() => updateVehicle(db, vehicle.id, vehicle, actor), errorCode('version_conflict'));
  await assert.rejects(() => archiveVehicle(db, vehicle.id, actor, { version: 1 }), errorCode('version_conflict'));
  await assert.rejects(() => liveVehicle(db, 'STOCK-001'), errorCode('stock_number_conflict'));
  assert.equal((await getVehicle(db, vehicle.id)).status, 'available');
});

test('simultaneous idempotent enquiries persist once and recover the same immutable reference and hashed receipt', async t => {
  const db = database(t); const vehicle = await liveVehicle(db); const input = enquiryInput(vehicle.id);
  const [one, two] = await Promise.all([createEnquiry(db, input, key), createEnquiry(db, input, key)]);
  assert.equal(one.id, two.id); assert.equal(one.reference, two.reference); assert.equal(one.receiptToken, two.receiptToken); assert.equal(one.status, 'new');
  const row = await db.prepare('SELECT * FROM enquiries WHERE id=?').bind(one.id).first<{ receipt_token_hash: string; idempotency_key: string; status: string }>();
  assert.equal(row?.receipt_token_hash, await hashText(one.receiptToken)); assert.notEqual(row?.receipt_token_hash, one.receiptToken);
  assert.equal((await listEnquiries(db)).enquiries.length, 1);
  assert.equal((await requireReceipt(db, one.id, one.receiptToken)).id, one.id);
  await assert.rejects(() => requireReceipt(db, one.id, 'invalid-token'), errorCode('receipt_not_found'));
  await assert.rejects(() => createEnquiry(db, { ...input, message: 'Changed submission' }, key), errorCode('idempotency_conflict'));
  const publicData = JSON.stringify(await listVehicles(db)); assert.ok(!publicData.includes(input.email));
});

test('enquiries enforce consent, honeypot, valid dates, dealer-local date and availability; details remain available for sold stock', async t => {
  const db = database(t); const vehicle = await liveVehicle(db);
  await assert.rejects(() => createEnquiry(db, enquiryInput(vehicle.id, { consent: false }), key), errorCode('consent_required'));
  await assert.rejects(() => createEnquiry(db, enquiryInput(vehicle.id, { website: 'bot.example' }), key), errorCode('invalid_request'));
  await assert.rejects(() => createEnquiry(db, enquiryInput(vehicle.id, { preferredDate: '2030-99-99' }), key), errorCode('invalid_request'));
  await assert.rejects(() => createEnquiry(db, enquiryInput(vehicle.id, { preferredDate: '2030-11-03' }), key, '2030-11-03T22:30:00.000Z'), errorCode('invalid_request'));
  await setVehicleStatus(db, vehicle.id, { status: 'sold', version: 1 }, actor);
  await assert.rejects(() => createEnquiry(db, enquiryInput(vehicle.id, { requestType: 'reservation' }), key), errorCode('vehicle_unavailable'));
  assert.equal((await createEnquiry(db, enquiryInput(vehicle.id), key)).status, 'new');
});

test('database rate limits admit only the allowed concurrent requests and reset at expiry', async t => {
  const db = database(t);
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => consumeRateLimit(db, 'synthetic-client', 3, 60, 100000)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
  for (const result of results.filter(result => result.status === 'rejected')) assert.equal((result as PromiseRejectedResult).reason.code, 'rate_limited');
  await consumeRateLimit(db, 'synthetic-client', 3, 60, 160001);
});

test('appointment confirmation is atomic: one slot cannot be confirmed for two customers, and cancellation releases it', async t => {
  const db = database(t); const vehicle = await liveVehicle(db); const startsAt = futureHour();
  const slot = await createSlot(db, { startsAt }, actor);
  const one = await createEnquiry(db, enquiryInput(vehicle.id, { requestType: 'test-drive', slotId: slot.id }), key);
  const two = await createEnquiry(db, enquiryInput(vehicle.id, { requestType: 'test-drive', slotId: slot.id }), key);
  const outcomes = await Promise.allSettled([confirmAppointment(db, { enquiryId: one.id, slotId: slot.id }, actor), confirmAppointment(db, { enquiryId: two.id, slotId: slot.id }, actor)]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length, 1);
  const appointment = (await listAppointments(db)).appointments[0]; assert.equal(appointment.status, 'confirmed');
  assert.equal((await listSlots(db)).slots.length, 0);
  assert.equal((await confirmAppointment(db, { enquiryId: appointment.enquiryId, slotId: slot.id }, actor)).id, appointment.id);
  await assert.rejects(() => closeSlot(db, slot.id, actor), errorCode('slot_has_appointment'));
  const enquiries = (await listEnquiries(db)).enquiries;
  assert.equal(enquiries.find(enquiry => enquiry.id !== appointment.enquiryId)?.status, 'new');
  await assert.rejects(() => updateEnquiry(db, appointment.enquiryId, { status: 'closed' }, actor), errorCode('protected_enquiry_status'));
  await cancelAppointment(db, appointment.id, actor);
  assert.equal((await listSlots(db)).slots.length, 1);
  assert.equal((await listEnquiries(db)).enquiries.find(enquiry => enquiry.id === appointment.enquiryId)?.status, 'contacted');
  assert.equal((await closeSlot(db, slot.id, actor)).status, 'closed');
  assert.equal((await listSlots(db)).slots.length, 0);
});

test('slots are future, unique and hour-aligned', async t => {
  const db = database(t); const startsAt = futureHour();
  const slot = await createSlot(db, { startsAt }, actor);
  assert.equal(new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime(), 3600000);
  await assert.rejects(() => createSlot(db, { startsAt }, actor), errorCode('slot_conflict'));
  await assert.rejects(() => createSlot(db, { startsAt: startsAt.replace(':00:00.', ':30:00.') }, actor), errorCode('invalid_slot'));
  await assert.rejects(() => createSlot(db, { startsAt: '2000-01-01T12:00:00.000Z' }, actor), errorCode('invalid_slot'));
});

test('payments default disabled and require explicit positive deposit, merchant setup and secure site URL', async t => {
  const db = database(t); const env = environment(db);
  assert.equal((await getSettings(db)).depositKES, 0); assert.equal((await getConfig(db, env)).payments.enabled, false);
  await updateSettings(db, { depositKES: 50000, name: 'Example Dealer', timezone: 'Africa/Nairobi' }, actor);
  const config = await getConfig(db, env); assert.equal(config.payments.enabled, true); assert.equal(config.dealer.email, '');
  assert.ok(!JSON.stringify(config).includes(env.FLW_SECRET_KEY!));
  assert.equal(paymentsConfigured({ ...env, FLW_WEBHOOK_SECRET: 'replace-this-placeholder-webhook-secret' }, 50000), false);
  assert.equal(paymentsConfigured({ ...env, SITE_URL: 'http://dealer.example' }, 50000), false);
  await assert.rejects(() => updateSettings(db, { timezone: 'Mars/Olympus' }, actor), errorCode('invalid_request'));
});

test('checkout refuses demo stock, wrong receipts and missing merchant configuration without contacting a gateway', async t => {
  const db = database(t); const vehicle = await liveVehicle(db); const receipt = await reservation(db, vehicle.id); let requests = 0;
  const gateway = async () => { requests++; return hostedGateway(); };
  await assert.rejects(() => createCheckout(db, { DB: db }, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, gateway), errorCode('payments_unavailable'));
  await assert.rejects(() => createCheckout(db, environment(db), { enquiryId: receipt.id, receiptToken: 'wrong' }, gateway), errorCode('receipt_not_found'));
  await seedDemo(db, { kind: 'demo' }, actor); const demo = await reservation(db, cars[0].id);
  await assert.rejects(() => createCheckout(db, environment(db), { enquiryId: demo.id, receiptToken: demo.receiptToken }, gateway), errorCode('demo_payment_disabled'));
  assert.equal(requests, 0);
});

test('competing checkouts reserve one atomic hold; amount is server-owned and an idempotent retry reuses its link', async t => {
  const db = database(t); const env = environment(db); const vehicle = await liveVehicle(db);
  await updateSettings(db, { depositKES: 50000 }, actor);
  const first = await reservation(db, vehicle.id); const second = await reservation(db, vehicle.id); let requests = 0; let sent: Record<string, unknown> = {};
  const gateway = async (_url: string, init?: RequestInit) => { requests++; sent = JSON.parse(init?.body as string) as Record<string, unknown>; return hostedGateway(); };
  const receipts = [first, second];
  const outcomes = await Promise.allSettled(receipts.map(receipt => createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken, amount: 1, currency: 'USD' }, gateway)));
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1); assert.equal(requests, 1);
  assert.equal(sent.amount, 50000); assert.equal(sent.currency, 'KES');
  assert.equal(new URL(sent.redirect_url as string).pathname, '/payment');
  const winner = outcomes.findIndex(outcome => outcome.status === 'fulfilled'); const checkout = (outcomes[winner] as PromiseFulfilledResult<{ checkoutUrl: string; reference: string }>).value;
  assert.deepEqual(await createCheckout(db, env, { enquiryId: receipts[winner].id, receiptToken: receipts[winner].receiptToken }, gateway), checkout);
  assert.equal(requests, 1);
  await assert.rejects(() => setVehicleStatus(db, vehicle.id, { status: 'sold', version: 1 }, actor), errorCode('vehicle_payment_hold'));
  const active = await db.prepare("SELECT COUNT(*) AS count FROM payments WHERE status IN ('initiating','pending','paid')").first<{ count: number }>(); assert.equal(active?.count, 1);
});

test('a stock edit between checkout validation and the atomic hold rejects the stale price without contacting the gateway', async t => {
  const db = database(t); const env = environment(db); const vehicle = await liveVehicle(db); const receipt = await reservation(db, vehicle.id);
  await updateSettings(db, { depositKES: 50000 }, actor); let requests = 0;
  db.beforeBatch = () => {
    db.beforeBatch = undefined;
    db.native.prepare("UPDATE vehicles SET data=json_set(data,'$.price',100),version=version+1 WHERE id=?").run(vehicle.id);
  };
  await assert.rejects(() => createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, async () => { requests++; return hostedGateway(); }), errorCode('vehicle_payment_hold'));
  assert.equal(requests, 0); assert.equal((await getVehicle(db, vehicle.id)).payment_hold_id, null);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM payments').first<{ count: number }>())?.count, 0);
});

test('closing an enquiry blocks its cached checkout, and subsequently verified funds require staff review', async t => {
  const db = database(t); const { env, receipt, checkout, vehicle } = await setupCheckout(db);
  await updateEnquiry(db, receipt.id, { status: 'closed' }, actor);
  await assert.rejects(() => createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, hostedGateway), errorCode('enquiry_unavailable'));
  const result = await verifyPayment(db, env, { reference: checkout.reference }, async () => Response.json(verification(checkout.reference, receipt.email)));
  assert.equal(result.status, 'review'); assert.equal((await getVehicle(db, vehicle.id)).status, 'available');
});

test('only independently verified exact payment details reserve stock; browser status and mismatches cannot mark paid', async t => {
  const db = database(t); const { env, vehicle, receipt, checkout } = await setupCheckout(db);
  for (const overrides of [{ tx_ref: `velpay_${crypto.randomUUID()}` }, { amount: 1 }, { amount: 50001 }, { currency: 'USD' }, { customer: { email: 'someone-else@example.test' } }, { id: 999 }]) {
    await assert.rejects(() => verifyPayment(db, env, { reference: checkout.reference, transactionId: '123456', status: 'successful' }, async () => Response.json(verification(checkout.reference, receipt.email, overrides))), errorCode('payment_verification_mismatch'));
    assert.equal((await paymentStatus(db, checkout.reference)).status, 'pending');
    assert.equal((await getVehicle(db, vehicle.id)).status, 'available');
  }
  assert.equal((await verifyPayment(db, env, { reference: checkout.reference, status: 'successful' }, async () => Response.json(verification(checkout.reference, receipt.email, { status: 'pending' })))).status, 'pending');
  let lookups = 0;
  const paid = await verifyPayment(db, env, { reference: checkout.reference }, async url => { lookups++; assert.match(url, /verify_by_reference\?tx_ref=velpay_/); return Response.json(verification(checkout.reference, receipt.email)); });
  assert.equal(paid.status, 'paid'); assert.equal((await getVehicle(db, vehicle.id)).status, 'reserved');
  assert.equal((await listEnquiries(db)).enquiries.find(enquiry => enquiry.id === receipt.id)?.status, 'reserved');
  const version = (await getVehicle(db, vehicle.id)).version;
  await verifyPayment(db, env, { reference: checkout.reference }, async () => { lookups++; return hostedGateway(); });
  assert.equal(lookups, 1); assert.equal((await getVehicle(db, vehicle.id)).version, version);
  await assert.rejects(() => setVehicleStatus(db, vehicle.id, { status: 'available', version }, actor), errorCode('vehicle_paid_reservation'));
  assert.ok(!JSON.stringify(await paymentStatus(db, checkout.reference)).includes(receipt.email));
});

test('a late verified payment enters review and cannot steal a newer customer hold', async t => {
  const db = database(t); const { env, vehicle, receipt, checkout } = await setupCheckout(db);
  const firstRow = await db.prepare('SELECT * FROM payments WHERE reference=?').bind(checkout.reference).first<PaymentRow>();
  const afterExpiry = new Date(new Date(firstRow!.expires_at).getTime() + 1000).toISOString();
  const nextReceipt = await reservation(db, vehicle.id);
  const nextCheckout = await createCheckout(db, env, { enquiryId: nextReceipt.id, receiptToken: nextReceipt.receiptToken }, hostedGateway, afterExpiry);
  const nextRow = await db.prepare('SELECT * FROM payments WHERE reference=?').bind(nextCheckout.reference).first<PaymentRow>();
  const result = await verifyPayment(db, env, { reference: checkout.reference }, async () => Response.json(verification(checkout.reference, receipt.email)), afterExpiry);
  assert.equal(result.status, 'review');
  const held = await getVehicle(db, vehicle.id); assert.equal(held.status, 'available'); assert.equal(held.payment_hold_id, nextRow!.id);
  assert.equal((await listEnquiries(db)).enquiries.find(enquiry => enquiry.id === receipt.id)?.status, 'payment-review');
});

test('staff see only the latest payment summary on an enquiry while public payment status excludes customer data', async t => {
  const db = database(t); const { env, receipt, checkout } = await setupCheckout(db);
  const firstRow = await db.prepare('SELECT * FROM payments WHERE reference=?').bind(checkout.reference).first<PaymentRow>();
  const afterExpiry = new Date(new Date(firstRow!.expires_at).getTime() + 1000).toISOString();
  const next = await createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, hostedGateway, afterExpiry);
  const latest = (await listEnquiries(db)).enquiries.find(enquiry => enquiry.id === receipt.id);
  assert.equal(latest?.payment?.reference, next.reference); assert.equal(latest?.payment?.amountKES, 50000); assert.equal(latest?.payment?.status, 'pending');
  const updated = await updateEnquiry(db, receipt.id, { notes: 'Review the latest payment reference.' }, actor);
  assert.equal(updated.payment?.reference, next.reference);
  const publicStatus = await paymentStatus(db, next.reference, afterExpiry);
  assert.deepEqual(Object.keys(publicStatus).sort(), ['amountKES','currency','message','reference','status']);
  assert.ok(!JSON.stringify(publicStatus).includes(receipt.email)); assert.ok(!JSON.stringify(publicStatus).includes(receipt.receiptToken));
});

test('a late payment for attempt A blocks cached attempt B for the same enquiry and prevents a second automatic reservation', async t => {
  const db = database(t); const { env, receipt, checkout, vehicle } = await setupCheckout(db);
  const attemptA = await db.prepare('SELECT * FROM payments WHERE reference=?').bind(checkout.reference).first<PaymentRow>();
  const afterExpiry = new Date(new Date(attemptA!.expires_at).getTime() + 1000).toISOString();
  const attemptB = await createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, hostedGateway, afterExpiry);
  assert.equal((await verifyPayment(db, env, { reference: checkout.reference }, async () => Response.json(verification(checkout.reference, receipt.email)), afterExpiry)).status, 'review');
  assert.equal((await listEnquiries(db)).enquiries.find(enquiry => enquiry.id === receipt.id)?.status, 'payment-review');
  await assert.rejects(() => createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, hostedGateway, afterExpiry), errorCode('payment_under_review'));
  assert.equal((await verifyPayment(db, env, { reference: attemptB.reference }, async () => Response.json(verification(attemptB.reference, receipt.email, { id: 123457 })), afterExpiry)).status, 'review');
  const stock = await getVehicle(db, vehicle.id); assert.equal(stock.status, 'available'); assert.equal(stock.reserved_payment_id, null); assert.equal(stock.payment_hold_id, null);
  const verified = await db.prepare("SELECT COUNT(*) AS count FROM payments WHERE enquiry_id=? AND status='review'").bind(receipt.id).first<{ count: number }>(); assert.equal(verified?.count, 2);
});

test('webhooks authenticate exact raw bytes; legacy mode is explicit and still cannot bypass gateway verification', async t => {
  const db = database(t); const { env, receipt, checkout, vehicle } = await setupCheckout(db);
  const bytes = new TextEncoder().encode(JSON.stringify({ event: 'charge.completed', data: { id: 123456, tx_ref: checkout.reference, status: 'successful' } }));
  const signature = base64(await hmacBytes(env.FLW_WEBHOOK_SECRET!, bytes)); const headers = new Headers({ 'flutterwave-signature': signature });
  await authenticateWebhook(env, headers, bytes);
  await assert.rejects(() => authenticateWebhook(env, headers, new TextEncoder().encode('{}')), errorCode('webhook_signature'));
  await assert.rejects(() => authenticateWebhook(env, new Headers({ 'verif-hash': env.FLW_WEBHOOK_SECRET! }), bytes), errorCode('webhook_signature'));
  await authenticateWebhook({ ...env, FLW_WEBHOOK_SIGNATURE_MODE: 'legacy-verif-hash' }, new Headers({ 'verif-hash': env.FLW_WEBHOOK_SECRET! }), bytes);
  await processWebhook(db, env, headers, bytes, async () => Response.json(verification(checkout.reference, receipt.email, { status: 'pending' })));
  assert.equal((await getVehicle(db, vehicle.id)).status, 'available');
  let requests = 0;
  await processWebhook(db, env, headers, bytes, async () => { requests++; return Response.json(verification(checkout.reference, receipt.email)); });
  await processWebhook(db, env, headers, bytes, async () => { requests++; throw new Error('A replay must not require another provider request'); });
  assert.equal(requests, 1); assert.equal((await paymentStatus(db, checkout.reference)).status, 'paid');
});

test('an ambiguous gateway failure retains the hold and unsafe checkout URLs are never returned', async t => {
  const db = database(t); const env = environment(db); await updateSettings(db, { depositKES: 50000 }, actor);
  const vehicle = await liveVehicle(db); const receipt = await reservation(db, vehicle.id);
  await assert.rejects(() => createCheckout(db, env, { enquiryId: receipt.id, receiptToken: receipt.receiptToken }, async () => { throw new Error('synthetic timeout'); }), errorCode('payment_provider_unavailable'));
  assert.ok((await getVehicle(db, vehicle.id)).payment_hold_id);
  const secondVehicle = await liveVehicle(db); const secondReceipt = await reservation(db, secondVehicle.id);
  await assert.rejects(() => createCheckout(db, env, { enquiryId: secondReceipt.id, receiptToken: secondReceipt.receiptToken }, async () => Response.json({ status: 'success', data: { link: 'https://checkout.flutterwave.com.attacker.example/pay' } })), errorCode('payment_provider_response'));
  const stored = await db.prepare('SELECT checkout_url FROM payments WHERE enquiry_id=?').bind(secondReceipt.id).first<{ checkout_url: string | null }>(); assert.equal(stored?.checkout_url, null);
});

test('uploads enforce actual size and raster byte signatures; an SVG with a PNG name is rejected', async () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
  assert.equal(imageSignature(png).contentType, 'image/png');
  assert.throws(() => imageSignature(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), errorCode('image_type'));
  const oversized = new Request('https://dealer.example/upload', { method: 'POST', body: new Uint8Array(100) });
  assert.equal(oversized.headers.get('content-length'), null);
  await assert.rejects(() => readBoundedBytes(oversized, 50), errorCode('request_too_large'));
  assert.throws(() => imageSignature(new Uint8Array(MAX_IMAGE_BYTES + 1)), errorCode('image_size'));
  const form = new FormData(); form.set('file', new File([png], 'photo.png', { type: 'image/png' }));
  const upload = await readImageUpload(new Request('https://dealer.example/upload', { method: 'POST', body: form }));
  assert.match(upload.key, /^vehicle-[a-f0-9-]+\.png$/);
  const wrong = new FormData(); wrong.set('file', new File([png], 'photo.jpg', { type: 'image/jpeg' }));
  await assert.rejects(() => readImageUpload(new Request('https://dealer.example/upload', { method: 'POST', body: wrong })), errorCode('image_type'));
});
