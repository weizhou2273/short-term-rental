import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { errorResponse, json } from '@/lib/api';
import { GaNotConfiguredError } from '@/lib/analytics/ga-data';
import { siteStats } from '@/lib/analytics/stats';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * GET /api/admin/stats?days=7   (1–90; default 7, today included)
 *   header X-Stats-Key: <STATS_API_KEY>
 *   → 200 the owner's site report from Google Analytics (lib/analytics/stats.ts)
 *
 * Private: without STATS_API_KEY set it answers 404, with a wrong key 401.
 */

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

function keyMatches(given: string | null): boolean {
  const expected = process.env.STATS_API_KEY?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!process.env.STATS_API_KEY?.trim()) return errorResponse('Not found.', 404);
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) return errorResponse('Too many requests.', 429, { 'Retry-After': String(rate.retryAfter) });
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (!keyMatches(request.headers.get('x-stats-key') ?? bearer)) return errorResponse('Unauthorized.', 401);

  const missing = ['GA_SERVICE_ACCOUNT_KEY', 'GA_PROPERTY_ID'].filter((name) => !process.env[name]?.trim());
  if (missing.length) return errorResponse(`Google Analytics isn’t connected yet: set ${missing.join(' and ')} in Vercel.`, 503);

  const days = Math.min(90, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('days') ?? '7', 10) || 7));
  try {
    return json(await siteStats(days));
  } catch (err) {
    if (err instanceof GaNotConfiguredError) return errorResponse(`Google Analytics isn’t connected: ${err.message}.`, 503);
    console.error('[stats]', err);
    return errorResponse(err instanceof Error ? err.message : 'Couldn’t read Google Analytics.', 502);
  }
}
