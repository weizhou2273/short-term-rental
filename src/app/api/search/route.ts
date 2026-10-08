import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkStayWindow } from '@/lib/booking/validate';
import { isIsoDate } from '@/lib/dates';
import { searchProperties } from '@/lib/hospitable/search';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { errorResponse, json, upstreamErrorResponse } from '@/lib/api';

/**
 * GET /api/search?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&adults=N[&children&infants&pets]
 *   → 200 { results: SearchResult[] }  (availability + pre-tax totals by slug)
 */

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

const isoDate = z.string().refine(isIsoDate, 'Use YYYY-MM-DD dates.');
const schema = z.object({
  checkin: isoDate,
  checkout: isoDate,
  adults: z.coerce.number().int().min(1).max(50),
  children: z.coerce.number().int().min(0).max(50).optional(),
  infants: z.coerce.number().int().min(0).max(20).optional(),
  pets: z.coerce.number().int().min(0).max(10).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) {
    return errorResponse('Too many searches. Please wait a moment.', 429, { 'Retry-After': String(rate.retryAfter) });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid search.', 400);
  const { checkin, checkout, adults, children, infants, pets } = parsed.data;

  const windowError = checkStayWindow(checkin, checkout);
  if (windowError) return errorResponse(windowError, 400);

  try {
    const results = await searchProperties({ checkin, checkout, guests: { adults, children, infants, pets } });
    return json({ results });
  } catch (err) {
    return upstreamErrorResponse(err, 'search');
  }
}
