import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import cloverQuote from './fixtures/quote-1680-clover-rd.json';
import turkeyQuote from './fixtures/quote-60-turkey-ridge.json';
import { POST } from '@/app/api/quote/route';
import { addDays, todayIso } from '@/lib/dates';

// The fixture is the real create-quote response Hospitable returned for
// 1680 Clover Rd (clover-lodge), Nov 10–12 2026, 2 adults.
const CLOVER_UUID = 'd37d9860-e7e2-4fa4-a582-633d918acddb';
const SITE_ID = 'a2ed54d4-814f-4f65-ac95-76f57e335dce';
const TOKEN = 'test-pat-should-never-leak';

const checkin = addDays(todayIso(), 30);
const checkout = addDays(checkin, 2);

let ipCounter = 0;
function quoteRequest(body: unknown, ip = `10.0.0.${++ipCounter}`) {
  return new NextRequest('http://localhost/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function mockHospitable(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.HOSPITABLE_PAT = TOKEN;
  delete process.env.HOSPITABLE_API_BASE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HOSPITABLE_PAT;
});

describe('POST /api/quote', () => {
  it('creates a Hospitable quote for 1680 Clover Rd and returns the booking_url', async () => {
    const fetchMock = mockHospitable(200, cloverQuote);

    const res = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bookingUrl).toBe(
      'https://booking.hospitable.com/book/external/411552/68b42302-5f2e-42ba-9105-8c56c38970ac',
    );
    expect(body).toMatchObject({
      quoteId: '68b42302-5f2e-42ba-9105-8c56c38970ac',
      currency: 'USD',
      nights: 2,
      accommodation: 69229,
      fees: [{ label: 'Cleaning fee', amount: 28000 }], // $0 service fee dropped
      taxes: [
        { label: 'County lodging tax', amount: 2917 },
        { label: 'State sales tax', amount: 5834 },
      ],
      total: 105980,
    });

    // The request Hospitable received
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://public.api.hospitable.com/v2/properties/${CLOVER_UUID}/quote`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body as string)).toEqual({
      checkin_date: checkin,
      checkout_date: checkout,
      guests: { adults: 2 },
      custom_site_id: SITE_ID,
    });
  });

  it('sends the guest breakdown but never guest details, even from an older page', async () => {
    // With guest_details, Hospitable's checkout skips its own details step and
    // then can't take payment, so the guest enters them there instead.
    const fetchMock = mockHospitable(200, cloverQuote);
    const res = await POST(
      quoteRequest({
        slug: 'clover-lodge',
        checkin,
        checkout,
        adults: 4,
        children: 3,
        infants: 1,
        pets: 2,
        guest: { firstName: 'Kelsey', lastName: 'Yu', email: 'kelsey@example.com', phone: '(570) 555-0123' },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).bookingUrl).toMatch(/^https:\/\/booking\.hospitable\.com\//);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      checkin_date: checkin,
      checkout_date: checkout,
      guests: { adults: 4, children: 3, infants: 1, pets: 2 },
      custom_site_id: SITE_ID,
    });
  });

  it('counts children but not infants toward occupancy', async () => {
    const fetchMock = mockHospitable(200, cloverQuote);
    // clover-lodge sleeps 12
    expect((await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 8, children: 4, infants: 3 }))).status).toBe(200);
    expect((await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 8, children: 5 }))).status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never sends the token back to the browser', async () => {
    mockHospitable(200, cloverQuote);
    const res = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }));
    expect(await res.text()).not.toContain(TOKEN);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('quotes Turkey Ridge (the-ridge) on the listing with the reservations', async () => {
    // Real response for c62be835… (Nov 10–12 2026, 2 adults): checkout is widget 1396650.
    const fetchMock = mockHospitable(200, turkeyQuote);
    const res = await POST(quoteRequest({ slug: 'the-ridge', checkin, checkout, adults: 2 }));
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://public.api.hospitable.com/v2/properties/c62be835-a698-4e96-90ec-1630519f3ced/quote');
    const body = await res.json();
    expect(body.bookingUrl).toBe('https://booking.hospitable.com/book/external/1396650/ed21fde7-78b8-4679-8bb7-310662ef754f');
    expect(body).toMatchObject({ accommodation: 172600, fees: [{ label: 'Cleaning fee', amount: 39800 }], total: 231516 });
  });

  it('refuses hidden properties (Goose Pond, property-5) without calling Hospitable', async () => {
    const fetchMock = mockHospitable(200, cloverQuote);
    const res = await POST(quoteRequest({ slug: 'property-5', checkin, checkout, adults: 2 }));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects properties that are not in PROPERTIES without calling Hospitable', async () => {
    const fetchMock = mockHospitable(200, cloverQuote);
    const res = await POST(quoteRequest({ slug: CLOVER_UUID, checkin, checkout, adults: 2 }));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ slug: 'clover-lodge', checkin: '2020-01-01', checkout: '2020-01-03', adults: 2 }, /past/],
    [{ slug: 'clover-lodge', checkin: checkout, checkout: checkin, adults: 2 }, /after check-in/],
    [{ slug: 'clover-lodge', checkin, checkout: addDays(checkin, 120), adults: 2 }, /90 nights/],
    [{ slug: 'clover-lodge', checkin, checkout, adults: 13 }, /sleeps up to 12/],
    [{ slug: 'clover-lodge', checkin: '11/10/2026', checkout, adults: 2 }, /YYYY-MM-DD/],
    [{ slug: 'clover-lodge', checkin, checkout, adults: 0 }, /./],
  ])('validates the stay before calling Hospitable (%#)', async (input, message) => {
    const fetchMock = mockHospitable(200, cloverQuote);
    const res = await POST(quoteRequest(input));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON body', async () => {
    const res = await POST(quoteRequest('not json'));
    expect(res.status).toBe(400);
  });

  it('passes Hospitable availability errors through as 422', async () => {
    mockHospitable(422, { message: 'The selected dates are not available.' });
    const res = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('The selected dates are not available.');
  });

  it('hides upstream auth and server errors behind a generic message', async () => {
    mockHospitable(401, { message: 'Unauthenticated.' });
    const res = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toMatch(/Unauthenticated/);
  });

  it('refuses to hand out a booking_url that is not Hospitable checkout', async () => {
    const tampered = structuredClone(cloverQuote);
    tampered.data.booking_url = 'https://evil.example.com/book/123';
    mockHospitable(200, tampered);
    const res = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('evil.example.com');
  });

  it('returns 503 when HOSPITABLE_PAT is not configured', async () => {
    delete process.env.HOSPITABLE_PAT;
    const fetchMock = mockHospitable(200, cloverQuote);
    const res = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }));
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits each client to 20 quotes a minute', async () => {
    const fetchMock = mockHospitable(200, cloverQuote);
    const ip = '203.0.113.7';
    for (let i = 0; i < 20; i++) {
      const ok = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }, ip));
      expect(ok.status).toBe(200);
    }
    const limited = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }, ip));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(20);

    // A different client is unaffected
    const other = await POST(quoteRequest({ slug: 'clover-lodge', checkin, checkout, adults: 2 }, '203.0.113.8'));
    expect(other.status).toBe(200);
  });
});
