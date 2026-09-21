import type { OrAvailabilitySpan, OrListing, OrProperty, OrQuote, OrQuoteCharge } from './schema';
import type {
  AvailabilityCalendar,
  AvailabilityNight,
  AvailabilityStatus,
  GuestCount,
  Property,
  PropertyImage,
  Quote,
  QuoteLine,
  QuoteLineKind,
} from '@/lib/booking/types';
import { addDays, nightsBetween, nightsInRange, type IsoDate } from '@/lib/util/date';
import { fromMajorUnits, money, sumMoney, type Money } from '@/lib/util/money';
import { slugify } from '@/lib/util/slug';

/** Strip markup that OwnerRez descriptions sometimes carry, for card summaries. */
function toPlainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

function mapImages(listing: OrListing | null): PropertyImage[] {
  const rows = listing?.images ?? [];
  return [...rows]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .flatMap<PropertyImage>((image) => {
      const url = image.large_url ?? image.original_url ?? image.url ?? null;
      if (!url) return [];
      return [
        {
          url,
          alt: image.caption?.trim() || '',
          width: image.width ?? undefined,
          height: image.height ?? undefined,
        },
      ];
    });
}

function mapAmenities(listing: OrListing | null): Property['amenities'] {
  const rows = listing?.amenities ?? [];
  const seen = new Set<string>();
  const out: Property['amenities'] = [];
  for (const row of rows) {
    const label =
      typeof row === 'string'
        ? row
        : typeof row.name === 'string'
          ? row.name
          : typeof row.title === 'string'
            ? row.title
            : null;
    if (!label) continue;
    const key = slugify(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label });
  }
  return out;
}

export function mapProperty(
  property: OrProperty,
  listing: OrListing | null,
  slug: string,
): Property {
  const currency = (property.currency_code ?? 'USD').toUpperCase();
  const longDescription =
    listing?.long_description ?? listing?.description ?? listing?.short_description ?? '';
  const plain = toPlainText(longDescription);

  return {
    id: property.id,
    slug,
    name: property.name,
    headline: listing?.headline?.trim() || property.name,
    summary: listing?.short_description
      ? truncate(toPlainText(listing.short_description), 180)
      : truncate(plain, 180),
    description: longDescription,
    location: {
      locality: property.address?.city?.trim() || '',
      region: property.address?.state?.trim() || '',
      country: property.address?.country?.trim() || 'US',
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null,
    },
    capacity: {
      maxGuests: listing?.max_guests ?? property.max_guests ?? 2,
      bedrooms: listing?.bedrooms ?? property.bedrooms ?? 1,
      beds: listing?.beds ?? listing?.bedrooms ?? property.bedrooms ?? 1,
      bathrooms: listing?.bathrooms ?? property.bathrooms ?? 1,
    },
    rules: {
      checkInTime: property.check_in?.trim() || '4:00 PM',
      checkOutTime: property.check_out?.trim() || '10:00 AM',
      minNights: 2,
      maxNights: null,
      petsAllowed: false,
      smokingAllowed: false,
      eventsAllowed: false,
      quietHours: null,
    },
    amenities: mapAmenities(listing),
    images: mapImages(listing),
    baseNightlyRate: null,
    currency,
    active: property.active ?? true,
  };
}

function spanBounds(span: OrAvailabilitySpan): { from: IsoDate; to: IsoDate } | null {
  const from = span.start_date ?? span.start ?? null;
  const to = span.end_date ?? span.end ?? null;
  if (!from || !to) return null;
  return { from, to };
}

function spanStatus(span: OrAvailabilitySpan): AvailabilityStatus {
  const available = span.is_available ?? span.available ?? null;
  if (available === true) return 'available';
  const type = (span.type ?? '').toLowerCase();
  if (type.includes('book') || type.includes('reserv')) return 'booked';
  if (available === false) return 'blocked';
  return 'available';
}

/**
 * Expands OwnerRez availability spans into one row per night.
 *
 * Spans are inclusive of `end_date` in the OwnerRez calendar sense (the night
 * of the end date is part of the span), so the expansion runs to `end + 1` to
 * cover it. Later spans win on overlap, matching how OwnerRez layers blocks
 * over the base calendar.
 */
