import 'server-only';
import { z } from 'zod';
import { hospitableFetch } from './client';
import { getPropertyByUuid } from '@/data/properties';
import type { SearchResult } from '@/lib/booking/types';
import type { GuestCounts } from './quote';

/**
 * GET /properties/search — availability and pre-tax totals for every property
 * on the account for one stay window. Results are filtered to the properties
 * this site lists, keyed by slug, so the browser never sees other UUIDs.
 */

// Hospitable sends the daily price as a decimal and total_without_taxes as a
// string of cents ("97229" = $972.29). Both are accepted as either type.
const numeric = z.union([z.number(), z.string()]).transform((v) => Number(v));

const searchResponse = z.object({
  data: z.array(
    z.object({
      property: z.object({ id: z.string() }),
      availability: z.object({ available: z.boolean() }).nullish(),
      pricing: z
        .object({
          daily: z
            .array(
              z.object({
                price: z.object({ amount_minor: numeric.optional(), currency: z.string().optional() }).nullish(),
              }),
            )
            .nullish(),
          total_without_taxes: z.object({ amount: numeric, currency: z.string().optional() }).nullish(),
        })
        .nullish(),
    }),
  ),
});

export type SearchInput = { checkin: string; checkout: string; guests: GuestCounts };

export function normalizeSearch(raw: unknown): SearchResult[] {
  const { data } = searchResponse.parse(raw);
  const results: SearchResult[] = [];
  for (const row of data) {
    const property = getPropertyByUuid(row.property.id);
    if (!property) continue;

    const daily = (row.pricing?.daily ?? [])
      .map((d) => d.price?.amount_minor)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    const total = row.pricing?.total_without_taxes?.amount;

    results.push({
      slug: property.slug,
      available: row.availability?.available ?? false,
      totalWithoutTaxes: typeof total === 'number' && Number.isFinite(total) ? Math.round(total) : null,
      nightlyAverage: daily.length ? Math.round(daily.reduce((a, b) => a + b, 0) / daily.length) : null,
      currency: row.pricing?.total_without_taxes?.currency ?? 'USD',
    });
  }
  return results;
}

export async function searchProperties({ checkin, checkout, guests }: SearchInput): Promise<SearchResult[]> {
  const raw = await hospitableFetch<unknown>('/properties/search', {
    query: {
      start_date: checkin,
      end_date: checkout,
      adults: guests.adults,
      children: guests.children || undefined,
      infants: guests.infants || undefined,
      pets: guests.pets || undefined,
    },
    // Availability moves when an OTA books; keep this short.
    revalidate: 60,
  });
  return normalizeSearch(raw);
}
