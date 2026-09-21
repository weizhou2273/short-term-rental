import type { GuestCount, Property, Quote, QuoteLine } from './types';
import {
  addDays,
  dayOfWeek,
  nightsBetween,
  nightsInRange,
  parseIsoDate,
  type IsoDate,
} from '@/lib/util/date';
import { formatMoneyCompact, money, percentOf, sumMoney, type Money } from '@/lib/util/money';

/**
 * Local rate and quote engine.
 *
 * OwnerRez is authoritative for pricing once credentials are configured — this
 * engine exists for two jobs:
 *
 *  1. Rendering the demo portfolio with plausible, *deterministic* rates.
 *  2. Producing an "estimated" quote when OwnerRez is unreachable, so the
 *     calendar still shows a number instead of an error. Estimated quotes are
 *     flagged (`estimated: true`) and are never used to charge a card — the
 *     checkout route re-quotes against OwnerRez before taking payment.
 *
 * Determinism matters: an ISR-rendered page and a client hydration must agree,
 * so every multiplier is a pure function of the date and the property id.
 */

export type PricingPolicy = {
  /** Cleaning fee charged once per stay. */
  cleaningFee: Money;
  /** Per-stay pet fee, charged per pet. */
  petFee: Money;
  /** Combined lodging + sales tax, as a percentage of the taxable subtotal. */
  taxPercent: number;
  /** Refundable damage hold. */
  securityDeposit: Money;
  /** Percent of the total taken at booking; the rest is due before arrival. */
  depositPercent: number;
  /** Days before arrival that the balance falls due. */
  balanceDueDaysBeforeArrival: number;
  /** Weekly and monthly length-of-stay discounts, as percentages. */
  weeklyDiscountPercent: number;
  monthlyDiscountPercent: number;
};

export const defaultPricingPolicy: PricingPolicy = {
  cleaningFee: money(35_000),
  petFee: money(12_500),
  taxPercent: 11.5,
  securityDeposit: money(100_000),
  depositPercent: 50,
  balanceDueDaysBeforeArrival: 30,
  weeklyDiscountPercent: 10,
  monthlyDiscountPercent: 22,
};

/** Small stable hash so per-property variation is repeatable across processes. */
function hash(value: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return (h >>> 0) / 2 ** 32;
}

/** Peak autumn and midsummer carry a premium; late winter is the trough. */
function seasonMultiplier(date: IsoDate): number {
  const month = parseIsoDate(date).getUTCMonth(); // 0-indexed
  const byMonth = [0.82, 0.8, 0.88, 0.95, 1.02, 1.12, 1.18, 1.18, 1.08, 1.22, 0.96, 1.1];
  return byMonth[month] ?? 1;
}

function weekendMultiplier(date: IsoDate): number {
  const day = dayOfWeek(date);
  if (day === 5 || day === 6) return 1.25; // Friday, Saturday
  if (day === 4 || day === 0) return 1.08; // Thursday, Sunday
  return 1;
}

/**
 * The nightly rate a property would ask for a given date. Exported because the
 * availability calendar paints it on every cell.
 */
export function nightlyRate(property: Property, date: IsoDate): Money {
  const base = property.baseNightlyRate ?? money(45_000, property.currency);
  const jitter = 0.96 + hash(`${property.id}:${date}`) * 0.08; // ±4%, stable
  const raw = base.amount * seasonMultiplier(date) * weekendMultiplier(date) * jitter;
  // Round to the nearest $5 so displayed rates look set, not computed.
  return money(Math.round(raw / 500) * 500, property.currency);
}

export function accommodationTotal(
  property: Property,
  arrival: IsoDate,
  departure: IsoDate,
): Money {
  const nights = nightsInRange(arrival, departure);
  return sumMoney(
    nights.map((date) => nightlyRate(property, date)),
    property.currency,
  );
}

