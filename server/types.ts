import type { Car } from '../src/data/cars.ts';

export type VehicleStatus = 'available' | 'reserved' | 'sold' | 'draft' | 'archived';
export interface Vehicle extends Car {
  status: VehicleStatus;
  condition: 'new' | 'used';
  isDemo: boolean;
  stockNumber: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type SqlValue = string | number | null;
export interface SqlResult<T = Record<string, unknown>> { results?: T[]; success?: boolean; meta: { changes?: number; [key: string]: unknown }; }
export interface SqlStatement {
  bind(...values: SqlValue[]): SqlStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
  run<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
}
export interface SqlDatabase { prepare(sql: string): SqlStatement; batch<T = Record<string, unknown>>(statements: SqlStatement[]): Promise<SqlResult<T>[]>; }
export interface Actor { id: string; email: string; displayName: string; method: 'chatgpt' | 'service'; }
export interface DealerEnvironment {
  DB: SqlDatabase;
  PRIVATE_API_KEY?: string;
  SITE_URL?: string;
  FLW_SECRET_KEY?: string;
  FLW_WEBHOOK_SECRET?: string;
  FLW_WEBHOOK_SIGNATURE_MODE?: string;
}
export interface VehicleRow {
  id: string; stock_number: string; data: string; status: VehicleStatus; condition: 'new' | 'used'; is_demo: number;
  version: number; created_at: string; updated_at: string; payment_hold_id: string | null; hold_expires_at: string | null; reserved_payment_id: string | null;
}
export interface EnquiryRow {
  id: string; reference: string; vehicle_id: string | null; vehicle_label: string; customer_name: string; email: string; phone: string;
  request_type: 'test-drive' | 'details' | 'reservation'; preferred_date: string | null; requested_slot_id: string | null; message: string;
  consent_at: string; receipt_token_hash: string; idempotency_key: string; payload_hash: string; is_demo: number;
  status: string; notes: string; version: number; created_at: string; updated_at: string;
}
export interface SlotRow { id: string; starts_at: string; ends_at: string; status: 'open' | 'closed'; created_at: string; }
export interface PaymentRow {
  id: string; reference: string; enquiry_id: string; vehicle_id: string; amount_kes: number; currency: string;
  status: 'initiating' | 'pending' | 'paid' | 'review' | 'failed' | 'expired'; checkout_url: string | null;
  provider_transaction_id: string | null; expires_at: string; created_at: string; updated_at: string; verified_at: string | null;
}
