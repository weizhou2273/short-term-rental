import { NextResponse } from 'next/server';
import { getPropertyBySlug } from '@/lib/ownerrez/properties';
import { defaultAvailabilityWindow, getAvailability } from '@/lib/ownerrez/availability';
import { getQuote, StayUnavailableError } from '@/lib/ownerrez/quotes';
import { bookingRequestSchema, validateStay } from '@/lib/booking/validation';
import { bookingReference, createBooking } from '@/lib/ownerrez/bookings';
import { signDraft, type BookingDraft } from '@/lib/booking/draft';
import { resolvePaymentProvider } from '@/lib/payments';
import { PaymentError } from '@/lib/payments/types';
import { absoluteUrl } from '@/lib/config/metadata';
import { apiError, unexpectedError, validationError } from '@/lib/api/respond';
import { clientKey, rateLimit } from '@/lib/api/rate-limit';

/**
 * Step one of checkout: agree the price and start the payment.
 *
 * Nothing the browser sent about money is trusted. The stay is re-validated
 * against the live calendar and re-quoted against OwnerRez here, and the
 * resulting figures are what get signed into the draft and charged. A guest who
 * tampers with the posted total simply gets the real one.
 *
 * No reservation is created at this point — that happens in `/api/booking/confirm`
 * (or the payment webhook) once money has actually moved.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, 'booking'), 10, 5 * 60_000);
  if (!limit.ok) {
    return apiError('Too many attempts. Please wait a moment.', 429, {
      retryAfter: limit.retryAfter,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError('Expected a JSON body.', 400);
  }

  const parsed = bookingRequestSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  const { propertySlug, arrival, departure, guests, guest } = parsed.data;

  try {
    const property = await getPropertyBySlug(propertySlug);
    if (!property) return apiError('That home could not be found.', 404);

    const window = defaultAvailabilityWindow();
    const calendar = await getAvailability(property, window.from, window.to);

    const issues = validateStay({ property, arrival, departure, guests, calendar });
    if (issues.length > 0) {
      return NextResponse.json({ error: issues[0]!.message, issues }, { status: 409 });
    }

    // Authoritative pricing. Whatever the client displayed is irrelevant.
    const quote = await getQuote({ property, arrival, departure, guests });
    const reference = bookingReference();

    const draft: BookingDraft = {
      reference,
      propertyId: property.id,
      propertySlug: property.slug,
      arrival,
      departure,
      guests,
      guest,
      totalAmount: quote.total.amount,
      dueNowAmount: quote.schedule.dueNow.amount,
      currency: quote.currency,
      issuedAt: Math.floor(Date.now() / 1000),
    };

    const provider = resolvePaymentProvider();

    // With no provider configured the booking is taken as a request and the
    // owner invoices manually. This is also what a fresh clone does.
    if (!provider) {
      const booking = await createBooking({
        property,
        quote,
        arrival,
        departure,
        guests,
        guest,
      });
      return NextResponse.json({
        mode: 'request' as const,
        reference: booking.reference,
        quote,
      });
    }

    const draftToken = signDraft(draft);

    // Redirect providers come back to us with only URL parameters to go on, so
    // the signed draft rides along in the return URL. It carries no secret and
    // is worthless without a verified payment.
    const returnUrl = absoluteUrl(
      `/book/${property.slug}/confirm?reference=${encodeURIComponent(reference)}&draft=${encodeURIComponent(draftToken)}`,
    );

    const intent = await provider.createIntent({
      amount: quote.schedule.dueNow,
      stayTotal: quote.total,
      propertyId: property.id,
      propertySlug: property.slug,
      propertyName: property.name,
      arrival,
      departure,
      guest,
      reference,
      draftToken,
      returnUrl,
    });

    return NextResponse.json({
      mode: intent.mode,
      provider: intent.provider,
      reference,
      draft: draftToken,
      clientSecret: intent.clientSecret,
      redirectUrl: intent.redirectUrl,
      publishableKey: intent.publishableKey,
      quote,
    });
  } catch (error) {
    if (error instanceof StayUnavailableError) {
      return apiError(error.message, 409);
    }
    if (error instanceof PaymentError) {
      return apiError(
        error.retryable
          ? 'We could not reach the payment provider. Please try again.'
          : 'We could not start the payment. Please check your details and try again.',
        502,
      );
    }
    return unexpectedError('booking', error);
  }
}
