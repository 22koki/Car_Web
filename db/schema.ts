import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(), stockNumber: text('stock_number').notNull(), data: text('data').notNull(),
  status: text('status').notNull().default('draft'), condition: text('condition').notNull().default('used'),
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false), version: integer('version').notNull().default(1),
  paymentHoldId: text('payment_hold_id'), holdExpiresAt: text('hold_expires_at'), reservedPaymentId: text('reserved_payment_id'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('vehicles_stock_number_unique').on(t.stockNumber), index('vehicles_status_idx').on(t.status),
  check('vehicles_status_check', sql`${t.status} in ('available','reserved','sold','draft','archived')`),
  check('vehicles_condition_check', sql`${t.condition} in ('new','used')`), check('vehicles_data_json', sql`json_valid(${t.data})`)]);

export const slots = sqliteTable('slots', {
  id: text('id').primaryKey(), startsAt: text('starts_at').notNull(), endsAt: text('ends_at').notNull(),
  status: text('status').notNull().default('open'), createdAt: text('created_at').notNull(),
}, t => [uniqueIndex('slots_starts_at_unique').on(t.startsAt), check('slots_status_check', sql`${t.status} in ('open','closed')`)]);

export const enquiries = sqliteTable('enquiries', {
  id: text('id').primaryKey(), reference: text('reference').notNull(), vehicleId: text('vehicle_id').references(() => vehicles.id),
  vehicleLabel: text('vehicle_label').notNull(), customerName: text('customer_name').notNull(), email: text('email').notNull(), phone: text('phone').notNull().default(''),
  requestType: text('request_type').notNull(), preferredDate: text('preferred_date'), requestedSlotId: text('requested_slot_id').references(() => slots.id),
  message: text('message').notNull().default(''), consentAt: text('consent_at').notNull(), receiptTokenHash: text('receipt_token_hash').notNull(),
  idempotencyKey: text('idempotency_key').notNull(), payloadHash: text('payload_hash').notNull(), isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('new'), notes: text('notes').notNull().default(''), version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('enquiries_reference_unique').on(t.reference), uniqueIndex('enquiries_idempotency_unique').on(t.idempotencyKey),
  index('enquiries_status_created_idx').on(t.status, t.createdAt), check('enquiries_request_type_check', sql`${t.requestType} in ('test-drive','details','reservation')`),
  check('enquiries_status_check', sql`${t.status} in ('new','contacted','appointment-confirmed','closed','reserved','payment-review')`)]);

export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(), enquiryId: text('enquiry_id').notNull().references(() => enquiries.id), slotId: text('slot_id').notNull().references(() => slots.id),
  vehicleId: text('vehicle_id').references(() => vehicles.id), status: text('status').notNull().default('confirmed'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('appointments_one_confirmed_slot').on(t.slotId).where(sql`${t.status} = 'confirmed'`),
  uniqueIndex('appointments_one_confirmed_enquiry').on(t.enquiryId).where(sql`${t.status} = 'confirmed'`),
  check('appointments_status_check', sql`${t.status} in ('confirmed','cancelled','completed')`)]);

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(), reference: text('reference').notNull(), enquiryId: text('enquiry_id').notNull().references(() => enquiries.id),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id), amountKes: integer('amount_kes').notNull(), currency: text('currency').notNull().default('KES'),
  status: text('status').notNull().default('initiating'), checkoutUrl: text('checkout_url'), providerTransactionId: text('provider_transaction_id'),
  expiresAt: text('expires_at').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), verifiedAt: text('verified_at'),
}, t => [uniqueIndex('payments_reference_unique').on(t.reference), uniqueIndex('payments_provider_id_unique').on(t.providerTransactionId),
  uniqueIndex('payments_one_active_vehicle').on(t.vehicleId).where(sql`${t.status} in ('initiating','pending','paid')`),
  index('payments_enquiry_idx').on(t.enquiryId), check('payments_amount_check', sql`${t.amountKes} > 0`),
  check('payments_status_check', sql`${t.status} in ('initiating','pending','paid','review','failed','expired')`)]);

export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull(), updatedAt: text('updated_at').notNull() },
  t => [check('settings_valid_json', sql`json_valid(${t.value})`)]);
export const rateLimits = sqliteTable('rate_limits', { key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull() });
export const auditEvents = sqliteTable('audit_events', { id: text('id').primaryKey(), actorId: text('actor_id').notNull(), action: text('action').notNull(), targetId: text('target_id').notNull(), createdAt: text('created_at').notNull() });
