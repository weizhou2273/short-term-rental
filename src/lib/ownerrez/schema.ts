import { z } from 'zod';

/**
 * Tolerant schemas for the OwnerRez v2 wire format.
 *
 * OwnerRez adds fields over time and omits others per account configuration, so
 * every schema is `passthrough` with optional members. The goal is to fail only
 * when a field we actually depend on is missing or the wrong type — never
 * because the upstream payload grew.
 */

const nullableNumber = z.number().nullish();
const nullableString = z.string().nullish();

/** OwnerRez returns dates as `YYYY-MM-DD` or a full ISO timestamp; keep the date part. */
export const orDate = z
  .string()
  .transform((value) => value.slice(0, 10))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const orAddressSchema = z
  .object({
    city: nullableString,
    state: nullableString,
    country: nullableString,
    postal_code: nullableString,
  })
  .passthrough();

export const orPropertySchema = z
  .object({
    id: z.number(),
    name: z.string(),
    active: z.boolean().nullish(),
    key: nullableString,
    address: orAddressSchema.nullish(),
    latitude: nullableNumber,
    longitude: nullableNumber,
    max_guests: nullableNumber,
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    currency_code: nullableString,
    check_in: nullableString,
    check_out: nullableString,
    property_type: nullableString,
  })
  .passthrough();

export type OrProperty = z.infer<typeof orPropertySchema>;

export const orListingSchema = z
  .object({
    property_id: z.number().nullish(),
    headline: nullableString,
    short_description: nullableString,
    long_description: nullableString,
    description: nullableString,
    amenities: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])).nullish(),
    images: z
      .array(
        z
          .object({
            url: nullableString,
            large_url: nullableString,
            original_url: nullableString,
            caption: nullableString,
            width: nullableNumber,
            height: nullableNumber,
            sort_order: nullableNumber,
          })
          .passthrough(),
      )
      .nullish(),
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    beds: nullableNumber,
    max_guests: nullableNumber,
  })
  .passthrough();

export type OrListing = z.infer<typeof orListingSchema>;

/**
 * A span from the availability endpoint. OwnerRez expresses availability as
 * date ranges rather than per-night rows; we expand them into nights.
 */
export const orAvailabilitySpanSchema = z
  .object({
    start_date: orDate.nullish(),
    end_date: orDate.nullish(),
    start: orDate.nullish(),
    end: orDate.nullish(),
    is_available: z.boolean().nullish(),
    available: z.boolean().nullish(),
    type: nullableString,
    amount: nullableNumber,
    rate: nullableNumber,
    min_nights: nullableNumber,
  })
  .passthrough();

export type OrAvailabilitySpan = z.infer<typeof orAvailabilitySpanSchema>;

export const orQuoteChargeSchema = z
  .object({
    amount: z.number(),
    description: nullableString,
    rule_description: nullableString,
    // OwnerRez charge kinds: Rent, Fee, Tax, Discount, SecurityDeposit, ...
    type: nullableString,
    position: nullableNumber,
    is_expense: z.boolean().nullish(),
  })
  .passthrough();

export const orQuoteSchema = z
  .object({
    id: z.union([z.number(), z.string()]).nullish(),
    property_id: z.number().nullish(),
    arrival: orDate.nullish(),
    departure: orDate.nullish(),
    total_amount: nullableNumber,
    total: nullableNumber,
    currency_code: nullableString,
    charges: z.array(orQuoteChargeSchema).nullish(),
    security_deposit: nullableNumber,
    expires_utc: nullableString,
    is_available: z.boolean().nullish(),
  })
  .passthrough();

export type OrQuote = z.infer<typeof orQuoteSchema>;
export type OrQuoteCharge = z.infer<typeof orQuoteChargeSchema>;

export const orBookingSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    property_id: z.number().nullish(),
    arrival: orDate.nullish(),
    departure: orDate.nullish(),
    status: nullableString,
    guest_id: z.union([z.number(), z.string()]).nullish(),
    total_amount: nullableNumber,
    total_host_fees: nullableNumber,
  })
  .passthrough();

export type OrBooking = z.infer<typeof orBookingSchema>;

export const orGuestSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    first_name: nullableString,
    last_name: nullableString,
    email_addresses: z
      .array(z.object({ address: nullableString }).passthrough())
      .nullish(),
    phones: z.array(z.object({ number: nullableString }).passthrough()).nullish(),
  })
  .passthrough();

export type OrGuest = z.infer<typeof orGuestSchema>;

/**
 * Parses upstream data without throwing away the whole response when one row is
 * malformed — a single bad listing should not blank the homepage.
 */
export function parseMany<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const result = schema.safeParse(row);
    if (result.success) {
      out.push(result.data);
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn(`[ownerrez] skipped malformed ${label}:`, result.error.issues);
    }
  }
  return out;
}
