import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/hospitable/route';
import { buildPurchaseEvent } from '@/lib/meta/capi';
import type { HospitableReservation } from '@/lib/hospitable/reservation';

const KEY = 'test-webhook-key';
const RES_ID = '860971d6-9ac0-4505-9385-a05876574524';
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const now = Math.floor(Date.parse('2026-11-04T20:00:00Z') / 1000);

function reservation(overrides: Partial<HospitableReservation> = {}): HospitableReservation {
  return {
    id: RES_ID,
    code: 'WK123',
    platform: 'direct',
    booking_date: '2026-11-04T19:22:10Z',
    arrival_date: '2026-12-30T00:00:00-05:00',
    departure_date: '2027-01-01T00:00:00-05:00',
    reservation_status: { current: { category: 'accepted' } },
    financials: { currency: 'USD', guest: { total_price: { amount: 808126 } } },
    properties: [{ id: 'c62be835-a698-4e96-90ec-1630519f3ced' }],
    guest: {
      id: '1763315',
      email: ' Peter.Kim@Example.com ',
      phone_numbers: ['+1 (540) 944-4947'],
      first_name: 'Peter',
      last_name: 'Kim',
      location: 'West Caldwell, NJ',
    },
    ...overrides,
  };
}

describe('buildPurchaseEvent', () => {
  it('builds a hashed Purchase for a confirmed direct booking', () => {
    const d = buildPurchaseEvent(reservation(), now);
    expect(d.send).toBe(true);
    if (!d.send) return;
    const e = d.event as { event_id: string; event_time: number; user_data: Record<string, string[]>; custom_data: Record<string, unknown> };
    expect(e.event_id).toBe(`purchase-${RES_ID}`);
    expect(e.event_time).toBe(Math.floor(Date.parse('2026-11-04T19:22:10Z') / 1000));
    expect(e.user_data.em).toEqual([sha('peter.kim@example.com')]);
    expect(e.user_data.ph).toEqual([sha('15409444947')]);
    expect(e.user_data.ct).toEqual([sha('westcaldwell')]);
    expect(e.user_data.st).toEqual([sha('nj')]);
    expect(e.custom_data.value).toBe(8081.26);
    expect(e.custom_data.currency).toBe('USD');
    expect(e.custom_data.checkin_date).toBe('2026-12-30');
    expect(JSON.stringify(e)).not.toContain('Peter');
  });

  it.each([
    ['Airbnb bookings', { platform: 'airbnb' }, 'platform airbnb'],
    ['unconfirmed bookings', { reservation_status: { current: { category: 'request' } } }, 'status request'],
    ['bookings older than 7 days', { booking_date: '2026-10-20T00:00:00Z' }, 'booked more than 7 days ago'],
    ['guests with nothing to match on', { guest: { first_name: 'A' } }, 'no guest email or phone to match on'],
  ])('skips %s', (_label, overrides, reason) => {
    expect(buildPurchaseEvent(reservation(overrides as Partial<HospitableReservation>), now)).toEqual({ send: false, reason });
  });
});

describe('POST /api/webhooks/hospitable', () => {
  beforeEach(() => {
    process.env.HOSPITABLE_WEBHOOK_KEY = KEY;
    process.env.HOSPITABLE_PAT = 'pat';
    process.env.META_CAPI_TOKEN = 'meta-token';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T20:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.HOSPITABLE_WEBHOOK_KEY;
    delete process.env.HOSPITABLE_PAT;
    delete process.env.META_CAPI_TOKEN;
  });

  const call = (body: unknown, key: string | null = KEY) =>
    POST(
      new NextRequest(`http://localhost/api/webhooks/hospitable${key ? `?key=${key}` : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  it('rejects calls without the right key', async () => {
    expect((await call({ action: 'reservation.created', data: { id: RES_ID } }, null)).status).toBe(401);
    expect((await call({ action: 'reservation.created', data: { id: RES_ID } }, 'wrong')).status).toBe(401);
  });

  it('skips non-direct bookings without calling anyone', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await call({ action: 'reservation.created', data: { id: RES_ID, platform: 'airbnb' } });
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-reads the reservation from Hospitable and sends Purchase to Meta', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('hospitable')
        ? new Response(JSON.stringify({ data: reservation() }), { status: 200 })
        : new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await call({ action: 'reservation.created', data: { id: RES_ID, platform: 'direct', financials: { fake: true } } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: 'purchase sent' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [metaUrl, metaInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(metaUrl).toMatch(/graph\.facebook\.com\/v\d+\.\d+\/1474031564861079\/events$/);
    expect(metaUrl).not.toContain('meta-token');
    const sent = JSON.parse(String(metaInit.body));
    expect(sent.data[0].event_name).toBe('Purchase');
  });

  it('asks Hospitable to retry when Meta is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('hospitable')
          ? new Response(JSON.stringify({ data: reservation() }), { status: 200 })
          : new Response('{}', { status: 503 }),
      ),
    );
    expect((await call({ action: 'reservation.changed', data: { id: RES_ID } })).status).toBe(502);
  });
});
