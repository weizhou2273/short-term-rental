import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import searchFixture from './fixtures/search-2026-11-10.json';
import { firstOpenStay } from '@/lib/booking/availability';
import type { CalendarDay } from '@/lib/booking/types';
import { addDays, formatStayRange, todayIso } from '@/lib/dates';
import { getPropertyBySlug } from '@/data/properties';
import { getSuggestedStays } from '@/lib/hospitable/suggested';

const day = (date: string, available: boolean, extra: Partial<CalendarDay> = {}): CalendarDay => ({
  date,
  available,
  minStay: 2,
  closedForCheckin: false,
  closedForCheckout: false,
  ...extra,
});

// Fri 16 + Sat 17 booked, everything else free.
const days = [
  day('2026-10-14', true),
  day('2026-10-15', true),
  day('2026-10-16', false),
  day('2026-10-17', false, { closedForCheckin: true, closedForCheckout: true }),
  day('2026-10-18', true),
  day('2026-10-19', true),
  day('2026-10-20', true, { minStay: 3 }),
  day('2026-10-21', true),
  day('2026-10-22', true),
];

describe('firstOpenStay', () => {
  it('picks the first 2 nights that can be booked', () => {
    expect(firstOpenStay(days, '2026-10-14')).toEqual({ checkin: '2026-10-14', checkout: '2026-10-16', nights: 2 });
  });

  it('skips stays that cross a booked night', () => {
    expect(firstOpenStay(days, '2026-10-15')).toEqual({ checkin: '2026-10-18', checkout: '2026-10-20', nights: 2 });
  });

  it('stretches to the minimum stay', () => {
    expect(firstOpenStay(days, '2026-10-20')).toEqual({ checkin: '2026-10-20', checkout: '2026-10-23', nights: 3 });
  });

  it('returns null past the end of the calendar', () => {
    expect(firstOpenStay(days, '2026-10-22')).toBeNull();
  });
});

describe('formatStayRange', () => {
  it('drops the repeated month', () => {
    expect(formatStayRange('2026-10-18', '2026-10-20')).toBe('Oct 18 – 20');
  });

  it('names both months across a month end', () => {
    expect(formatStayRange('2026-10-30', '2026-11-01')).toBe('Oct 30 – Nov 1');
  });
});

describe('getSuggestedStays', () => {
  const clover = getPropertyBySlug('clover-lodge')!;
  const minsi = getPropertyBySlug('minsi-pond')!;
  const from = addDays(todayIso(), 1);
  const calendar = (booked: number) => ({
    data: {
      days: Array.from({ length: 10 }, (_, i) => ({
        date: addDays(from, i),
        min_stay: 2,
        status: { available: i >= booked },
      })),
    },
  });

  beforeEach(() => {
    process.env.HOSPITABLE_PAT = 'test-pat';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.HOSPITABLE_PAT;
  });

  function mockHospitable(calendars: Record<string, unknown>) {
    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.pathname === '/v2/properties/search') return new Response(JSON.stringify(searchFixture));
      const uuid = url.pathname.split('/')[3]!;
      return calendars[uuid] ? new Response(JSON.stringify(calendars[uuid])) : new Response('{}', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('prices each property’s first open stay for one adult', async () => {
    const fetchMock = mockHospitable({ [clover.hospitable.uuid]: calendar(0), [minsi.hospitable.uuid]: calendar(3) });
    const suggested = await getSuggestedStays([clover, minsi]);

    expect(suggested['clover-lodge']).toEqual({ checkin: from, checkout: addDays(from, 2), nights: 2, total: 97229, currency: 'USD' });
    expect(suggested['minsi-pond']).toMatchObject({ checkin: addDays(from, 3), checkout: addDays(from, 5), nights: 2 });

    const searches = fetchMock.mock.calls.map(([u]) => new URL(u)).filter((u) => u.pathname.endsWith('/search'));
    expect(searches).toHaveLength(2);
    expect(searches.every((u) => u.searchParams.get('adults') === '1')).toBe(true);
  });

  it('leaves out a property whose calendar fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockHospitable({ [clover.hospitable.uuid]: calendar(0) });
    expect(Object.keys(await getSuggestedStays([clover, minsi]))).toEqual(['clover-lodge']);
  });

  it('suggests nothing without a Hospitable token', async () => {
    delete process.env.HOSPITABLE_PAT;
    const fetchMock = mockHospitable({});
    expect(await getSuggestedStays([clover])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
