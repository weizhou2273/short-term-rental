import 'server-only';
import { z } from 'zod';
import { hospitableFetch } from './client';
import type { CalendarDay } from '@/lib/booking/types';

/**
 * GET /properties/{uuid}/calendar — day-by-day availability and stay rules.
 * Only what the date picker needs is passed on; nightly prices stay server
 * side because the quote is the only price a guest should act on.
 */

const calendarResponse = z.object({
  data: z.object({
    days: z.array(
      z.object({
        date: z.string(),
        min_stay: z.number().nullish(),
        closed_for_checkin: z.boolean().nullish(),
        closed_for_checkout: z.boolean().nullish(),
        status: z.object({ available: z.boolean() }).nullish(),
      }),
    ),
  }),
});

export function normalizeCalendar(raw: unknown): CalendarDay[] {
  return calendarResponse.parse(raw).data.days.map((d) => ({
    date: d.date,
    available: d.status?.available ?? false,
    minStay: d.min_stay ?? null,
    closedForCheckin: d.closed_for_checkin ?? false,
    closedForCheckout: d.closed_for_checkout ?? false,
  }));
}

export async function getCalendar(propertyUuid: string, start: string, end: string): Promise<CalendarDay[]> {
  const raw = await hospitableFetch<unknown>(`/properties/${encodeURIComponent(propertyUuid)}/calendar`, {
    query: { start_date: start, end_date: end },
    revalidate: 120,
  });
  return normalizeCalendar(raw);
}
