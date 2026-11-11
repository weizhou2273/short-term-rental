import 'server-only';
import { PROPERTIES } from '@/data/properties';
import { batchRunReports, type GaReport, rowsOf, runRealtimeReport } from './ga-data';

/**
 * The owner's site report, from Google Analytics: visitors, the booking
 * funnel (see src/lib/google-analytics.ts for the events), where visitors
 * come from, which homes they look at, devices, cities and who's on the
 * site right now. Served privately by /api/admin/stats.
 */

export const FUNNEL = [
  { event: 'page_view', step: 'Landed' },
  { event: 'view_item', step: 'Opened a home' },
  { event: 'check_availability', step: 'Checked dates' },
  { event: 'begin_checkout', step: 'Went to checkout' },
] as const;
const OTHER_EVENTS = ['generate_lead', 'search'];

const num = (v: string | undefined) => Number(v ?? 0) || 0;
const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places;

/** GA's date range for the last `days` days, today included. */
export const dateRange = (days: number) => ({ startDate: days <= 1 ? 'today' : `${days - 1}daysAgo`, endDate: 'today' });

export function statsRequests(days: number) {
  const dateRanges = [dateRange(days)];
  const events = [...FUNNEL.map((f) => f.event), ...OTHER_EVENTS];
  return [
    // 0. Totals
    { dateRanges, metrics: ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagementRate', 'averageSessionDuration'].map((name) => ({ name })) },
    // 1. Funnel and other events: unique users and counts
    {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: events } } },
    },
    // 2. Where visitors come from
    {
      dateRanges,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    },
    // 3. Homes viewed
    {
      dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
      dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/stays/' } } },
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20,
    },
    // 4. Day by day
    { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }] },
  ];
}

export function audienceRequests(days: number) {
  const dateRanges = [dateRange(days)];
  return [
    { dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] },
    { dateRanges, dimensions: [{ name: 'city' }, { name: 'region' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 10 },
  ];
}

const homeName = (path: string) => {
  const slug = path.replace(/^\/stays\//, '').split(/[/?#]/)[0] ?? '';
  return PROPERTIES.find((p) => p.slug === slug)?.name ?? null;
};

/** Turns GA's reports into the owner's summary. Pure, for tests. */
export function summarize(days: number, main: GaReport[], audience: GaReport[], realtime: GaReport | null, now = new Date()) {
  const [totals, events, channels, homes, daily] = main;
  const t = rowsOf(totals)[0] ?? {};
  const byEvent = new Map(rowsOf(events).map((r) => [r.eventName, r]));

  const funnel = FUNNEL.map((f, i) => {
    const users = num(byEvent.get(f.event)?.totalUsers);
    const prev = i ? num(byEvent.get(FUNNEL[i - 1]!.event)?.totalUsers) : null;
    return {
      step: f.step,
      event: f.event,
      users,
      count: num(byEvent.get(f.event)?.eventCount),
      // Share of the previous step's visitors who got this far.
      fromPrevious: prev ? `${round((users / prev) * 100)}%` : null,
    };
  });

  // Visits to the same home under different URLs (dates in the query) count together.
  const homeTotals = new Map<string, { views: number; users: number }>();
  for (const r of rowsOf(homes)) {
    const name = homeName(r.pagePath ?? '');
    if (!name) continue;
    const h = homeTotals.get(name) ?? { views: 0, users: 0 };
    h.views += num(r.screenPageViews);
    h.users += num(r.totalUsers);
    homeTotals.set(name, h);
  }

  const [devices, cities] = audience;
  return {
    period: `last ${days === 1 ? 'day (today)' : `${days} days, today included`}`,
    generatedAt: now.toISOString(),
    liveNow: realtime ? num(rowsOf(realtime)[0]?.activeUsers) : null,
    visitors: {
      users: num(t.activeUsers),
      newUsers: num(t.newUsers),
      sessions: num(t.sessions),
      pageViews: num(t.screenPageViews),
      engagementRate: `${round(num(t.engagementRate) * 100)}%`,
      avgSessionSeconds: Math.round(num(t.averageSessionDuration)),
    },
    funnel,
    leads: { users: num(byEvent.get('generate_lead')?.totalUsers), count: num(byEvent.get('generate_lead')?.eventCount) },
    searches: num(byEvent.get('search')?.eventCount),
    sources: rowsOf(channels).map((r) => ({ channel: r.sessionDefaultChannelGroup, source: r.sessionSource, sessions: num(r.sessions), users: num(r.totalUsers) })),
    homes: [...homeTotals].map(([name, h]) => ({ name, ...h })).sort((a, b) => b.views - a.views),
    daily: rowsOf(daily).map((r) => ({ date: `${r.date?.slice(0, 4)}-${r.date?.slice(4, 6)}-${r.date?.slice(6, 8)}`, users: num(r.activeUsers), sessions: num(r.sessions) })),
    devices: rowsOf(devices).map((r) => ({ device: r.deviceCategory, users: num(r.activeUsers) })),
    cities: rowsOf(cities).map((r) => ({ city: r.city, region: r.region, users: num(r.activeUsers) })),
  };
}

export type SiteStats = ReturnType<typeof summarize>;

export async function siteStats(days: number): Promise<SiteStats> {
  const [main, audience, realtime] = await Promise.all([
    batchRunReports(statsRequests(days)),
    batchRunReports(audienceRequests(days)),
    runRealtimeReport({ metrics: [{ name: 'activeUsers' }] }).catch(() => null),
  ]);
  return summarize(days, main.reports ?? [], audience.reports ?? [], realtime);
}