export function mapAvailability(
  propertyId: number,
  from: IsoDate,
  to: IsoDate,
  spans: OrAvailabilitySpan[],
  currency = 'USD',
): AvailabilityCalendar {
  const byDate = new Map<IsoDate, AvailabilityNight>();
  for (const date of nightsInRange(from, to)) {
    byDate.set(date, {
      date,
      status: 'available',
      rate: null,
      minNights: null,
      canCheckIn: true,
      canCheckOut: true,
    });
  }

  for (const span of spans) {
    const bounds = spanBounds(span);
    if (!bounds) continue;
    const status = spanStatus(span);
    const rateValue = span.amount ?? span.rate ?? null;
    const rate = rateValue === null ? null : fromMajorUnits(rateValue, currency);

    for (const date of nightsInRange(bounds.from, addDays(bounds.to, 1))) {
      const night = byDate.get(date);
      if (!night) continue;
      byDate.set(date, {
        ...night,
        status,
        rate: rate ?? night.rate,
        minNights: span.min_nights ?? night.minNights,
        canCheckIn: status === 'available',
        canCheckOut: status === 'available',
      });
    }
  }

  const nights = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  // A night that follows a booked night can still be departed on: guests check
  // out in the morning before the next guest arrives. Mark those changeovers so
  // the calendar can offer them as check-out dates.
  for (let i = 0; i < nights.length; i += 1) {
    const night = nights[i];
    const previous = i > 0 ? nights[i - 1] : undefined;
    if (!night || !previous) continue;
    if (night.status === 'available' && previous.status === 'booked') {
      night.canCheckOut = true;
    }
    if (night.status === 'booked' && previous.status === 'available') {
      // The first booked night is still a valid check-out date for a stay
      // that ends that morning.
      night.canCheckOut = true;
    }
  }

  return { propertyId, from, to, nights };
}

const CHARGE_KIND: Record<string, QuoteLineKind> = {
  rent: 'accommodation',
  accommodation: 'accommodation',
  fee: 'fee',
  hostfee: 'fee',
  tax: 'tax',
  discount: 'discount',
  securitydeposit: 'deposit',
  damageprotection: 'fee',
};

function chargeKind(charge: OrQuoteCharge): QuoteLineKind {
  const raw = (charge.type ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const mapped = CHARGE_KIND[raw];
  if (mapped) return mapped;
  // Discounts arrive as negative amounts even when untyped.
  return charge.amount < 0 ? 'discount' : 'fee';
}

export function mapQuote(
  quote: OrQuote,
  request: { propertyId: number; arrival: IsoDate; departure: IsoDate; guests: GuestCount },
): Quote {
  const currency = (quote.currency_code ?? 'USD').toUpperCase();
  const charges = [...(quote.charges ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const lines: QuoteLine[] = [];
  let securityDeposit: Money | null = null;

  for (const charge of charges) {
    const kind = chargeKind(charge);
    const amount = fromMajorUnits(charge.amount, currency);
    const label = charge.description?.trim() || charge.rule_description?.trim() || 'Charge';

    if (kind === 'deposit') {
      securityDeposit = amount;
      continue;
    }
    lines.push({ kind, label, amount });
  }

  if (securityDeposit === null && quote.security_deposit) {
    securityDeposit = fromMajorUnits(quote.security_deposit, currency);
  }

  const nights = nightsBetween(request.arrival, request.departure);
  const accommodation = sumMoney(
    lines.filter((line) => line.kind === 'accommodation').map((line) => line.amount),
    currency,
  );
  const discounts = sumMoney(
    lines.filter((line) => line.kind === 'discount').map((line) => line.amount),
    currency,
  );
  const subtotal = money(accommodation.amount + discounts.amount, currency);

  const totalValue = quote.total_amount ?? quote.total ?? null;
  const total =
    totalValue === null
      ? sumMoney(
          lines.map((line) => line.amount),
          currency,
        )
      : fromMajorUnits(totalValue, currency);

  return {
    propertyId: request.propertyId,
    arrival: request.arrival,
    departure: request.departure,
    nights,
    guests: request.guests,
    currency,
    lines,
    subtotal,
    total,
    securityDeposit,
    schedule: { dueNow: total, balance: null, balanceDueDate: null },
    externalQuoteId: quote.id === null || quote.id === undefined ? undefined : String(quote.id),
    estimated: false,
    expiresAt: quote.expires_utc ?? undefined,
  };
}
