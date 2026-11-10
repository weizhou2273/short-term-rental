import type { NextRequest } from 'next/server';
import { SITE } from '@/data/site';
import { validateQuoteRequest } from '@/lib/booking/validate';
import { HospitableError } from '@/lib/hospitable/client';
import { createQuote, type QuoteInput, UntrustedCheckoutUrlError } from '@/lib/hospitable/quote';
import type { Quote } from '@/lib/booking/types';
import { welcomeOffer } from '@/lib/offer/welcome';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { errorResponse, json, upstreamErrorResponse } from '@/lib/api';

/**
 * POST /api/quote  { slug, checkin, checkout, adults, children?, infants?, pets?, promo? }
 *   → 200 Quote  (price breakdown + bookingUrl to Hospitable's hosted checkout)
 *
 * With a promo code, Hospitable refuses the whole quote for an unknown code
 * ("This code is invalid."), and accepts but takes nothing off when the stay
 * doesn't meet the code's terms (e.g. its minimum nights). A refused code is
 * retried without it, so the guest still gets the regular price. Either way
 * `promo.applied` says whether the code's discount is really in the price.
 *
 * Guest contact details are never sent to Hospitable here: when a quote
 * carries them, Hospitable's checkout skips its own details step and then
 * can't take payment. Guests enter them on Hospitable's checkout instead.
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
  const { property, checkin, checkout, adults, children, infants, pets, promo } = result.value;

  try {
    const input: QuoteInput = {
      propertyUuid: property.hospitable.uuid,
      checkin,
      checkout,
      guests: { adults, children, infants, pets },
      customSiteId: SITE.hospitable.siteUuid,
    };
    const quote = promo ? await quoteWithPromo(input, promo) : await createQuote(input);
    return json(quote, { headers: { 'X-RateLimit-Remaining': String(rate.remaining) } });
  } catch (err) {
    if (err instanceof UntrustedCheckoutUrlError) {
      console.error('[quote]', err.message);
      return errorResponse('Couldn’t start checkout. Please try again.', 502);
    }
    return upstreamErrorResponse(err, 'quote');
  }
}

/** Why an accepted code took nothing off: the welcome offer's minimum stay, if that's it. */
function notAppliedReason(code: string, nights: number): string {
  const offer = welcomeOffer();
  if (offer && offer.code.toUpperCase() === code.toUpperCase() && nights < offer.minNights) {
    return `It applies to stays of ${offer.minNights} nights or more.`;
  }
  return 'It doesn’t apply to these dates.';
}

/** Tries the code; if Hospitable refuses the quote with it, prices the stay without it. */
async function quoteWithPromo(input: QuoteInput, code: string): Promise<Quote> {
  try {
    const quote = await createQuote({ ...input, promoCode: code });
    const applied = quote.discounts.some((d) => d.promo || d.label.toUpperCase().includes(code.toUpperCase()));
    return { ...quote, promo: applied ? { code, applied } : { code, applied, message: notAppliedReason(code, quote.nights) } };
  } catch (err) {
    if (!(err instanceof HospitableError) || ![400, 404, 409, 422].includes(err.status)) throw err;
    // If the stay itself can't be booked, this fails the same way and the guest sees that error.
    const quote = await createQuote(input);
    return { ...quote, promo: { code, applied: false, message: err.upstreamMessage || 'This code can’t be used for this stay.' } };
  }
}
