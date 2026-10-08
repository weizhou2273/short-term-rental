import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPropertyBySlug } from '@/data/properties';
import { isIsoDate, nightsBetween } from '@/lib/dates';
import { getCalendar } from '@/lib/hospitable/calendar';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { errorResponse, json, upstreamErrorResponse } from '@/lib/api';

/**
 * GET /api/calendar?slug=clover-lodge&start=YYYY-MM-DD&end=YYYY-MM-DD
 *   → 200 { days: CalendarDay[] }  (feeds the booking card's date picker)
 */

/** The picker asks for two months at a time; anything wider is refused. */
const MAX_RANGE_DAYS = 93;

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

const isoDate = z.string().refine(isIsoDate, 'Use YYYY-MM-DD dates.');
const schema = z.object({ slug: z.string().min(1).max(80), start: isoDate, end: isoDate });

export async function GET(request: NextRequest): Promise<Response> {
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) {
    return errorResponse('Too many requests. Please wait a moment.', 429, { 'Retry-After': String(rate.retryAfter) });
  }

  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request.', 400);
  const { slug, start, end } = parsed.data;

  const span = nightsBetween(start, end);
  if (span < 0 || span > MAX_RANGE_DAYS) return errorResponse(`Ask for at most ${MAX_RANGE_DAYS} days.`, 400);

  const property = getPropertyBySlug(slug);
  if (!property) return errorResponse('That stay isn’t listed.', 404);

  try {
    const days = await getCalendar(property.hospitable.uuid, start, end);
    // Browsers may reuse a calendar briefly; the quote re-checks availability anyway.
    return json({ days }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (err) {
    return upstreamErrorResponse(err, 'calendar');
  }
}
