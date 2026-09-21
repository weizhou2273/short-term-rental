import 'server-only';
import { cache } from 'react';
import { env, ownerRezConfigured } from '@/lib/config/env';
import type { AvailabilityCalendar, AvailabilityNight, Property } from '@/lib/booking/types';
import { nightlyRate } from '@/lib/booking/pricing';
import { addDays, nightsInRange, today, type IsoDate } from '@/lib/util/date';
import { ownerRezRequest } from './client';
import { mapAvailability } from './mapper';
import { orAvailabilitySpanSchema, parseMany } from './schema';

export const availabilityTag = (id: number) => `ownerrez:availability:${id}`;

/**
 * Availability for a property over a date window.
 *
 * Falls back to a synthetic calendar when OwnerRez is unconfigured or down. The
 * synthetic calendar is clearly plausible rather than random: it blocks a
 * stable, repeatable pattern of nights so the UI can be developed and tested
 * against a realistic mix of open and taken dates.
 */
async function loadFromOwnerRez(
  property: Property,
  from: IsoDate,
  to: IsoDate,
): Promise<AvailabilityCalendar> {
  const spans = await ownerRezRequest<unknown>('/properties/availability', {
    query: {
      property_ids: property.id,
      start_date: from,
      end_date: addDays(to, -1),
      include_rates: true,
    },
    revalidate: env().AVAILABILITY_REVALIDATE_SECONDS,
    tags: [availabilityTag(property.id)],
  });

  // The endpoint returns either a bare array or `{ items: [...] }` depending on
  // the account's API version; accept both.
  const rows = Array.isArray(spans)
    ? spans
    : Array.isArray((spans as { items?: unknown[] })?.items)
      ? ((spans as { items: unknown[] }).items)
      : [];

  const parsed = parseMany(orAvailabilitySpanSchema, rows, 'availability span');
  const calendar = mapAvailability(property.id, from, to, parsed, property.currency);
  return withRates(property, calendar);
}

/** Paints a nightly rate onto any night the upstream calendar left blank. */
function withRates(property: Property, calendar: AvailabilityCalendar): AvailabilityCalendar {
  return {
    ...calendar,
    nights: calendar.nights.map((night) => ({
      ...night,
      rate: night.rate ?? nightlyRate(property, night.date),
      minNights: night.minNights ?? property.rules.minNights,
    })),
  };
}

/** Stable pseudo-random in [0,1) from a string — same input, same output, always. */
function seeded(value: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return (h >>> 0) / 2 ** 32;
}

export function demoCalendar(
  property: Property,
  from: IsoDate,
  to: IsoDate,
): AvailabilityCalendar {
  const nights: AvailabilityNight[] = nightsInRange(from, to).map((date) => {
    const roll = seeded(`${property.id}|${date}`);
    // Roughly a third of nights taken, clustered by the weekly seed so the
    // calendar shows blocks rather than confetti.
    const weekSeed = seeded(`${property.id}|week|${date.slice(0, 8)}`);
    const occupied = roll < 0.18 + weekSeed * 0.25;
    const status = occupied ? 'booked' : 'available';
    return {
      date,
      status,
      rate: nightlyRate(property, date),
      minNights: property.rules.minNights,
      canCheckIn: !occupied,
      canCheckOut: !occupied,
    };
  });

  // Past dates are never bookable regardless of what the seed produced.
  const now = today();
  for (const night of nights) {
    if (night.date < now) {
      night.status = 'blocked';
      night.canCheckIn = false;
      night.canCheckOut = false;
    }
  }

  return { propertyId: property.id, from, to, nights };
}

export const getAvailability = cache(
  async (property: Property, from: IsoDate, to: IsoDate): Promise<AvailabilityCalendar> => {
    if (!ownerRezConfigured()) return demoCalendar(property, from, to);
    try {
      return await loadFromOwnerRez(property, from, to);
    } catch (error) {
      console.error(
        `[ownerrez] availability failed for property ${property.id}; serving synthetic calendar`,
        error,
      );
      return demoCalendar(property, from, to);
    }
  },
);

/** The window the property page paints: today through twelve months out. */
export function defaultAvailabilityWindow(): { from: IsoDate; to: IsoDate } {
  const from = today();
  return { from, to: addDays(from, 365) };
}
