import assert from 'node:assert/strict';
import test from 'node:test';
import { cars } from '../data/cars.ts';
import { calculateFinance, filterCars, formatMileage, formatPrice } from './catalog.ts';

test('search matches multiple words, ignores case and combines with other controls', () => {
  const matches = filterCars(cars, { query: '  PORSCHE  4s ', fuel: 'Electric', maxPrice: 16000000 });
  assert.deepEqual(matches.map((car) => car.id), ['porsche-taycan']);
  assert.equal(filterCars(cars, { query: 'Porsche', fuel: 'Diesel' }).length, 0);
});

test('category, budget and saved-only filters apply together including exact budget', () => {
  const price = cars.find((car) => car.id === 'bmw-m4-competition')!.price;
  assert.deepEqual(filterCars(cars, { bodyType: 'Coupe', maxPrice: price, savedOnly: true, savedIds: ['bmw-m4-competition'] }).map((car) => car.id), ['bmw-m4-competition']);
  assert.equal(filterCars(cars, { savedOnly: true }).length, 0);
  assert.equal(filterCars(cars, { maxPrice: 0 }).length, 0);
});

test('sorting does not mutate inventory and all controls preserve complete inventory', () => {
  const originalOrder = cars.map((car) => car.id);
  const sorted = filterCars(cars, { sort: 'price-asc' });
  assert.ok(sorted.every((car, index) => index === 0 || car.price >= sorted[index - 1].price));
  assert.deepEqual(cars.map((car) => car.id), originalOrder);
  assert.equal(filterCars(cars, { brand: 'All brands', bodyType: 'All', fuel: 'All fuel types' }).length, cars.length);
});

test('zero-interest finance preserves the purchase price exactly', () => {
  const result = calculateFinance(1200000, 20, 0, 60);
  assert.equal(result.deposit, 240000);
  assert.equal(result.loan, 960000);
  assert.equal(result.payment, 16000);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalPayable, 1200000);
});

test('amortised finance matches an independent loan example', () => {
  const result = calculateFinance(100000, 0, 12, 12);
  assert.ok(Math.abs(result.payment - 8884.878867834168) < 0.00001);
  assert.ok(Math.abs(result.totalPayable - 106618.54641401002) < 0.0001);
  assert.ok(Math.abs(result.totalInterest - 6618.54641401002) < 0.0001);
});

test('full deposits and zero-price vehicles produce no financing cost', () => {
  assert.deepEqual(calculateFinance(1000000, 100, 18, 60), { payment: 0, deposit: 1000000, loan: 0, totalInterest: 0, totalPayable: 1000000 });
  assert.deepEqual(calculateFinance(0, 20, 18, 60), { payment: 0, deposit: 0, loan: 0, totalInterest: 0, totalPayable: 0 });
});

test('invalid finance values are rejected rather than displaying nonsense', () => {
  for (const args of [[-1, 20, 12, 60], [1, 101, 12, 60], [1, 20, -1, 60], [1, 20, 12, 0], [1, 20, 12, 1.5], [NaN, 20, 12, 60], [1, 20, Infinity, 60]]) {
    assert.throws(() => calculateFinance(args[0], args[1], args[2], args[3]), RangeError);
  }
});

test('local currency and mileage formatting is readable', () => {
  assert.equal(formatPrice(28900000), 'KSh 28,900,000');
  assert.equal(formatPrice(14950000, true), 'KSh 14.95M');
  assert.equal(formatMileage(12400), '12,400 km');
  assert.equal(formatPrice(NaN), 'Price on request');
});
