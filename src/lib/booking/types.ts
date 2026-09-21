import type { IsoDate } from '@/lib/util/date';
import type { Money } from '@/lib/util/money';

/**
 * The domain model the UI renders. Deliberately decoupled from the OwnerRez
 * wire format: adapters in `lib/ownerrez` map into these types, so a change to
 * the upstream API touches one mapper rather than every component.
 */

export type PropertyImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

export type Amenity = {
  /** Stable key, used to pick an icon. */
  key: string;
  label: string;
};

export type PropertyRules = {
  checkInTime: string;
  checkOutTime: string;
  minNights: number;
  maxNights: number | null;
  petsAllowed: boolean;
  smokingAllowed: boolean;
  eventsAllowed: boolean;
  quietHours: string | null;
};

export type Property = {
  /** OwnerRez property id. */
  id: number;
  slug: string;
  name: string;
  headline: string;
  /** Short plain-text summary for cards and meta descriptions. */
  summary: string;
  /** Long-form description. May contain sanitised HTML when sourced from WordPress. */
  description: string;
  location: {
    locality: string;
    region: string;
    country: string;
    /** Approximate coordinates — exact address is withheld until a stay is confirmed. */
    latitude: number | null;
    longitude: number | null;
  };
  capacity: {
    maxGuests: number;
    bedrooms: number;
    beds: number;
    bathrooms: number;
  };
  rules: PropertyRules;
  amenities: Amenity[];
  images: PropertyImage[];
  /** Lowest nightly rate seen in the forward rate window, for "from $X" display. */
  baseNightlyRate: Money | null;
  currency: string;
  active: boolean;
};

export type AvailabilityStatus = 'available' | 'booked' | 'blocked' | 'changeover';

export type AvailabilityNight = {
  date: IsoDate;
  status: AvailabilityStatus;
  /** Nightly rate for this date, when the rate calendar exposes one. */
  rate: Money | null;
  minNights: number | null;
  /** Whether a stay may start on this date. */
  canCheckIn: boolean;
  /** Whether a stay may end on this date. */
  canCheckOut: boolean;
};

export type AvailabilityCalendar = {
  propertyId: number;
  from: IsoDate;
  to: IsoDate;
  nights: AvailabilityNight[];
};

export type QuoteLineKind = 'accommodation' | 'fee' | 'tax' | 'discount' | 'deposit';

export type QuoteLine = {
  kind: QuoteLineKind;
  label: string;
  amount: Money;
  /** Explanatory copy shown under the line, e.g. "$650 × 3 nights". */
  detail?: string;
  /** Refundable holds are collected but not part of the stay price. */
  refundable?: boolean;
};

export type PaymentSchedule = {
  /** Charged now, at booking. */
  dueNow: Money;
  /** Remaining balance, if the property takes a split payment. */
  balance: Money | null;
  balanceDueDate: IsoDate | null;
};

export type Quote = {
  propertyId: number;
  arrival: IsoDate;
  departure: IsoDate;
  nights: number;
  guests: GuestCount;
  currency: string;
  lines: QuoteLine[];
  /** Accommodation after discounts, before fees and tax. */
  subtotal: Money;
  /** Everything the guest pays for the stay, including fees and tax. */
  total: Money;
  /** Refundable security hold, excluded from `total`. */
  securityDeposit: Money | null;
  schedule: PaymentSchedule;
  /** OwnerRez quote id when the quote was produced upstream. */
  externalQuoteId?: string;
  /** True when produced by the local fallback engine rather than OwnerRez. */
  estimated: boolean;
  expiresAt?: string;
};

export type GuestCount = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type GuestDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
};

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'awaiting_owner_approval'
  | 'failed'
  | 'cancelled';

export type Booking = {
  /** Our reference, shown to the guest. */
  reference: string;
  status: BookingStatus;
  propertyId: number;
  propertySlug: string;
  arrival: IsoDate;
  departure: IsoDate;
  guests: GuestCount;
  guest: GuestDetails;
  total: Money;
  paidNow: Money;
  /** OwnerRez booking id, once the reservation exists upstream. */
  externalBookingId?: string;
  createdAt: string;
};

export function totalGuests(guests: GuestCount): number {
  // Infants do not count toward the occupancy cap; pets are counted separately.
  return guests.adults + guests.children;
}
