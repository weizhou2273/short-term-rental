import 'server-only';
import type { Property } from '@/data/types';
import { firstOpenStay } from '@/lib/booking/availability';
import type { SuggestedStay } from '@/lib/booking/types';
import { addDays, todayIso } from '@/lib/dates';
import { getCalendar } from './calendar';
import { hospitableConfigured } from './client';
import { searchProperties } from './search';

/**
 * Prices for property cards when the guest hasn't picked dates, the way
 * Airbnb does it: each property's first open stay of 2 nights (or its minimum
 * stay, if longer) in the next 60 days, priced by Hospitable search for one
 * adult. Totals include all fees, before taxes. A property that can't be
 * priced gets no suggestion, so its card shows no price rather than a wrong one.
 */

const LOOKAHEAD_DAYS = 60;

export async function getSuggestedStays(properties: Property[]): Promise<Record<string, SuggestedStay>> {
  const suggested: Record<string, SuggestedStay> = {};
  if (!hospitableConfigured()) return suggested;

  // Tomorrow onward: a same-day arrival is too late to plan around.
  const from = addDays(todayIso(), 1);
  const to = addDays(from, LOOKAHEAD_DAYS);

  const stays = await Promise.all(
    properties.map(async (p) => {
      try {
        const stay = firstOpenStay(await getCalendar(p.hospitable.uuid, from, to), from);
        return stay ? { slug: p.slug, ...stay } : null;
      } catch (err) {
        console.error(`[suggested] calendar for ${p.slug} failed:`, (err as Error).message);
        return null;
      }
    }),
  );

  // One search per distinct stay; properties with the same dates share it.
  const byStay = new Map<string, NonNullable<(typeof stays)[number]>[]>();
  for (const stay of stays) {
    if (!stay) continue;
    const key = `${stay.checkin}/${stay.checkout}`;
    byStay.set(key, [...(byStay.get(key) ?? []), stay]);
  }

  await Promise.all(
    [...byStay.values()].map(async (group) => {
      const { checkin, checkout, nights } = group[0]!;
      try {
        const results = await searchProperties({ checkin, checkout, guests: { adults: 1 } });
        for (const stay of group) {
          const r = results.find((x) => x.slug === stay.slug);
          if (r?.available && r.totalWithoutTaxes !== null) {
            suggested[stay.slug] = { checkin, checkout, nights, total: r.totalWithoutTaxes, currency: r.currency };
          }
        }
      } catch (err) {
        console.error(`[suggested] search for ${checkin}–${checkout} failed:`, (err as Error).message);
      }
    }),
  );

  return suggested;
}
