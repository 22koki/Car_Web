import type { Car } from '../data/cars';

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
export type InventoryMode = 'demo' | 'live' | 'mixed';
export interface InventoryResponse { vehicles: Vehicle[]; mode: InventoryMode; total: number }
export interface Session { authenticated: boolean; staff: boolean; displayName: string; email?: string }
export interface DealerConfig {
  dealer: { name: string; location: string; phone: string; email: string; whatsapp: string; timezone: string };
  payments: { enabled: boolean; provider: 'flutterwave'; currency: 'KES'; depositKES: number };
  enquiriesEnabled: boolean;
}
export interface AppointmentSlot { id: string; startsAt: string; endsAt: string; status: 'open' | 'closed'; createdAt?: string }
export type EnquiryStatus = 'new' | 'contacted' | 'appointment-confirmed' | 'closed' | 'reserved' | 'payment-review';
export interface Enquiry {
  id: string; reference: string; vehicleId: string | null; vehicleLabel?: string;
  name: string; email: string; phone: string; requestType: 'test-drive' | 'details' | 'reservation';
  slotId: string | null; preferredDate: string | null; message: string; status: EnquiryStatus;
  notes: string; isDemo: boolean; version: number; createdAt: string; updatedAt: string;
  payment?: { reference: string; status: 'initiating' | 'pending' | 'paid' | 'review' | 'failed' | 'expired'; amountKES: number; currency: 'KES'; verifiedAt: string | null; createdAt: string } | null;
}
export interface EnquiryReceipt { id: string; reference: string; receiptToken: string; status: EnquiryStatus; isDemo: boolean; message?: string }
export interface Appointment {
  id: string; enquiryId: string; slotId: string; vehicleId: string | null;
  reference: string; customerName: string; vehicleLabel: string;
  startsAt: string; endsAt: string; status: 'confirmed' | 'cancelled' | 'completed'; createdAt: string;
}
