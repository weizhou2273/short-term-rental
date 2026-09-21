import 'server-only';
import type { Booking } from './types';
import type { BookingDraft } from './draft';
import { getPropertyById } from '@/lib/ownerrez/properties';
import { getQuote } from '@/lib/ownerrez/quotes';
import { createBooking } from '@/lib/ownerrez/bookings';
import { claim, release, settle } from './idempotency';
import { money } from '@/lib/util/money';

/**
 * Turns a paid draft into a reservation.
 *
 * Shared by the browser-driven confirm route and the payment webhook, because
 * both can arrive first: the guest may close the tab before the redirect, or
 * the webhook may beat the redirect back. Whichever gets here first creates the
 * booking; the second is absorbed by the idempotency guard.
 */
export type ConfirmResult =
  | { status: 'created'; booking: Booking }
  | { status: 'duplicate'; bookingId: string | null }
  | { status: 'failed'; message: string };

export async function confirmDraft(
  draft: BookingDraft,
  paymentReference: string,
): Promise<ConfirmResult> {
  const held = claim(draft.reference);
  if (!held.claimed) {
    return { status: 'duplicate', bookingId: held.bookingId };
  }

  try {
    const property = await getPropertyById(draft.propertyId);
    if (!property) {
      release(draft.reference);
      return { status: 'failed', message: 'That home could not be found.' };
    }

    // Re-quote so the reservation carries current OwnerRez figures, but charge
    // nothing further: the guest has already paid the amount signed into the
    // draft, and that is the amount recorded against the booking.
    const quote = await getQuote({
      property,
      arrival: draft.arrival,
      departure: draft.departure,
      guests: draft.guests,
    });

    const booking = await createBooking({
      property,
      quote: {
        ...quote,
        total: money(draft.totalAmount, draft.currency),
        schedule: {
          ...quote.schedule,
          dueNow: money(draft.dueNowAmount, draft.currency),
        },
      },
      arrival: draft.arrival,
      departure: draft.departure,
      guests: draft.guests,
      guest: draft.guest,
      paymentReference,
    });

    settle(draft.reference, booking.externalBookingId ?? null);
    return { status: 'created', booking: { ...booking, reference: draft.reference } };
  } catch (error) {
    // Release so the guest (or the webhook) can retry rather than being stuck
    // paid-but-unbooked behind a claim that will never settle.
    release(draft.reference);
    console.error(`[booking] confirm failed for ${draft.reference}`, error);
    return {
      status: 'failed',
      message:
        'Your payment went through but we could not finish the reservation automatically. We have been alerted and will confirm by email shortly.',
    };
  }
}
