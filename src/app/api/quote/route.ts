import { NextResponse } from 'next/server';
import { getPropertyById } from '@/lib/ownerrez/properties';
import { defaultAvailabilityWindow, getAvailability } from '@/lib/ownerrez/availability';
import { getQuote, StayUnavailableError } from '@/lib/ownerrez/quotes';
import { stayRequestSchema, validateStay } from '@/lib/booking/validation';
import { apiError, unexpectedError, validationError } from '@/lib/api/respond';
import { clientKey, rateLimit } from '@/lib/api/rate-limit';

/**
 * Prices a stay.
 *
 * Every quote shown to a guest comes from here rather than the browser, so the
 * house rules, the calendar and the rate card are all applied server-side. The
 * response is advisory only — `/api/booking` re-quotes before charging.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Each call can cost an upstream OwnerRez request, so the endpoint is capped.
  const limit = rateLimit(clientKey(request, 'quote'), 40, 60_000);
  if (!limit.ok) {
    return apiError('Too many requests. Give it a moment.', 429, {
      retryAfter: limit.retryAfter,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError('Expected a JSON body.', 400);
  }

  const parsed = stayRequestSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  const { propertyId, arrival, departure, guests } = parsed.data;

  try {
    const property = await getPropertyById(propertyId);
    if (!property) return apiError('That home could not be found.', 404);

    const window = defaultAvailabilityWindow();
    const calendar = await getAvailability(property, window.from, window.to);

    const issues = validateStay({ property, arrival, departure, guests, calendar });
    if (issues.length > 0) {
      return NextResponse.json(
        { error: issues[0]!.message, issues },
        { status: 422 },
      );
    }

    const quote = await getQuote({ property, arrival, departure, guests });
    return NextResponse.json(
      { quote },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof StayUnavailableError) {
      return apiError(error.message, 409, {
        issues: [{ field: 'arrival', message: error.message }],
      });
    }
    return unexpectedError('quote', error);
  }
}