/** Lowest nightly rate over a forward window, for "from $X / night" display. */
export function lowestNightlyRate(property: Property, days = 180): Money {
  const start = new Date().toISOString().slice(0, 10);
  let lowest: Money | null = null;
  for (let i = 0; i < days; i += 1) {
    const rate = nightlyRate(property, addDays(start, i));
    if (!lowest || rate.amount < lowest.amount) lowest = rate;
  }
  return lowest ?? money(0, property.currency);
}

function lengthOfStayDiscount(
  nights: number,
  accommodation: Money,
  policy: PricingPolicy,
): QuoteLine | null {
  const percent =
    nights >= 28
      ? policy.monthlyDiscountPercent
      : nights >= 7
        ? policy.weeklyDiscountPercent
        : 0;
  if (percent === 0) return null;
  return {
    kind: 'discount',
    label: nights >= 28 ? 'Monthly stay discount' : 'Weekly stay discount',
    // Discounts are negative so every line sums directly into the total.
    amount: money(-percentOf(accommodation, percent).amount, accommodation.currency),
    detail: `${percent}% off the nightly rate`,
  };
}

export type QuoteInput = {
  property: Property;
  arrival: IsoDate;
  departure: IsoDate;
  guests: GuestCount;
  policy?: PricingPolicy;
};

/**
 * Builds a complete, itemised quote. Lines are ordered the way a guest reads a
 * receipt: what the house costs, what is taken off, what is added on, then tax.
 */
export function buildQuote(input: QuoteInput): Quote {
  const { property, arrival, departure, guests } = input;
  const policy = input.policy ?? defaultPricingPolicy;
  const currency = property.currency;
  const nights = nightsBetween(arrival, departure);

  if (nights <= 0) {
    throw new RangeError('Departure must be at least one night after arrival.');
  }

  const accommodation = accommodationTotal(property, arrival, departure);
  const averageNightly = money(Math.round(accommodation.amount / nights), currency);

  const lines: QuoteLine[] = [
    {
      kind: 'accommodation',
      label: `${formatMoneyCompact(averageNightly)} × ${nights} ${nights === 1 ? 'night' : 'nights'}`,
      amount: accommodation,
      detail: 'Average nightly rate across your dates',
    },
  ];

  const discount = lengthOfStayDiscount(nights, accommodation, policy);
  if (discount) lines.push(discount);

  const subtotal = money(
    accommodation.amount + (discount?.amount.amount ?? 0),
    currency,
  );

  lines.push({
    kind: 'fee',
    label: 'Cleaning & turnover',
    amount: policy.cleaningFee,
    detail: 'Charged once per stay',
  });

  if (guests.pets > 0 && property.rules.petsAllowed) {
    lines.push({
      kind: 'fee',
      label: `Pet fee × ${guests.pets}`,
      amount: money(policy.petFee.amount * guests.pets, currency),
      detail: 'Covers the additional turnover',
    });
  }

  const taxable = money(
    subtotal.amount +
      lines
        .filter((line) => line.kind === 'fee')
        .reduce((sum, line) => sum + line.amount.amount, 0),
    currency,
  );
  const tax = percentOf(taxable, policy.taxPercent);
  lines.push({
    kind: 'tax',
    label: 'Lodging & sales tax',
    amount: tax,
    detail: `${policy.taxPercent}% as required by ${property.location.region || 'the state'}`,
  });

  const total = money(taxable.amount + tax.amount, currency);

  // Stays inside the balance window are charged in full at booking; anything
  // further out takes a deposit now and the balance before arrival.
  const balanceDueDate = addDays(arrival, -policy.balanceDueDaysBeforeArrival);
  const takeFullPayment = balanceDueDate <= new Date().toISOString().slice(0, 10);
  const dueNow = takeFullPayment ? total : percentOf(total, policy.depositPercent);
  const balance = takeFullPayment ? null : money(total.amount - dueNow.amount, currency);

  return {
    propertyId: property.id,
    arrival,
    departure,
    nights,
    guests,
    currency,
    lines,
    subtotal,
    total,
    securityDeposit: policy.securityDeposit,
    schedule: {
      dueNow,
      balance,
      balanceDueDate: balance ? balanceDueDate : null,
    },
    estimated: true,
  };
}
