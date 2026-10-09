import { describe, expect, it } from 'vitest';
import { canCheckIn, canCheckOut, minStayFor, toDayMap } from '@/lib/booking/availability';
import type { CalendarDay } from '@/lib/booking/types';
import { createRateLimiter, clientIp } from '@/lib/rate-limit';
import { filterProperties, parseSearchState, toggleAmenity, toQueryString } from '@/lib/search-params';
import { addDays, endOfMonth, isIsoDate, nightsBetween, todayIso } from '@/lib/dates';

const day = (date: string, available: boolean, extra: Partial<CalendarDay> = {}): CalendarDay => ({
  date,
  available,
  minStay: 2,
  closedForCheckin: false,
  closedForCheckout: false,
  ...extra,
});

// Fri 16 + Sat 17 booked (like the real Clover Rd calendar), everything else free.
const map = toDayMap([
  day('2026-10-14', true),
  day('2026-10-15', true),
  day('2026-10-16', false),
  day('2026-10-17', false, { closedForCheckin: true, closedForCheckout: true }),
  day('2026-10-18', true),
  day('2026-10-19', true),
  day('2026-10-20', true, { minStay: 3 }),
]);
const today = '2026-10-07';

describe('date picker rules', () => {
  it('disables check-in on booked nights and past days', () => {
    expect(canCheckIn('2026-10-16', map, today)).toBe(false);
    expect(canCheckIn('2026-10-18', map, today)).toBe(true);
    expect(canCheckIn('2026-10-01', map, today)).toBe(false);
  });

  it('allows checking out on the morning a booked stay arrives', () => {
    expect(canCheckOut('2026-10-14', '2026-10-16', map)).toBe(true);
  });

  it('blocks stays that cross a booked night', () => {
    expect(canCheckOut('2026-10-14', '2026-10-18', map)).toBe(false);
  });

  it('enforces the check-in day minimum stay', () => {
    expect(canCheckOut('2026-10-14', '2026-10-15', map)).toBe(false);
    expect(canCheckOut('2026-10-20', '2026-10-22', map)).toBe(false);
    expect(canCheckOut('2026-10-20', '2026-10-23', map)).toBe(true);
    expect(minStayFor('2026-10-20', map)).toBe(3);
  });

  it('treats days it has not loaded as possible', () => {
    expect(canCheckIn('2027-03-01', map, today)).toBe(true);
  });
});

describe('dates', () => {
  it('validates and does calendar arithmetic without time-zone drift', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(nightsBetween('2026-03-07', '2026-03-09')).toBe(2); // across US DST change
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('computes today in the Poconos, not UTC', () => {
    // 01:30 UTC on Oct 8 is still Oct 7 in New York.
    expect(todayIso(new Date('2026-10-08T01:30:00Z'))).toBe('2026-10-07');
  });
});

describe('search params', () => {
  it('ignores unknown values', () => {
    expect(parseSearchState({ where: 'atlantis', adults: '-2', checkin: 'tomorrow', amenities: 'pool,spaceship' })).toEqual({
      where: '',
      checkin: '',
      checkout: '',
      adults: 0,
      amenities: ['pool'],
    });
  });

  it('filters by attraction, guests and amenities', () => {
    const state = parseSearchState({ where: 'shawnee', adults: '21', amenities: 'court' });
    expect(filterProperties(state).map((p) => p.slug)).toEqual(['shawnee-estate']);
  });

  it('round-trips amenity toggles through the query string', () => {
    const state = parseSearchState({ amenities: 'pool' });
    expect(toQueryString(toggleAmenity(state, 'pets'))).toBe('?amenities=pool%2Cpets');
    expect(toQueryString(toggleAmenity(state, 'clear'))).toBe('');
  });
});

describe('rate limiter', () => {
  it('allows the limit per window, then resets', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('a', 10).allowed).toBe(true);
    expect(limiter.check('a', 20)).toMatchObject({ allowed: false, retryAfter: 1 });
    expect(limiter.check('b', 20).allowed).toBe(true);
    expect(limiter.check('a', 1001).allowed).toBe(true);
  });

  it('keys on the first forwarded address', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe('198.51.100.1');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('property data', () => {
  it('has unique, URL-safe slugs and a tagline for every entry', async () => {
    const { ALL_PROPERTY_ENTRIES } = await import('@/data/properties');
    const slugs = ALL_PROPERTY_ENTRIES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of ALL_PROPERTY_ENTRIES) {
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.tagline.trim()).not.toBe('');
    }
  });
});
