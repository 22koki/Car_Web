import { cars } from '../src/data/cars.ts';
import type { Car } from '../src/data/cars.ts';
import type { DealerConfig, Enquiry, EnquiryReceipt, EnquiryStatus, Appointment } from '../src/types/dealership.ts';
import { equalSecret, HttpError, validPrivateKey } from './security-core.ts';
import { hashText, receiptFor } from './crypto.ts';
import { choice, email, number, object, text, validateEnquiry, validateVehicle } from './validation.ts';
import type { Actor, DealerEnvironment, EnquiryRow, SlotRow, SqlDatabase, SqlStatement, Vehicle, VehicleRow, VehicleStatus } from './types.ts';

const DEFAULT_SETTINGS = { name: 'VELOCITY Motor Co.', location: 'Nairobi, Kenya', phone: '', email: '', whatsapp: '', timezone: 'Africa/Nairobi', depositKES: 0 };
export type DealerSettings = typeof DEFAULT_SETTINGS;
const nowISO = () => new Date().toISOString();

function audit(db: SqlDatabase, actor: Actor, action: string, targetId: string, timestamp: string): SqlStatement {
  return db.prepare('INSERT INTO audit_events (id, actor_id, action, target_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), actor.id, action, targetId, timestamp);
}

export function vehicleFromRow(row: VehicleRow): Vehicle {
  const data = JSON.parse(row.data) as Car;
  return { ...data, id: row.id, stockNumber: row.stock_number, status: row.status, condition: row.condition, isDemo: !!row.is_demo,
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listVehicles(db: SqlDatabase, admin = false) {
  const where = admin ? '' : "WHERE status IN ('available','reserved','sold')";
  const rows = (await db.prepare(`SELECT * FROM vehicles ${where} ORDER BY created_at DESC, stock_number ASC LIMIT 1000`).all<VehicleRow>()).results || [];
  const vehicles = rows.map(vehicleFromRow);
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM vehicles ${where}`).first<{ total: number }>();
  const demoCount = vehicles.filter(vehicle => vehicle.isDemo).length;
  return { vehicles, total: count?.total || 0, mode: demoCount === 0 ? 'live' as const : demoCount === vehicles.length ? 'demo' as const : 'mixed' as const };
}

export async function getVehicle(db: SqlDatabase, id: string): Promise<VehicleRow> {
  const row = await db.prepare('SELECT * FROM vehicles WHERE id = ?').bind(id).first<VehicleRow>();
  if (!row) throw new HttpError(404, 'This vehicle was not found.', 'vehicle_not_found');
  return row;
}

function stockConflict(error: unknown): never {
  if (error instanceof Error && /unique.*vehicles\.stock_number|vehicles_stock_number_unique/i.test(error.message)) throw new HttpError(409, 'That stock number is already in use.', 'stock_number_conflict');
  throw error;
}

export async function createVehicle(db: SqlDatabase, input: unknown, actor: Actor): Promise<Vehicle> {
  const vehicle = validateVehicle(input); const id = crypto.randomUUID(); const timestamp = nowISO();
  try {
    await db.batch([
      db.prepare('INSERT INTO vehicles (id,stock_number,data,status,condition,is_demo,version,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)')
        .bind(id, vehicle.stockNumber, JSON.stringify(vehicle.car), vehicle.status, vehicle.condition, vehicle.isDemo ? 1 : 0, timestamp, timestamp),
      audit(db, actor, 'vehicle.created', id, timestamp),
    ]);
  } catch (error) { stockConflict(error); }
  return vehicleFromRow(await getVehicle(db, id));
}

function checkVehicleEditable(current: VehicleRow, nextStatus: VehicleStatus, nextDemo: boolean, timestamp: string) {
  if (current.payment_hold_id && current.hold_expires_at && current.hold_expires_at > timestamp) throw new HttpError(409, 'A checkout is in progress for this car. Try again after its payment window closes.', 'vehicle_payment_hold');
  if (current.reserved_payment_id && (nextDemo || !['reserved','sold','archived'].includes(nextStatus))) throw new HttpError(409, 'A verified deposit is attached to this car. Resolve that reservation before making it available again.', 'vehicle_paid_reservation');
}

export async function updateVehicle(db: SqlDatabase, id: string, input: unknown, actor: Actor): Promise<Vehicle> {
  const vehicle = validateVehicle(input); const current = await getVehicle(db, id); const timestamp = nowISO();
  if (!vehicle.version || vehicle.version !== current.version) throw new HttpError(409, 'This vehicle changed since you opened it. Refresh before saving.', 'version_conflict');
  checkVehicleEditable(current, vehicle.status, vehicle.isDemo, timestamp);
  try {
    const results = await db.batch([
      db.prepare('UPDATE vehicles SET stock_number=?,data=?,status=?,condition=?,is_demo=?,version=version+1,updated_at=? WHERE id=? AND version=? AND (payment_hold_id IS NULL OR hold_expires_at<=?)')
        .bind(vehicle.stockNumber, JSON.stringify(vehicle.car), vehicle.status, vehicle.condition, vehicle.isDemo ? 1 : 0, timestamp, id, vehicle.version, timestamp),
      db.prepare('INSERT INTO audit_events (id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes() > 0').bind(crypto.randomUUID(), actor.id, 'vehicle.updated', id, timestamp),
    ]);
    if (!results[0].meta.changes) throw new HttpError(409, 'This vehicle changed while you were saving. Refresh and try again.', 'version_conflict');
  } catch (error) { stockConflict(error); }
  return vehicleFromRow(await getVehicle(db, id));
}

export async function setVehicleStatus(db: SqlDatabase, id: string, input: unknown, actor: Actor): Promise<Vehicle> {
  const value = object(input); const current = await getVehicle(db, id); const timestamp = nowISO();
  const status = choice(value.status, 'stock status', ['available','reserved','sold','draft','archived'] as const);
  const version = number(value.version, 'Version', 1, Number.MAX_SAFE_INTEGER, true);
  if (version !== current.version) throw new HttpError(409, 'This vehicle changed. Refresh before updating its status.', 'version_conflict');
  checkVehicleEditable(current, status, !!current.is_demo, timestamp);
  const results = await db.batch([
    db.prepare('UPDATE vehicles SET status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND (payment_hold_id IS NULL OR hold_expires_at<=?)').bind(status, timestamp, id, version, timestamp),
    db.prepare('INSERT INTO audit_events (id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes() > 0').bind(crypto.randomUUID(), actor.id, `vehicle.${status}`, id, timestamp),
  ]);
  if (!results[0].meta.changes) throw new HttpError(409, 'This vehicle changed while you were saving. Refresh and try again.', 'version_conflict');
  return vehicleFromRow(await getVehicle(db, id));
}

export async function archiveVehicle(db: SqlDatabase, id: string, actor: Actor, input?: unknown): Promise<Vehicle> {
  const row = await getVehicle(db, id);
  const value = input === undefined ? {} : object(input);
  return setVehicleStatus(db, id, { status: 'archived', version: value.version ?? row.version }, actor);
}

export async function seedDemo(db: SqlDatabase, input: unknown, actor: Actor) {
  const value = object(input); choice(value.kind, 'seed type', ['demo']); const timestamp = nowISO();
  const statements = cars.map((car, index) => db.prepare('INSERT INTO vehicles (id,stock_number,data,status,condition,is_demo,version,created_at,updated_at) VALUES (?,?,?,?,?,1,1,?,?) ON CONFLICT DO NOTHING')
    .bind(car.id, `DEMO-${String(index + 1).padStart(3, '0')}`, JSON.stringify(car), 'available', 'used', timestamp, timestamp));
  const results = await db.batch([...statements, audit(db, actor, 'demo.seeded', 'demo-inventory', timestamp)]);
  return { created: results.slice(0, cars.length).reduce((sum, result) => sum + (result.meta.changes || 0), 0), message: 'Illustrative cars are labelled as demo inventory. They cannot accept payments.' };
}

export async function getSettings(db: SqlDatabase): Promise<DealerSettings> {
  const row = await db.prepare("SELECT value FROM settings WHERE key='dealership'").first<{ value: string }>();
  return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.value) as Partial<DealerSettings> : {}) };
}

export function paymentsConfigured(environment: Pick<DealerEnvironment, 'FLW_SECRET_KEY'|'FLW_WEBHOOK_SECRET'|'SITE_URL'|'FLW_WEBHOOK_SIGNATURE_MODE'>, depositKES: number): boolean {
  const secret = environment.FLW_SECRET_KEY || ''; const webhook = environment.FLW_WEBHOOK_SECRET || '';
  if (depositKES <= 0 || secret.length < 20 || webhook.length < 16 || [secret, webhook].some(value => value.length > 512 || value !== value.trim() || /^(replace|example|your|change)/i.test(value))) return false;
  if (!['hmac','legacy-verif-hash'].includes(environment.FLW_WEBHOOK_SIGNATURE_MODE || 'hmac')) return false;
  try { const url = new URL(environment.SITE_URL || ''); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

export async function getConfig(db: SqlDatabase, environment: DealerEnvironment): Promise<DealerConfig> {
  const settings = await getSettings(db); const { depositKES, ...dealer } = settings;
  return { dealer, payments: { enabled: paymentsConfigured(environment, depositKES), provider: 'flutterwave', currency: 'KES', depositKES }, enquiriesEnabled: validPrivateKey(environment.PRIVATE_API_KEY) };
}

export async function updateSettings(db: SqlDatabase, input: unknown, actor: Actor): Promise<DealerSettings> {
  const value = object(input); const allowed = Object.keys(DEFAULT_SETTINGS);
  if (!Object.keys(value).length || Object.keys(value).some(key => !allowed.includes(key))) throw new HttpError(400, 'Send only the dealership settings you want to update.', 'invalid_request');
  const current = await getSettings(db); const next = { ...current };
  for (const key of ['name','location','phone','whatsapp','timezone'] as const) if (key in value) next[key] = text(value[key], key, key === 'location' ? 250 : 100, key === 'name' || key === 'timezone');
  if ('email' in value) next.email = email(value.email, false);
  if ('depositKES' in value) next.depositKES = number(value.depositKES, 'Reservation deposit', 0, 10000000, true);
  for (const key of ['phone','whatsapp'] as const) if (next[key] && !/^\+?[\d ()-]{7,32}$/.test(next[key])) throw new HttpError(400, `Enter a valid ${key} number.`, 'invalid_request');
  try { new Intl.DateTimeFormat('en-GB', { timeZone: next.timezone }).format(); } catch { throw new HttpError(400, 'Choose a valid IANA timezone such as Africa/Nairobi.', 'invalid_request'); }
  const timestamp = nowISO();
  await db.batch([
    db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('dealership',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(next), timestamp),
    audit(db, actor, 'settings.updated', 'dealership', timestamp),
  ]);
  return next;
}

/** Shared across Workers: the UPSERT and returned count are one SQLite statement. */
export async function consumeRateLimit(db: SqlDatabase, key: string, limit: number, windowSeconds: number, now = Date.now()): Promise<void> {
  const results = await db.batch([
    db.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count')
      .bind(key, now + windowSeconds * 1000, now, now),
    db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now - 86400000),
  ]);
  const count = (results[0].results?.[0] as { count?: number } | undefined)?.count;
  if (!count || count > limit) throw new HttpError(429, 'Too many requests. Please wait a little before trying again.', 'rate_limited');
}

interface AdminEnquiryRow extends EnquiryRow {
  payment_reference?: string | null; payment_status?: NonNullable<Enquiry['payment']>['status']; payment_amount_kes?: number;
  payment_currency?: 'KES'; payment_verified_at?: string | null; payment_created_at?: string;
}

const ADMIN_ENQUIRY_QUERY = 'SELECT e.*,p.reference AS payment_reference,p.status AS payment_status,p.amount_kes AS payment_amount_kes,p.currency AS payment_currency,p.verified_at AS payment_verified_at,p.created_at AS payment_created_at FROM enquiries e LEFT JOIN payments p ON p.id=(SELECT latest.id FROM payments latest WHERE latest.enquiry_id=e.id ORDER BY latest.created_at DESC,latest.rowid DESC LIMIT 1)';

function enquiryFromRow(row: AdminEnquiryRow): Enquiry {
  return { id: row.id, reference: row.reference, vehicleId: row.vehicle_id, vehicleLabel: row.vehicle_label, name: row.customer_name, email: row.email, phone: row.phone,
    requestType: row.request_type, slotId: row.requested_slot_id, preferredDate: row.preferred_date, message: row.message, status: row.status as EnquiryStatus,
    notes: row.notes, isDemo: !!row.is_demo, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
    payment: row.payment_reference ? { reference: row.payment_reference, status: row.payment_status!, amountKES: row.payment_amount_kes!, currency: row.payment_currency!, verifiedAt: row.payment_verified_at ?? null, createdAt: row.payment_created_at! } : null };
}

async function receipt(row: EnquiryRow, key: string): Promise<EnquiryReceipt> {
  const receiptToken = await receiptFor(key, row.id, row.idempotency_key);
  if (!equalSecret(await hashText(receiptToken), row.receipt_token_hash)) throw new HttpError(409, 'Your enquiry was already received. Use the receipt saved on this device, or contact the dealership with your original reference.', 'receipt_key_rotated');
  return { id: row.id, reference: row.reference, status: row.status as EnquiryStatus, receiptToken, isDemo: !!row.is_demo,
    message: row.is_demo ? 'Demo enquiry saved. This is illustrative stock; no vehicle, appointment or payment has been reserved.' : 'Your enquiry has been received. A member of the dealership team will review it. A requested appointment is not confirmed until staff confirm a slot.' };
}

function dealerDate(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
  return ['year','month','day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export async function createEnquiry(db: SqlDatabase, input: unknown, key: string, timestamp = nowISO()): Promise<EnquiryReceipt> {
  if (!validPrivateKey(key)) throw new HttpError(503, 'Secure enquiry handling is being configured.', 'server_configuration');
  const value = validateEnquiry(input); const payloadHash = await hashText(JSON.stringify(value));
  const existing = await db.prepare('SELECT * FROM enquiries WHERE idempotency_key=?').bind(value.idempotencyKey).first<EnquiryRow>();
  if (existing) {
    if (!equalSecret(existing.payload_hash, payloadHash)) throw new HttpError(409, 'This request identifier was used for a different enquiry. Start a new request.', 'idempotency_conflict');
    return receipt(existing, key);
  }
  if (value.requestType === 'reservation' && !value.vehicleId) throw new HttpError(400, 'Choose a vehicle before requesting a reservation.', 'vehicle_required');
  if (value.slotId && value.requestType !== 'test-drive') throw new HttpError(400, 'Appointment slots are available for test-drive requests.', 'invalid_request');
  const settings = await getSettings(db);
  if (value.preferredDate && (value.preferredDate < dealerDate(timestamp, settings.timezone) || value.preferredDate > dealerDate(new Date(new Date(timestamp).getTime() + 366 * 86400000).toISOString(), settings.timezone))) throw new HttpError(400, 'Choose a date within the next year in the dealership timezone.', 'invalid_request');
  const vehicle = value.vehicleId ? await getVehicle(db, value.vehicleId) : null;
  const allowedStates = value.requestType === 'details' ? ['available','reserved','sold'] : ['available'];
  if (vehicle && !allowedStates.includes(vehicle.status)) throw new HttpError(409, 'This vehicle is no longer available for this request. You can still request details about displayed stock.', 'vehicle_unavailable');
  if (value.slotId) {
    const slot = await db.prepare("SELECT s.* FROM slots s WHERE s.id=? AND s.status='open' AND s.starts_at>? AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id=s.id AND a.status='confirmed')").bind(value.slotId, timestamp).first<SlotRow>();
    if (!slot) throw new HttpError(409, 'That appointment slot is no longer available. Choose another time.', 'slot_unavailable');
  }
  await consumeRateLimit(db, `enquiry-email:${await hashText(value.email)}`, 5, 3600, new Date(timestamp).getTime());
  const id = crypto.randomUUID(); const reference = `VEL-${timestamp.slice(0,4)}-${id.replaceAll('-','').slice(0,12).toUpperCase()}`;
  const receiptToken = await receiptFor(key, id, value.idempotencyKey); const tokenHash = await hashText(receiptToken);
  const vehicleData = vehicle ? JSON.parse(vehicle.data) as Car : null;
  await db.prepare(`INSERT INTO enquiries (id,reference,vehicle_id,vehicle_label,customer_name,email,phone,request_type,preferred_date,requested_slot_id,message,consent_at,receipt_token_hash,idempotency_key,payload_hash,is_demo,status,notes,version,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new','',1,?,?
    WHERE (? IS NULL OR EXISTS (SELECT 1 FROM vehicles WHERE id=? AND (status='available' OR (?='details' AND status IN ('reserved','sold')))))
    AND (? IS NULL OR EXISTS (SELECT 1 FROM slots s WHERE s.id=? AND s.status='open' AND s.starts_at>? AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id=s.id AND a.status='confirmed')))
    ON CONFLICT(idempotency_key) DO NOTHING`)
    .bind(id, reference, value.vehicleId, vehicleData ? `${vehicleData.year} ${vehicleData.brand} ${vehicleData.model}` : 'General showroom enquiry', value.name, value.email, value.phone,
      value.requestType, value.preferredDate, value.slotId, value.message, timestamp, tokenHash, value.idempotencyKey, payloadHash, vehicle?.is_demo ? 1 : 0, timestamp, timestamp,
      value.vehicleId, value.vehicleId, value.requestType, value.slotId, value.slotId, timestamp).run();
  const saved = await db.prepare('SELECT * FROM enquiries WHERE idempotency_key=?').bind(value.idempotencyKey).first<EnquiryRow>();
  if (!saved) throw new HttpError(409, 'Availability changed while we saved your enquiry. Please refresh and try again.', 'availability_changed');
  if (!equalSecret(saved.payload_hash, payloadHash)) throw new HttpError(409, 'This request identifier was already used. Start a new request.', 'idempotency_conflict');
  return receipt(saved, key);
}

export async function requireReceipt(db: SqlDatabase, enquiryId: unknown, token: unknown): Promise<EnquiryRow> {
  const id = text(enquiryId, 'Enquiry identifier', 80, true); const receiptToken = text(token, 'Receipt token', 128, true);
  const row = await db.prepare('SELECT * FROM enquiries WHERE id=?').bind(id).first<EnquiryRow>();
  if (!row || !equalSecret(row.receipt_token_hash, await hashText(receiptToken))) throw new HttpError(404, 'This enquiry receipt could not be verified. Use the receipt from your original enquiry.', 'receipt_not_found');
  return row;
}

export async function listEnquiries(db: SqlDatabase) {
  const rows = (await db.prepare(`${ADMIN_ENQUIRY_QUERY} ORDER BY e.created_at DESC LIMIT 1000`).all<AdminEnquiryRow>()).results || [];
  return { enquiries: rows.map(enquiryFromRow) };
}

export async function updateEnquiry(db: SqlDatabase, id: string, input: unknown, actor: Actor): Promise<Enquiry> {
  const value = object(input); const row = await db.prepare('SELECT * FROM enquiries WHERE id=?').bind(id).first<EnquiryRow>();
  if (!row) throw new HttpError(404, 'This enquiry was not found.', 'enquiry_not_found');
  const status = value.status === undefined ? row.status : choice(value.status, 'enquiry status', ['new','contacted','closed','appointment-confirmed','reserved','payment-review']);
  if (status !== row.status && (!['new','contacted','closed'].includes(status) || !['new','contacted','closed'].includes(row.status))) throw new HttpError(409, 'Use the appointment or payment workflow to change this enquiry status.', 'protected_enquiry_status');
  const notes = value.notes === undefined ? row.notes : text(value.notes, 'Internal notes', 5000);
  const version = value.version === undefined ? row.version : number(value.version, 'Version', 1, Number.MAX_SAFE_INTEGER, true); const timestamp = nowISO();
  const results = await db.batch([
    db.prepare('UPDATE enquiries SET status=?,notes=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(status, notes, timestamp, id, version),
    db.prepare('INSERT INTO audit_events (id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(), actor.id, 'enquiry.updated', id, timestamp),
  ]);
  if (!results[0].meta.changes) throw new HttpError(409, 'This enquiry changed. Refresh before saving.', 'version_conflict');
  return enquiryFromRow((await db.prepare(`${ADMIN_ENQUIRY_QUERY} WHERE e.id=?`).bind(id).first<AdminEnquiryRow>())!);
}

function slotFromRow(row: SlotRow) { return { id: row.id, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, createdAt: row.created_at }; }

export async function listSlots(db: SqlDatabase, admin = false, timestamp = nowISO()) {
  const rows = (await db.prepare(admin ? 'SELECT * FROM slots ORDER BY starts_at DESC LIMIT 1000' : "SELECT s.* FROM slots s WHERE s.status='open' AND s.starts_at>? AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id=s.id AND a.status='confirmed') ORDER BY s.starts_at ASC LIMIT 100")
    .bind(...(admin ? [] : [timestamp])).all<SlotRow>()).results || [];
  return { slots: rows.map(slotFromRow) };
}

export async function createSlot(db: SqlDatabase, input: unknown, actor: Actor, timestamp = nowISO()) {
  const value = object(input); const raw = text(value.startsAt, 'Start time', 50, true); const starts = new Date(raw); const current = new Date(timestamp).getTime();
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(starts.getTime()) || starts.getUTCMinutes() || starts.getUTCSeconds() || starts.getUTCMilliseconds() || starts.getTime() <= current || starts.getTime() > current + 366 * 86400000) throw new HttpError(400, 'Choose a future, whole-hour slot within the next year, including its timezone.', 'invalid_slot');
  const startsAt = starts.toISOString(); const endsAt = new Date(starts.getTime() + 3600000).toISOString(); const id = crypto.randomUUID();
  try { await db.batch([
    db.prepare("INSERT INTO slots (id,starts_at,ends_at,status,created_at) VALUES (?,?,?,'open',?)").bind(id, startsAt, endsAt, timestamp),
    audit(db, actor, 'slot.created', id, timestamp),
  ]); } catch (error) {
    if (error instanceof Error && /unique.*slots\.starts_at|slots_starts_at_unique/i.test(error.message)) throw new HttpError(409, 'A slot already exists at that time.', 'slot_conflict');
    throw error;
  }
  return { id, startsAt, endsAt, status: 'open' as const, createdAt: timestamp };
}

export async function closeSlot(db: SqlDatabase, id: string, actor: Actor) {
  const row = await db.prepare('SELECT * FROM slots WHERE id=?').bind(id).first<SlotRow>();
  if (!row) throw new HttpError(404, 'This slot was not found.', 'slot_not_found');
  const timestamp = nowISO();
  const results = await db.batch([
    db.prepare("UPDATE slots SET status='closed' WHERE id=? AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id=? AND status='confirmed')").bind(id, id),
    db.prepare('INSERT INTO audit_events (id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(), actor.id, 'slot.closed', id, timestamp),
  ]);
  if (!results[0].meta.changes) throw new HttpError(409, 'Cancel the confirmed appointment before closing this slot.', 'slot_has_appointment');
  return { ...slotFromRow(row), status: 'closed' as const };
}

const APPOINTMENT_QUERY = 'SELECT a.id,a.enquiry_id AS enquiryId,a.slot_id AS slotId,a.vehicle_id AS vehicleId,e.reference,e.customer_name AS customerName,e.vehicle_label AS vehicleLabel,s.starts_at AS startsAt,s.ends_at AS endsAt,a.status,a.created_at AS createdAt FROM appointments a JOIN enquiries e ON e.id=a.enquiry_id JOIN slots s ON s.id=a.slot_id';

export async function listAppointments(db: SqlDatabase) {
  return { appointments: (await db.prepare(`${APPOINTMENT_QUERY} ORDER BY s.starts_at DESC LIMIT 1000`).all<Appointment>()).results || [] };
}

export async function confirmAppointment(db: SqlDatabase, input: unknown, actor: Actor, timestamp = nowISO()): Promise<Appointment> {
  const value = object(input); const enquiryId = text(value.enquiryId, 'Enquiry', 80, true); const slotId = text(value.slotId, 'Slot', 80, true);
  const existing = await db.prepare(`${APPOINTMENT_QUERY} WHERE a.enquiry_id=? AND a.status='confirmed'`).bind(enquiryId).first<Appointment>();
  if (existing) { if (existing.slotId === slotId) return existing; throw new HttpError(409, 'This enquiry already has an appointment. Cancel it before choosing a different slot.', 'appointment_conflict'); }
  const id = crypto.randomUUID();
  try {
    const results = await db.batch([
      db.prepare("INSERT INTO appointments (id,enquiry_id,slot_id,vehicle_id,status,created_at,updated_at) SELECT ?,e.id,s.id,e.vehicle_id,'confirmed',?,? FROM enquiries e JOIN slots s ON s.id=? LEFT JOIN vehicles v ON v.id=e.vehicle_id WHERE e.id=? AND e.status IN ('new','contacted') AND s.status='open' AND s.starts_at>? AND (e.vehicle_id IS NULL OR v.status='available')")
        .bind(id, timestamp, timestamp, slotId, enquiryId, timestamp),
      db.prepare("UPDATE enquiries SET status='appointment-confirmed',version=version+1,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM appointments WHERE id=? AND status='confirmed')").bind(timestamp, enquiryId, id),
      db.prepare('INSERT INTO audit_events (id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM appointments WHERE id=?)').bind(crypto.randomUUID(), actor.id, 'appointment.confirmed', id, timestamp, id),
    ]);
    if (!results[0].meta.changes) throw new HttpError(409, 'The enquiry, vehicle or slot is no longer available for this appointment.', 'appointment_unavailable');
  } catch (error) {
    if (error instanceof Error && /unique.*appointments\.|appointments_one_confirmed/i.test(error.message)) throw new HttpError(409, 'This slot or enquiry has already been booked. Refresh the appointment list.', 'appointment_conflict');
    throw error;
  }
  return (await db.prepare(`${APPOINTMENT_QUERY} WHERE a.id=?`).bind(id).first<Appointment>())!;
}

export async function cancelAppointment(db: SqlDatabase, id: string, actor: Actor): Promise<Appointment> {
  const row = await db.prepare(`${APPOINTMENT_QUERY} WHERE a.id=?`).bind(id).first<Appointment>();
  if (!row) throw new HttpError(404, 'This appointment was not found.', 'appointment_not_found');
  if (row.status === 'cancelled') return row;
  if (row.status !== 'confirmed') throw new HttpError(409, 'Only a confirmed appointment can be cancelled.', 'appointment_status');
  const timestamp = nowISO();
  await db.batch([
    db.prepare("UPDATE appointments SET status='cancelled',updated_at=? WHERE id=? AND status='confirmed'").bind(timestamp, id),
    db.prepare("UPDATE enquiries SET status='contacted',version=version+1,updated_at=? WHERE id=? AND status='appointment-confirmed' AND NOT EXISTS (SELECT 1 FROM appointments WHERE enquiry_id=? AND status='confirmed')").bind(timestamp, row.enquiryId, row.enquiryId),
    audit(db, actor, 'appointment.cancelled', id, timestamp),
  ]);
  return { ...row, status: 'cancelled' };
}
