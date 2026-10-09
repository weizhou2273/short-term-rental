import 'server-only';
import { z } from 'zod';
import { hospitableFetch } from './client';
import { nightsBetween } from '@/lib/dates';
import type { MoneyLine, Quote } from '@/lib/booking/types';

/**
 * POST /properties/{uuid}/quote — Hospitable's "create quote" for a Direct
 * stay. Hospitable applies pricing, promotions, occupancy and availability
 * rules, and returns a `booking_url` to its hosted checkout. Guests pay there;
 * this site never handles card data.
 */

export type GuestCounts = {
  adults: number;
  children?: number;
  infants?: number;
  pets?: number;
};

export type QuoteInput = {
  propertyUuid: string;
  checkin: string;
  checkout: string;
  guests: GuestCounts;
  customSiteId: string;
};

const amountLine = z.object({
  amount: z.number(),
  label: z.string().optional(),
});

const quoteResponse = z.object({
  data: z.object({
    quote_id: z.string(),
    booking_url: z.string(),
    currency: z.string().default('USD'),
    financials: z.object({
      fees: z.array(amountLine).default([]),
      taxes: z.array(amountLine).default([]),
      discounts: z.array(amountLine).default([]),
      totals: z.object({
        sub_total: z.object({ amount: z.number() }),
        total: z.object({ amount: z.number() }),
      }),
    }),
  }),
});

/** Hosts we will send a guest to. Anything else is refused rather than redirected to. */
const CHECKOUT_HOSTS = ['booking.hospitable.com'];

export function isTrustedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && CHECKOUT_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

export class UntrustedCheckoutUrlError extends Error {
  constructor() {
    super('Hospitable returned a booking_url outside the allowed checkout hosts.');
    this.name = 'UntrustedCheckoutUrlError';
  }
}

const toLines = (lines: z.infer<typeof amountLine>[], fallback: string): MoneyLine[] =>
  lines.map((l) => ({ label: l.label || fallback, amount: Math.round(l.amount) }));

export function normalizeQuote(raw: unknown, checkin: string, checkout: string): Quote {
  const { data } = quoteResponse.parse(raw);
  if (!isTrustedCheckoutUrl(data.booking_url)) throw new UntrustedCheckoutUrlError();
  const { financials } = data;
  const taxes = toLines(financials.taxes, 'Tax');
  const total = Math.round(financials.totals.total.amount);
  return {
    quoteId: data.quote_id,
    bookingUrl: data.booking_url,
    currency: data.currency,
    nights: nightsBetween(checkin, checkout),
    accommodation: Math.round(financials.totals.sub_total.amount),
    // A $0 "Service fee" line is Hospitable saying there is none; the card
    // says that in words instead of showing a zero.
    fees: toLines(financials.fees, 'Fee').filter((f) => f.amount !== 0),
    discounts: toLines(financials.discounts, 'Discount').filter((d) => d.amount !== 0),
    taxes,
    total,
    totalBeforeTaxes: total - taxes.reduce((sum, t) => sum + t.amount, 0),
  };
}

export async function createQuote(input: QuoteInput): Promise<Quote> {
  const { adults, children, infants, pets } = input.guests;
  const raw = await hospitableFetch<unknown>(
    `/properties/${encodeURIComponent(input.propertyUuid)}/quote`,
    {
      method: 'POST',
      body: {
        checkin_date: input.checkin,
        checkout_date: input.checkout,
        guests: {
          adults,
          ...(children ? { children } : {}),
          ...(infants ? { infants } : {}),
          ...(pets ? { pets } : {}),
        },
        custom_site_id: input.customSiteId,
      },
    },
  );
  return normalizeQuote(raw, input.checkin, input.checkout);
}
