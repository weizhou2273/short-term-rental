import { createVerify, generateKeyPairSync } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/admin/stats/route';
import { accessToken, batchRunReports, forgetToken, GaNotConfiguredError, propertyId, rowsOf, serviceAccount, signedAssertion } from '@/lib/analytics/ga-data';
import { dateRange, summarize } from '@/lib/analytics/stats';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const SA = { client_email: 'wk-stats@wk-reserve.iam.gserviceaccount.com', private_key: privateKey };
const KEY_JSON = JSON.stringify({ type: 'service_account', ...SA });

const report = (dims: string[], mets: string[], rows: [string[], string[]][]) => ({
  dimensionHeaders: dims.map((name) => ({ name })),
  metricHeaders: mets.map((name) => ({ name })),
  rows: rows.map(([d, m]) => ({ dimensionValues: d.map((value) => ({ value })), metricValues: m.map((value) => ({ value })) })),
});

const MAIN = [
  report([], ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagementRate', 'averageSessionDuration'], [[[], ['120', '100', '150', '600', '0.6234', '95.4']]]),
  report(['eventName'], ['totalUsers', 'eventCount'], [
    [['page_view'], ['120', '600']],
    [['view_item'], ['60', '90']],
    [['check_availability'], ['24', '40']],
    [['begin_checkout'], ['6', '7']],
    [['generate_lead'], ['5', '5']],
    [['search'], ['30', '44']],
  ]),
  report(['sessionDefaultChannelGroup', 'sessionSource'], ['sessions', 'totalUsers'], [
    [['Organic Search', 'google'], ['80', '70']],
    [['Organic Social', 'instagram'], ['40', '35']],
  ]),
  report(['pagePath'], ['screenPageViews', 'totalUsers'], [
    [['/stays/minsi-pond'], ['50', '30']],
    [['/stays/minsi-pond?checkin=2026-12-30&checkout=2027-01-14'], ['10', '8']],
    [['/stays/the-ridge'], ['40', '25']],
    [['/stays/property-5'], ['3', '3']],
  ]),
  report(['date'], ['activeUsers', 'sessions'], [
    [['20261110'], ['40', '50']],
    [['20261111'], ['80', '100']],
  ]),
];
const AUDIENCE = [
  report(['deviceCategory'], ['activeUsers'], [[['mobile'], ['80']], [['desktop'], ['40']]]),
  report(['city', 'region'], ['activeUsers'], [[['New York', 'New York'], ['30']]]),
];

beforeEach(() => forgetToken());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Google sign-in for the service account', () => {
  it('reads the key file as JSON or base64, and the numeric property ID', () => {
    expect(serviceAccount(KEY_JSON).client_email).toBe(SA.client_email);
    expect(serviceAccount(Buffer.from(KEY_JSON).toString('base64')).client_email).toBe(SA.client_email);
    expect(() => serviceAccount('')).toThrow(GaNotConfiguredError);
    expect(() => serviceAccount('{"client_email":"x"}')).toThrow(/private_key/);
    expect(propertyId('123456789')).toBe('123456789');
    expect(propertyId('properties/123456789')).toBe('123456789');
    expect(() => propertyId('G-QK3CL1J712')).toThrow(/numeric/);
  });

  it('signs a read-only, one-hour token request that Google can verify', () => {
    const jwt = signedAssertion(SA, Date.parse('2026-11-11T12:00:00Z'));
    const [head, claims, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(head!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const c = JSON.parse(Buffer.from(claims!, 'base64url').toString());
    expect(c).toMatchObject({ iss: SA.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token' });
    expect(c.exp - c.iat).toBe(3600);
    expect(createVerify('RSA-SHA256').update(`${head}.${claims}`).verify(publicKey, sig!, 'base64url')).toBe(true);
  });

  it('gets an access token once and reuses it until it nearly expires', async () => {
    vi.stubEnv('GA_SERVICE_ACCOUNT_KEY', KEY_JSON);
    const fetchMock = vi.fn(async () => Response.json({ access_token: 'ya29.token', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    const t0 = Date.parse('2026-11-11T12:00:00Z');
    expect(await accessToken(t0)).toBe('ya29.token');
    expect(await accessToken(t0 + 30 * 60_000)).toBe('ya29.token');
    expect(fetchMock).toHaveBeenCalledOnce();
    await accessToken(t0 + 59.5 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
  });

  it('calls the property’s Data API with the token', async () => {
    vi.stubEnv('GA_SERVICE_ACCOUNT_KEY', KEY_JSON);
    vi.stubEnv('GA_PROPERTY_ID', '123456789');
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push([url, init]);
        return url.includes('oauth2') ? Response.json({ access_token: 'ya29.token' }) : Response.json({ reports: [] });
      }),
    );
    await batchRunReports([{ metrics: [{ name: 'activeUsers' }] }]);
    expect(calls[1]![0]).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123456789:batchRunReports');
    expect(new Headers(calls[1]![1].headers).get('authorization')).toBe('Bearer ya29.token');
  });
});

describe('the site report', () => {
  it('turns GA reports into visitors, the funnel, sources and homes', () => {
    const s = summarize(7, MAIN, AUDIENCE, report([], ['activeUsers'], [[[], ['3']]]), new Date('2026-11-11T12:00:00Z'));
    expect(s.period).toBe('last 7 days, today included');
    expect(s.liveNow).toBe(3);
    expect(s.visitors).toEqual({ users: 120, newUsers: 100, sessions: 150, pageViews: 600, engagementRate: '62.3%', avgSessionSeconds: 95 });
    expect(s.funnel).toEqual([
      { step: 'Landed', event: 'page_view', users: 120, count: 600, fromPrevious: null },
      { step: 'Opened a home', event: 'view_item', users: 60, count: 90, fromPrevious: '50%' },
      { step: 'Checked dates', event: 'check_availability', users: 24, count: 40, fromPrevious: '40%' },
      { step: 'Went to checkout', event: 'begin_checkout', users: 6, count: 7, fromPrevious: '25%' },
    ]);
    expect(s.leads).toEqual({ users: 5, count: 5 });
    expect(s.searches).toBe(44);
    expect(s.sources[0]).toEqual({ channel: 'Organic Search', source: 'google', sessions: 80, users: 70 });
    // Same home under different URLs adds up; hidden or unknown homes are left out.
    expect(s.homes).toEqual([
      { name: 'Minsi Pond', views: 60, users: 38 },
      { name: 'The Ridge', views: 40, users: 25 },
    ]);
    expect(s.daily).toEqual([
      { date: '2026-11-10', users: 40, sessions: 50 },
      { date: '2026-11-11', users: 80, sessions: 100 },
    ]);
    expect(s.devices[0]).toEqual({ device: 'mobile', users: 80 });
  });

  it('copes with an empty property and asks GA for the right days', () => {
    const s = summarize(1, [], [], null);
    expect(s.visitors.users).toBe(0);
    expect(s.funnel.every((f) => f.users === 0)).toBe(true);
    expect(s.liveNow).toBeNull();
    expect(dateRange(1)).toEqual({ startDate: 'today', endDate: 'today' });
    expect(dateRange(7)).toEqual({ startDate: '6daysAgo', endDate: 'today' });
  });
});

describe('GET /api/admin/stats', () => {
  let ip = 0;
  const get = (headers: Record<string, string> = {}, query = '') =>
    GET(new NextRequest(`https://wkreserve.com/api/admin/stats${query}`, { headers: { 'x-forwarded-for': `10.3.0.${++ip}`, ...headers } }));

  it('is hidden until a key is set, and locked without the right key', async () => {
    expect((await get({ 'x-stats-key': 'anything' })).status).toBe(404);
    vi.stubEnv('STATS_API_KEY', 'correct-horse-battery-staple');
    expect((await get()).status).toBe(401);
    expect((await get({ 'x-stats-key': 'wrong' })).status).toBe(401);
  });

  it('says what’s missing before Google is set up', async () => {
    vi.stubEnv('STATS_API_KEY', 'correct-horse-battery-staple');
    const res = await get({ 'x-stats-key': 'correct-horse-battery-staple' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('Google Analytics isn’t connected yet: set GA_SERVICE_ACCOUNT_KEY and GA_PROPERTY_ID in Vercel.');
  });

  it('returns the report for the right key', async () => {
    vi.stubEnv('STATS_API_KEY', 'correct-horse-battery-staple');
    vi.stubEnv('GA_SERVICE_ACCOUNT_KEY', KEY_JSON);
    vi.stubEnv('GA_PROPERTY_ID', '123456789');
    let batch = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('oauth2')) return Response.json({ access_token: 'ya29.token' });
        if (url.endsWith(':runRealtimeReport')) return Response.json(report([], ['activeUsers'], [[[], ['2']]]));
        return Response.json({ reports: batch++ === 0 ? MAIN : AUDIENCE });
      }),
    );
    const res = await get({ authorization: 'Bearer correct-horse-battery-staple' }, '?days=30');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('last 30 days, today included');
    expect(body.funnel[3].users).toBe(6);
    expect(body.liveNow).toBe(2);
  });

  it('reads rows by header name', () => {
    expect(rowsOf(report(['a'], ['b'], [[['x'], ['1']]]))).toEqual([{ a: 'x', b: '1' }]);
    expect(rowsOf(undefined)).toEqual([]);
  });
});
