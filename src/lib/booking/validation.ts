import { z } from 'zod';
import type { AvailabilityCalendar, GuestCount, Property } from './types';
import { totalGuests } from './types';
import { isIsoDate, nightsBetween, nightsInRange, today, type IsoDate } from '@/lib/util/date';

/**
 * Request validation for every public entry point. These schemas are the trust
 * boundary: route handlers parse with them before anything touches OwnerRez or
 * Stripe, so downstream code can assume well-formed input.
 */

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'Expected a calendar date in YYYY-MM-DD form' });

export const guestCountSchema = z.object({
  adults: z.number().int().min(1).max(30),
  children: z.number().int().min(0).max(30),
  infants: z.number().int().min(0).max(10),
  pets: z.number().int().min(0).max(5),
});

export const defaultGuestCount: GuestCount = {
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
};

export const stayRequestSchema = z
  .object({
    propertyId: z.number().int().positive(),
    arrival: isoDateSchema,
    departure: isoDateSchema,
    guests: guestCountSchema.default(defaultGuestCount),
  })
  .refine((value) => nightsBetween(value.arrival, value.departure) > 0, {
    message: 'Departure must be after arrival',
    path: ['departure'],
  })
  .refine((value) => nightsBetween(value.arrival, value.departure) <= 365, {
    message: 'Stays longer than a year must be arranged directly',
    path: ['departure'],
  });

export type StayRequest = z.infer<typeof stayRequestSchema>;

export const guestDetailsSchema = z.object({
  firstName: z.string().trim().min(1, 'Required').max(80),
  lastName: z.string().trim().min(1, 'Required').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  // Deliberately permissive: international formats vary and a rejected valid
  // number costs a booking. OwnerRez normalises on its side.
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a contact number')
    .max(32)
    .regex(/^[+()\-.\s\d]+$/, 'Enter a valid phone number'),
  notes: z.string().trim().max(2_000).optional(),
});

export type GuestDetailsInput = z.infer<typeof guestDetailsSchema>;

export const bookingRequestSchema = z.object({
  propertySlug: z.string().trim().min(1).max(120),
  arrival: isoDateSchema,
  departure: isoDateSchema,
  guests: guestCountSchema,
  guest: guestDetailsSchema,
  /** Guest ticked the terms box. Enforced server-side, not just in the UI. */
  acceptedTerms: z.literal(true, 'Please accept the rental terms to continue'),
});

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const inquirySchema = z.object({
  propertySlug: z.string().trim().max(120).optional(),
  name: z.string().trim().min(1, 'Required').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  arrival: isoDateSchema.optional(),
  departure: isoDateSchema.optional(),
  message: z.string().trim().min(10, 'Tell us a little more').max(4_000),
  /** Honeypot: real guests never fill this; bots fill everything. */
  company: z.string().max(0).optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export type StayValidationIssue = {
  field: 'arrival' | 'departure' | 'guests';
  message: string;
};

/**
 * Enforces house rules and calendar state for a proposed stay.
 *
 * Runs on the server before any charge. The client runs it too, for instant
 * feedback, but the server result is the one that decides.
 */
export function validateStay(args: {
  property: Property;
  arrival: IsoDate;
  departure: IsoDate;
  guests: GuestCount;
  calendar?: AvailabilityCalendar | null;
  now?: IsoDate;
}): StayValidationIssue[] {
  const { property, arrival, departure, guests, calendar } = args;
  const now = args.now ?? today();
  const issues: StayValidationIssue[] = [];

  if (arrival < now) {
    issues.push({ field: 'arrival', message: 'Arrival cannot be in the past.' });
  }

  const nights = nightsBetween(arrival, departure);
  if (nights <= 0) {
    issues.push({ field: 'departure', message: 'Departure must be after arrival.' });
    return issues;
  }

  const stayNights = nightsInRange(arrival, departure);

  // The calendar can raise the minimum for specific dates (holiday weekends).
  const calendarMinimum = calendar
    ? Math.max(
        0,
        ...stayNights.map((date) => {
          const night = calendar.nights.find((row) => row.date === date);
          return night?.minNights ?? 0;
        }),
      )
    : 0;
  const minNights = Math.max(property.rules.minNights, calendarMinimum);

  if (nights < minNights) {
    issues.push({
      field: 'departure',
      message: `These dates have a ${minNights}-night minimum.`,
    });
  }

  if (property.rules.maxNights !== null && nights > property.rules.maxNights) {
    issues.push({
      field: 'departure',
      message: `Stays are capped at ${property.rules.maxNights} nights. Get in touch for longer.`,
    });
  }

  const occupants = totalGuests(guests);
  if (occupants > property.capacity.maxGuests) {
    issues.push({
      field: 'guests',
      message: `${property.name} sleeps ${property.capacity.maxGuests}.`,
    });
  }

  if (guests.pets > 0 && !property.rules.petsAllowed) {
    issues.push({ field: 'guests', message: 'This home cannot take pets.' });
  }

  if (calendar) {
    const unavailable = stayNights.find((date) => {
      const night = calendar.nights.find((row) => row.date === date);
      // A night outside the fetched window is unknown, not unavailable.
      return night ? night.status !== 'available' : false;
    });
    if (unavailable) {
      issues.push({
        field: 'arrival',
        message: 'One or more of these nights is already taken.',
      });
    }

    const arrivalNight = calendar.nights.find((row) => row.date === arrival);
    if (arrivalNight && !arrivalNight.canCheckIn) {
      issues.push({ field: 'arrival', message: 'Check-in is not available on this date.' });
    }
    const departureNight = calendar.nights.find((row) => row.date === departure);
    if (departureNight && !departureNight.canCheckOut) {
      issues.push({
        field: 'departure',
        message: 'Check-out is not available on this date.',
      });
    }
  }

  return issues;
}

/** Turns a zod error into the `{ field: message }` shape the forms render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    out[key] ??= issue.message;
  }
  return out;
}
