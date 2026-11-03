import type { Car } from '../src/data/cars.ts';
import { HttpError } from './security-core.ts';
import type { VehicleStatus } from './types.ts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Send a JSON object.', 'invalid_request');
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string, max = 250, required = false): string {
  if (value === undefined || value === null) { if (required) throw new HttpError(400, `${field} is required.`, 'invalid_request'); return ''; }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`, 'invalid_request');
  const result = value.trim();
  if (result.length > max || (required && !result)) throw new HttpError(400, `${field} must contain ${required ? '1' : '0'}–${max} characters.`, 'invalid_request');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) throw new HttpError(400, `${field} contains unsupported characters.`, 'invalid_request');
  return result;
}
export function number(value: unknown, field: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new HttpError(400, `${field} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`, 'invalid_request');
  return value;
}
export function choice<T extends string>(value: unknown, field: string, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new HttpError(400, `Choose a valid ${field}.`, 'invalid_request');
  return value as T;
}
export function bool(value: unknown, field: string): boolean { if (typeof value !== 'boolean') throw new HttpError(400, `${field} must be true or false.`, 'invalid_request'); return value; }
export function email(value: unknown, required = true): string {
  const result = text(value, 'Email', 254, required).toLowerCase();
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'Enter a valid email address.', 'invalid_request');
  return result;
}
export function imageUrl(value: unknown): string {
  const result = text(value, 'Image URL', 700, true);
  if (/^\/images\/[a-zA-Z0-9_.-]+\.(webp|png|jpg|jpeg)$/.test(result) || /^\/api\/media\/[a-zA-Z0-9_.-]+$/.test(result)) return result;
  try { const parsed = new URL(result); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && parsed.hostname && !['localhost','127.0.0.1','0.0.0.0','::1'].includes(parsed.hostname)) return parsed.href; } catch { /* Invalid image URL. */ }
  throw new HttpError(400, 'Use an uploaded image, a bundled image, or a secure HTTPS image URL.', 'invalid_request');
}
export function validateVehicle(input: unknown): { car: Omit<Car, 'id'>; status: VehicleStatus; condition: 'new' | 'used'; isDemo: boolean; stockNumber: string; version?: number; id?: string } {
  const v = object(input);
  const list = (value: unknown, field: string, maxItems: number, limit: number): string[] => {
    if (!Array.isArray(value) || value.length > maxItems) throw new HttpError(400, `${field} must be a list of up to ${maxItems} items.`, 'invalid_request');
    return [...new Set(value.map(item => text(item, field, limit, true)))];
  };
  const nullableNumber = (value: unknown, field: string, min: number, max: number) => value === null || value === undefined ? null : number(value, field, min, max);
  const gallery = list(v.gallery ?? [], 'Gallery', 16, 700).map(imageUrl);
  const colorHex = text(v.colorHex, 'Colour swatch', 7, true);
  if (!/^#[0-9a-f]{6}$/i.test(colorHex)) throw new HttpError(400, 'Colour swatch must be a six-digit hex colour.', 'invalid_request');
  const image = imageUrl(v.image);
  const stockNumber = text(v.stockNumber, 'Stock number', 40, true).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_.-]*$/.test(stockNumber)) throw new HttpError(400, 'Stock number may contain letters, numbers, dots, dashes and underscores.', 'invalid_request');
  const currentYear = new Date().getUTCFullYear();
  return {
    car: {
      brand:text(v.brand,'Brand',60,true), model:text(v.model,'Model',100,true), year:number(v.year,'Model year',1950,currentYear+1,true),
      price:number(v.price,'Price',1,1000000000,true), bodyType:choice(v.bodyType,'body type',['Coupe','SUV','Sedan']), fuel:choice(v.fuel,'powertrain',['Petrol','Diesel','Electric','Hybrid']),
      transmission:text(v.transmission,'Transmission',80,true), drivetrain:text(v.drivetrain,'Drivetrain',80,true), mileage:number(v.mileage,'Mileage',0,5000000,true),
      power:number(v.power,'Power',1,3000), acceleration:nullableNumber(v.acceleration,'Acceleration',0.1,120), topSpeed:nullableNumber(v.topSpeed,'Top speed',1,600),
      engine:text(v.engine,'Engine',120,true), color:text(v.color,'Colour',60,true), colorHex, seats:number(v.seats,'Seats',1,20,true),
      tagline:text(v.tagline,'Tagline',220), description:text(v.description,'Description',4000), features:list(v.features ?? [],'Features',30,160),
      image, imageAlt:text(v.imageAlt,'Image description',250,true), gallery:gallery.length ? gallery : [image], featured:bool(v.featured ?? false,'Featured'),
      ...(v.badge ? {badge:text(v.badge,'Badge',50)} : {}), ...(v.powerNote ? {powerNote:text(v.powerNote,'Power note',250)} : {}), ...(v.imageNote ? {imageNote:text(v.imageNote,'Photo note',500)} : {}),
    },
    status:choice(v.status ?? 'draft','stock status',['available','reserved','sold','draft','archived']), condition:choice(v.condition ?? 'used','condition',['new','used']),
    isDemo:bool(v.isDemo ?? false,'Demo listing'), stockNumber,
    ...(v.version !== undefined ? {version:number(v.version,'Version',1,Number.MAX_SAFE_INTEGER,true)} : {}),
    ...(v.id !== undefined ? {id:text(v.id,'Vehicle id',80,true)} : {}),
  };
}
export interface EnquiryInput {vehicleId:string|null;name:string;email:string;phone:string;requestType:'test-drive'|'details'|'reservation';slotId:string|null;preferredDate:string|null;message:string;idempotencyKey:string;}
export function validateEnquiry(input: unknown): EnquiryInput {
  const v = object(input);
  if (text(v.website,'Website',250)) throw new HttpError(400, 'We could not accept this request.', 'invalid_request');
  if (v.consent !== true) throw new HttpError(400, 'Consent is required to process your enquiry.', 'consent_required');
  const idempotencyKey = text(v.idempotencyKey,'Request identifier',80,true);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) throw new HttpError(400, 'A valid request identifier is required.', 'invalid_request');
  const phone = text(v.phone,'Phone',32);
  if (phone && !/^\+?[\d ()-]{7,32}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number.', 'invalid_request');
  const preferredDate = text(v.preferredDate,'Preferred date',10) || null;
  if (preferredDate) {
    const parsed = new Date(`${preferredDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== preferredDate) throw new HttpError(400, 'Choose a valid preferred date.', 'invalid_request');
  }
  return {vehicleId:text(v.vehicleId,'Vehicle',80)||null,name:text(v.name,'Name',100,true),email:email(v.email),phone,
    requestType:choice(v.requestType,'request type',['test-drive','details','reservation']),slotId:text(v.slotId,'Slot',80)||null,preferredDate,message:text(v.message,'Message',2000),idempotencyKey};
}
