import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import searchFixture from './fixtures/search-2026-11-10.json';
import calendarFixture from './fixtures/calendar-1680-clover-rd.json';
import { GET as searchGET } from '@/app/api/search/route';
import { GET as calendarGET } from '@/app/api/calendar/route';
import { normalizeSearch } from '@/lib/hospitable/search';
import { normalizeCalendar } from '@/lib/hospitable/calendar';
import { addDays, todayIso } from '@/lib/dates';

// Both fixtures are real Hospitable responses (search trimmed to id + name per property).

function mockHospitable(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let ip = 0;
const get = (path: string) => new NextRequest(`http://localhost${path}`, { headers: { 'x-forwarded-for': `10.1.0.${++ip}` } });

beforeEach(() => {
  process.env.HOSPITABLE_PAT = 'test-pat';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HOSPITABLE_PAT;
});

describe('normalizeSearch', () => {
  const results = normalizeSearch(searchFixture);

  it('keeps only properties listed on the site, keyed by slug', () => {
    // The account returns 7 properties. Not on the site: the unused Turkey Ridge
    // listing (c010e823…) and Goose Pond (ec6850bc…, hidden as property-5).
    expect(results.map((r) => r.slug).sort()).toEqual(['property-1', 'property-2', 'property-3', 'property-4', 'property-6']);
    expect(JSON.stringify(results)).not.toMatch(/c010e823|ec6850bc|property-5/);
  });

  it('maps Turkey Ridge (property-4) to the listing with the reservations', () => {
    expect(results.find((r) => r.slug === 'property-4')).toEqual({
      slug: 'property-4',
      available: true,
      totalWithoutTaxes: 212400, // c62be835…: $867 + $859 + fees, before taxes
      nightlyAverage: Math.round((86700 + 85900) / 2),
      currency: 'USD',
    });
  });

  it('reads string-of-cents totals and decimal daily prices correctly', () => {
    const clover = results.find((r) => r.slug === 'property-2');
    expect(clover).toEqual({
      slug: 'property-2',
      available: true,
      totalWithoutTaxes: 97229, // "97229" → $972.29
      nightlyAverage: Math.round((34674 + 34555) / 2),
      currency: 'USD',
    });
  });

  it('marks unavailable properties', () => {
    // In the captured response only the (now hidden) Goose Pond was booked, so flip Clover Rd.
    const fixture = structuredClone(searchFixture);
    const clover = fixture.data.find((row) => row.property.id === 'd37d9860-e7e2-4fa4-a582-633d918acddb')!;
    clover.availability = { available: false, details: null };
    expect(normalizeSearch(fixture).find((r) => r.slug === 'property-2')?.available).toBe(false);
  });
});

describe('GET /api/search', () => {
  const checkin = addDays(todayIso(), 20);
  const checkout = addDays(checkin, 2);

  it('calls Hospitable search with dates and guests', async () => {
    const fetchMock = mockHospitable(200, searchFixture);
    const res = await searchGET(get(`/api/search?checkin=${checkin}&checkout=${checkout}&adults=4`));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toHaveLength(5);
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe('/v2/properties/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({ start_date: checkin, end_date: checkout, adults: '4' });
  });

  it('rejects missing guests and bad windows without calling Hospitable', async () => {
    const fetchMock = mockHospitable(200, searchFixture);
    expect((await searchGET(get(`/api/search?checkin=${checkin}&checkout=${checkout}`))).status).toBe(400);
    expect((await searchGET(get(`/api/search?checkin=${checkout}&checkout=${checkin}&adults=2`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('calendar', () => {
  it('normalizes days for the date picker without prices', () => {
    const days = normalizeCalendar(calendarFixture);
    expect(days[1]).toEqual({ date: '2026-10-17', available: false, minStay: 2, closedForCheckin: true, closedForCheckout: true });
    expect(JSON.stringify(days)).not.toContain('price');
  });

  it('GET /api/calendar looks up the property by slug', async () => {
    const fetchMock = mockHospitable(200, calendarFixture);
    const start = todayIso();
    const end = addDays(start, 60);
    const res = await calendarGET(get(`/api/calendar?slug=property-2&start=${start}&end=${end}`));
    expect(res.status).toBe(200);
    expect((await res.json()).days).toHaveLength(3);
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe('/v2/properties/d37d9860-e7e2-4fa4-a582-633d918acddb/calendar');
  });

  it('refuses unknown slugs and oversized ranges', async () => {
    const fetchMock = mockHospitable(200, calendarFixture);
    const start = todayIso();
    expect((await calendarGET(get(`/api/calendar?slug=nope&start=${start}&end=${addDays(start, 10)}`))).status).toBe(404);
    expect((await calendarGET(get(`/api/calendar?slug=property-5&start=${start}&end=${addDays(start, 10)}`))).status).toBe(404);
    expect((await calendarGET(get(`/api/calendar?slug=property-2&start=${start}&end=${addDays(start, 365)}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
