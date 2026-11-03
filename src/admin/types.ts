import type { Enquiry } from '../types/dealership';

export type {
  Vehicle as AdminVehicle, VehicleStatus, EnquiryStatus,
  AppointmentSlot, Appointment, DealerConfig as DealerSettings, Session as StaffSession,
} from '../types/dealership';
export type AdminEnquiry = Enquiry & {
  payment?: {
    reference: string;
    status: string;
    amountKES: number;
    currency: string;
    verifiedAt: string | null;
    createdAt: string;
  } | null;
};
export type AdminTab = 'overview' | 'vehicles' | 'enquiries' | 'appointments' | 'settings';
