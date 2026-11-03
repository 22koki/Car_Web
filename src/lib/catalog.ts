import type { Car } from '../data/cars.ts';

export type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'mileage-asc';

export interface CatalogFilters {
  query?: string;
  brand?: string;
  bodyType?: string;
  fuel?: string;
  maxPrice?: number;
  sort?: CatalogSort | string;
  savedOnly?: boolean;
  savedIds?: readonly string[];
}

const isAll = (value: string | undefined) => !value || ['all', 'all brands', 'all types', 'all fuel types'].includes(value.toLowerCase());

/** Apply all controls together without mutating the original inventory. */
export function filterCars(inventory: readonly Car[], filters: CatalogFilters = {}): Car[] {
  const query = (filters.query ?? '').trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const savedIds = new Set(filters.savedIds ?? []);
  const result = inventory.filter((car) => {
    const searchable = `${car.brand} ${car.model} ${car.year} ${car.bodyType} ${car.fuel} ${car.color} ${car.engine}`.toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term))
      && (isAll(filters.brand) || car.brand.toLocaleLowerCase() === filters.brand!.toLocaleLowerCase())
      && (isAll(filters.bodyType) || car.bodyType.toLocaleLowerCase() === filters.bodyType!.toLocaleLowerCase())
      && (isAll(filters.fuel) || car.fuel.toLocaleLowerCase() === filters.fuel!.toLocaleLowerCase())
      && (filters.maxPrice === undefined || !Number.isFinite(filters.maxPrice) || car.price <= filters.maxPrice)
      && (!filters.savedOnly || savedIds.has(car.id));
  });
  switch (filters.sort) {
    case 'price-asc': return result.sort((a, b) => a.price - b.price);
    case 'price-desc': return result.sort((a, b) => b.price - a.price);
    case 'newest': return result.sort((a, b) => b.year - a.year || a.mileage - b.mileage);
    case 'mileage-asc': return result.sort((a, b) => a.mileage - b.mileage);
    default: return result.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

const priceFormatter = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

export function formatPrice(value: number, compact = false): string {
  if (!Number.isFinite(value)) return 'Price on request';
  if (compact && Math.abs(value) >= 1000000) {
    return `KSh ${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value / 1000000)}M`;
  }
  return `KSh ${priceFormatter.format(value)}`;
}

export function formatMileage(value: number): string {
  return `${priceFormatter.format(Math.max(0, Number.isFinite(value) ? value : 0))} km`;
}

export interface FinanceEstimate {
  payment: number;
  deposit: number;
  loan: number;
  totalInterest: number;
  /** Deposit plus all repayments; excludes fees, taxes and insurance. */
  totalPayable: number;
}

/**
 * Fixed-rate amortisation estimate with monthly repayments.
 * Inputs are percentages (20 means 20%) and a whole-number month count.
 * Not a lender offer; no credit or eligibility decision is made here.
 */
export function calculateFinance(price: number, depositPercent: number, annualRate: number, months: number): FinanceEstimate {
  if (![price, depositPercent, annualRate, months].every(Number.isFinite)) throw new RangeError('Finance inputs must be finite numbers.');
  if (price < 0 || depositPercent < 0 || depositPercent > 100 || annualRate < 0 || months < 1 || !Number.isInteger(months)) {
    throw new RangeError('Use a non-negative price and rate, a 0–100% deposit, and a positive whole-number term.');
  }
  const deposit = price * depositPercent / 100;
  const loan = price - deposit;
  const monthlyRate = annualRate / 1200;
  // log1p/expm1 avoid cancellation for very small positive interest rates.
  const payment = loan === 0 ? 0 : monthlyRate === 0 ? loan / months : loan * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
  const totalInterest = Math.max(0, payment * months - loan);
  return { payment, deposit, loan, totalInterest, totalPayable: deposit + payment * months };
}
