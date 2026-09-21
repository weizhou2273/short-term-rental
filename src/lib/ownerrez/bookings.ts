import 'server-only';
import { randomUUID } from 'node:crypto';
import { ownerRezConfigured } from '@/lib/config/env';
import type {
  Booking,
  GuestCount,
  GuestDetails,
  Property,
  Quote,
} from '@/lib/booking/types';
import type { IsoDate } from '@/lib/util/date';
import { ownerRezRequest } from './client';
import { orBookingSchema, orGuestSchema } from './schema';

/**
 * Creating a reservation in OwnerRez is a two-step affair: the guest record
 * first, then the booking that references it. Both are done here so callers see
 * one atomic-looking operation.
 */

export type CreateBookingInput = {
  property: Property;
  quote: Quote;
  arrival: IsoDate;
  departure: IsoDate;
  guests: GuestCount;
  guest: GuestDetails;
  /** Payment reference from Stripe or OwnerRez, recorded on the booking notes. */
  paymentReference?: string;
};

/** Guest-facing reference. Short, unambiguous when read aloud, no 0/O or 1/I. */
export function bookingReference(): string {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY2346789';
  const bytes = randomUUID().replace(/-/g, '');
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    const byte = Number.parseInt(bytes.slice(i * 2, i * 2 + 2), 16);
    out += alphabet[byte % alphabet.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

async function upsertGuest(guest: GuestDetails): Promise<string | null> {
  try {
    const raw = await ownerRezRequest<unknown>('/guests', {
      method: 'POST',
      body: {
        first_name: guest.firstName,
        last_name: guest.lastName,
        email_addresses: [{ address: guest.email, is_default: true }],
        phones: [{ number: guest.phone, is_default: true }],
      },
      revalidate: 0,
    });
    const parsed = orGuestSchema.safeParse(raw);
    return parsed.success ? String(parsed.data.id) : null;
  } catch (error) {
    // A missing guest record is recoverable — OwnerRez will create one from the
    // booking payload — so never fail the reservation over it.
    console.error('[ownerrez] guest create failed; booking without guest id', error);
    return null;
  }
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const { property, quote, arrival, departure, guests, guest, paymentReference } = input;
  const reference = bookingReference();

  const base: Booking = {
    reference,
    status: 'confirmed',
    propertyId: property.id,
    propertySlug: property.slug,
    arrival,
    departure,
    guests,
    guest,
    total: quote.total,
    paidNow: quote.schedule.dueNow,
    createdAt: new Date().toISOString(),
  };

  if (!ownerRezConfigured()) {
    // Without credentials the booking is recorded locally only. The checkout
    // route makes this visible rather than implying a real reservation exists.
    return { ...base, status: 'awaiting_owner_approval' };
  }

  const guestId = await upsertGuest(guest);

  const raw = await ownerRezRequest<unknown>('/bookings', {
    method: 'POST',
    body: {
      property_id: property.id,
      arrival,
      departure,
      adults: guests.adults,
      children: guests.children,
      pets: guests.pets,
      guest_id: guestId ?? undefined,
      guest: guestId
        ? undefined
        : {
            first_name: guest.firstName,
            last_name: guest.lastName,
            email_addresses: [{ address: guest.email, is_default: true }],
            phones: [{ number: guest.phone, is_default: true }],
          },
      notes: [
        `Direct booking ${reference}`,
        paymentReference ? `Payment: ${paymentReference}` : null,
        guest.notes ? `Guest notes: ${guest.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    },
    revalidate: 0,
  });

  const parsed = orBookingSchema.safeParse(raw);
  if (!parsed.success) {
    // The reservation may well have been created; surfacing a hard failure
    // would invite a double booking, so flag it for manual reconciliation.
    console.error('[ownerrez] booking response unrecognised', parsed.error.issues);
    return { ...base, status: 'awaiting_owner_approval' };
  }

  return {
    ...base,
    externalBookingId: String(parsed.data.id),
    status: parsed.data.status?.toLowerCase() === 'booked' ? 'confirmed' : 'confirmed',
  };
}
