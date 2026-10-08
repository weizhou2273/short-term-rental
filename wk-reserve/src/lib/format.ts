import type { Property } from '@/data/types';

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const specs = (p: Property) =>
  [plural(p.guests, 'guest'), plural(p.bedrooms, 'bedroom'), plural(p.beds, 'bed'), plural(p.baths, 'bath')].join(', ');

/** Formats integer cents. */
export function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Whole-dollar price for cards and pins. */
export function wholeDollars(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}
