import { describe, expect, it } from 'vitest';
import { accommodationTotal, buildQuote, defaultPricingPolicy, nightlyRate } from '@/lib/booking/pricing';
import type { Property } from '@/lib/booking/types';
import { demoProperties } from '@/lib/demo/properties';
import { addDays, today } from '@/lib/util/date';
import { money } from '@/lib/util/money';

const property = demoProperties[0]!;

/** A stay far enough out that the deposit split applies. */
const arrival = addDays(today(), 120);
const departure = addDays(arrival, 3);
const guests = { adults: 2, children: 0, infants: 0, pets: 0 };

describe('nightlyRate', () => {
  it('is deterministic — server and client must agree', () => {
    const a = nightlyRate(property, '2026-07-04');
    const b = nightlyRate(property, '2026-07-04');
    expect(a).toEqual(b);
  });

  it('varies by property', () => {
    const other = demoProperties[2]!;
    expect(nightlyRate(property, '2026-07-04')).not.toEqual(nightlyRate(other, '2026-07-04'));
  });

  it('charges more for a Saturday than the Tuesday before it', () => {
    // 2026-07-04 is a Saturday; 2026-06-30 is a Tuesday.
    expect(nightlyRate(property, '2026-07-04').amount).toBeGreaterThan(
      nightlyRate(property, '2026-06-30').amount,
    );
  });

  it('rounds to a presentable figure', () => {
    expect(nightlyRate(property, '2026-07-04').amount % 500).toBe(0);
  });
});

describe('accommodationTotal', () => {
  it('sums the nights actually slept in', () => {
    const total = accommodationTotal(property, '2026-07-01', '2026-07-04');
    const expected =
      nightlyRate(property, '2026-07-01').amount +
      nightlyRate(property, '2026-07-02').amount +
      nightlyRate(property, '2026-07-03').amount;
    expect(total.amount).toBe(expected);
  });
});

describe('buildQuote', () => {
  it('produces lines that sum exactly to the total', () => {
    const quote = buildQuote({ property, arrival, departure, guests });
    const sum = quote.lines.reduce((acc, line) => acc + line.amount.amount, 0);
    expect(sum).toBe(quote.total.amount);
  });

  it('excludes the refundable deposit from the total', () => {
    const quote = buildQuote({ property, arrival, departure, guests });
    expect(quote.securityDeposit).not.toBeNull();
    expect(quote.total.amount).toBeLessThan(
      quote.total.amount + quote.securityDeposit!.amount,
    );
    expect(quote.lines.some((line) => line.kind === 'deposit')).toBe(false);
  });

  it('splits payment when the stay is beyond the balance window', () => {
    const quote = buildQuote({ property, arrival, departure, guests });
    expect(quote.schedule.balance).not.toBeNull();
    expect(quote.schedule.dueNow.amount + quote.schedule.balance!.amount).toBe(
      quote.total.amount,
    );
    expect(quote.schedule.balanceDueDate).toBe(
      addDays(arrival, -defaultPricingPolicy.balanceDueDaysBeforeArrival),
    );
  });

  it('takes the whole amount when arrival is inside the balance window', () => {
    const soon = addDays(today(), 5);
    const quote = buildQuote({
      property,
      arrival: soon,
      departure: addDays(soon, 3),
      guests,
    });
    expect(quote.schedule.balance).toBeNull();
    expect(quote.schedule.dueNow).toEqual(quote.total);
  });

  it('applies a weekly discount as a negative line', () => {
    const quote = buildQuote({ property, arrival, departure: addDays(arrival, 7), guests });
    const discount = quote.lines.find((line) => line.kind === 'discount');
    expect(discount).toBeDefined();
    expect(discount!.amount.amount).toBeLessThan(0);
    expect(quote.subtotal.amount).toBeLessThan(
      accommodationTotal(property, arrival, addDays(arrival, 7)).amount,
    );
  });

  it('prefers the monthly discount for a long stay', () => {
    const weekly = buildQuote({ property, arrival, departure: addDays(arrival, 7), guests });
    const monthly = buildQuote({ property, arrival, departure: addDays(arrival, 30), guests });
    expect(weekly.lines.find((l) => l.kind === 'discount')!.label).toContain('Weekly');
    expect(monthly.lines.find((l) => l.kind === 'discount')!.label).toContain('Monthly');
  });

  it('adds no discount for a short stay', () => {
    const quote = buildQuote({ property, arrival, departure, guests });
    expect(quote.lines.some((line) => line.kind === 'discount')).toBe(false);
  });

  it('charges a pet fee only where pets are allowed', () => {
    const withPets = buildQuote({
      property,
      arrival,
      departure,
      guests: { ...guests, pets: 2 },
    });
    expect(withPets.lines.some((line) => line.label.startsWith('Pet fee'))).toBe(true);

    const noPets: Property = {
      ...property,
      rules: { ...property.rules, petsAllowed: false },
    };
    const quote = buildQuote({
      property: noPets,
      arrival,
      departure,
      guests: { ...guests, pets: 2 },
    });
    expect(quote.lines.some((line) => line.label.startsWith('Pet fee'))).toBe(false);
  });

  it('taxes fees as well as accommodation', () => {
    const quote = buildQuote({ property, arrival, departure, guests });
    const taxable =
      quote.subtotal.amount +
      quote.lines
        .filter((line) => line.kind === 'fee')
        .reduce((sum, line) => sum + line.amount.amount, 0);
    const tax = quote.lines.find((line) => line.kind === 'tax')!;
    expect(tax.amount.amount).toBe(
      Math.round((taxable * defaultPricingPolicy.taxPercent) / 100),
    );
  });

  it('honours a custom pricing policy', () => {
    const quote = buildQuote({
      property,
      arrival,
      departure,
      guests,
      policy: { ...defaultPricingPolicy, cleaningFee: money(0), taxPercent: 0 },
    });
    expect(quote.lines.some((line) => line.label === 'Cleaning & turnover')).toBe(true);
    expect(quote.lines.find((line) => line.kind === 'tax')!.amount.amount).toBe(0);
  });

  it('refuses a zero-night stay', () => {
    expect(() => buildQuote({ property, arrival, departure: arrival, guests })).toThrow(
      RangeError,
    );
  });

  it('marks every local quote as an estimate', () => {
    expect(buildQuote({ property, arrival, departure, guests }).estimated).toBe(true);
  });
});
