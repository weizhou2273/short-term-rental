/**
 * Money is carried in minor units (cents) everywhere inside the app. Floating
 * point dollars are only ever produced at the edges: when talking to OwnerRez,
 * which quotes decimal amounts, and when formatting for display.
 */

export type Money = {
  /** Integer minor units, e.g. 129_50 for $129.50. */
  amount: number;
  /** ISO 4217, upper case. */
  currency: string;
};

export function money(amount: number, currency = 'USD'): Money {
  return { amount: Math.round(amount), currency: currency.toUpperCase() };
}

/** Convert a decimal major-unit amount (as OwnerRez returns) to minor units. */
export function fromMajorUnits(value: number, currency = 'USD'): Money {
  return money(Math.round(value * 100), currency);
}

export function toMajorUnits(value: Money): number {
  return value.amount / 100;
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function sumMoney(values: Money[], currency = 'USD'): Money {
  return values.reduce((acc, value) => addMoney(acc, value), money(0, currency));
}

export function multiplyMoney(value: Money, factor: number): Money {
  return money(value.amount * factor, value.currency);
}

/** Percentage of an amount, rounded half-up to the nearest minor unit. */
export function percentOf(value: Money, percent: number): Money {
  return money((value.amount * percent) / 100, value.currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Cannot combine ${a.currency} with ${b.currency}`);
  }
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatMoney(value: Money): string {
  return formatterFor(value.currency, 2).format(toMajorUnits(value));
}

/** Drops the cents when the amount is whole — nightly rates read better as "$650". */
export function formatMoneyCompact(value: Money): string {
  const whole = value.amount % 100 === 0;
  return formatterFor(value.currency, whole ? 0 : 2).format(toMajorUnits(value));
}
