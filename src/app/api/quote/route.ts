import type { NextRequest } from 'next/server';
import { SITE } from '@/data/site';
import { validateQuoteRequest } from '@/lib/booking/validate';
import { createQuote, UntrustedCheckoutUrlError } from '@/lib/hospitable/quote';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { errorResponse, json, upstreamErrorResponse } from '@/lib/api';

/**
 * POST /api/quote  { slug, checkin, checkout, adults, children?, infants?, pets? }
 *   → 200 Quote  (price breakdown + bookingUrl to Hospitable's hosted checkout)
 *
 * Every call creates a quote in Hospitable with a write-scoped token, so it is
 * rate limited per client and only accepts properties listed in PROPERTIES.
 */

// 20 quotes a minute is far more than a guest changing dates needs, and far
// less than a script would want.
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function POST(request: NextRequest): Promise<Response> {
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) {
    return errorResponse('Too many price checks. Please wait a moment and try again.', 429, {
      'Retry-After': String(rate.retryAfter),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Send a JSON body.', 400);
  }

  const result = validateQuoteRequest(body);
  if (!result.ok) return errorResponse(result.error, result.status);
  const { property, checkin, checkout, adults, children, infants, pets } = result.value;

  try {
    const quote = await createQuote({
      propertyUuid: property.hospitable.uuid,
      checkin,
      checkout,
      guests: { adults, children, infants, pets },
      customSiteId: SITE.hospitable.siteUuid,
    });
    return json(quote, { headers: { 'X-RateLimit-Remaining': String(rate.remaining) } });
  } catch (err) {
    if (err instanceof UntrustedCheckoutUrlError) {
      console.error('[quote]', err.message);
      return errorResponse('Couldn’t start checkout. Please try again.', 502);
    }
    return upstreamErrorResponse(err, 'quote');
  }
}
