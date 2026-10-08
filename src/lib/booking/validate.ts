import { z } from 'zod';
import { getPropertyBySlug } from '@/data/properties';
import type { Property } from '@/data/types';
import { isIsoDate, nightsBetween, todayIso } from '@/lib/dates';
import { isValidEmail, MAX_INFANTS, MAX_PETS, NAME_MAX, normalizePhone, PHONE_ERROR } from './guest';

/**
 * Request validation for the booking routes. The browser names a property by
 * slug, never by Hospitable UUID, so the write-scoped token can only ever be
 * used against the properties listed in PROPERTIES.
 */

/** Hospitable's search caps a stay window at 90 days; quotes use the same ceiling. */
export const MAX_NIGHTS = 90;

const isoDate = z.string().refine(isIsoDate, 'Use YYYY-MM-DD dates.');
const count = (max: number) => z.coerce.number().int().min(0).max(max);

const name = (label: string) =>
  z.string().trim().min(1, `Enter your ${label}.`).max(NAME_MAX, 'That name is too long.');

/**
 * Sent only with the final quote at Reserve, so Hospitable's checkout opens
 * pre-filled. All four fields are required when it is present.
 */
const guestDetailsSchema = z.object({
  firstName: name('first name'),
  lastName: name('last name'),
  email: z.string().trim().refine(isValidEmail, 'Enter a valid email address.'),
  phone: z.string().transform((value, ctx) => {
    const e164 = normalizePhone(value);
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: PHONE_ERROR });
      return z.NEVER;
    }
    return e164;
  }),
});

export const quoteRequestSchema = z.object({
  slug: z.string().min(1).max(80),
  checkin: isoDate,
  checkout: isoDate,
  adults: z.coerce.number().int().min(1).max(50),
  children: count(50).optional(),
  infants: count(MAX_INFANTS).optional(),
  pets: count(MAX_PETS).optional(),
  guest: guestDetailsSchema.optional(),
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export type ValidStay = QuoteRequest & { property: Property };

export type ValidationResult = { ok: true; value: ValidStay } | { ok: false; error: string; status: number };

/** Checks the date window on its own; shared with search. */
export function checkStayWindow(checkin: string, checkout: string, now = new Date()): string | null {
  if (checkin < todayIso(now)) return 'Check-in can’t be in the past.';
  const nights = nightsBetween(checkin, checkout);
  if (nights < 1) return 'Check-out must be after check-in.';
  if (nights > MAX_NIGHTS) return `Stays are limited to ${MAX_NIGHTS} nights online. Contact us for longer stays.`;
  return null;
}

export function validateQuoteRequest(input: unknown, now = new Date()): ValidationResult {
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  }
  const req = parsed.data;

  const property = getPropertyBySlug(req.slug);
  if (!property) return { ok: false, status: 404, error: 'That stay isn’t listed.' };

  const windowError = checkStayWindow(req.checkin, req.checkout, now);
  if (windowError) return { ok: false, status: 400, error: windowError };

  const people = req.adults + (req.children ?? 0);
  if (people > property.guests) {
    return { ok: false, status: 400, error: `${property.name} sleeps up to ${property.guests} guests.` };
  }

  return { ok: true, value: { ...req, property } };
}
