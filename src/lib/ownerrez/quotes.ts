import 'server-only';
import { ownerRezConfigured } from '@/lib/config/env';
import type { GuestCount, Property, Quote } from '@/lib/booking/types';
import { buildQuote } from '@/lib/booking/pricing';
import type { IsoDate } from '@/lib/util/date';
import { ownerRezRequest } from './client';
import { mapQuote } from './mapper';
import { orQuoteSchema } from './schema';

export type QuoteRequest = {
  property: Property;
  arrival: IsoDate;
  departure: IsoDate;
  guests: GuestCount;
};

/**
 * Asks OwnerRez to price a stay. OwnerRez is authoritative: it knows the rate
 * calendar, the fee rules, the tax jurisdictions and any discounts configured
 * on the account, none of which we want to reimplement.
 *
 * When it is unavailable we fall back to the local engine and mark the result
 * `estimated`. Callers that are about to charge a card must check that flag.
 */
export async function getQuote(request: QuoteRequest): Promise<Quote> {
  const { property, arrival, departure, guests } = request;

  if (!ownerRezConfigured()) {
    return buildQuote({ property, arrival, departure, guests });
  }

  try {
    const raw = await ownerRezRequest<unknown>('/quotes', {
      method: 'POST',
      body: {
        property_id: property.id,
        arrival,
        departure,
        adults: guests.adults,
        children: guests.children,
        pets: guests.pets,
      },
      // Pricing must never be served from a cache: rates and availability move.
      revalidate: 0,
    });

    const parsed = orQuoteSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[ownerrez] unrecognised quote payload', parsed.error.issues);
      return buildQuote({ property, arrival, departure, guests });
    }

    if (parsed.data.is_available === false) {
      throw new StayUnavailableError(arrival, departure);
    }

    const quote = mapQuote(parsed.data, {
      propertyId: property.id,
      arrival,
      departure,
      guests,
    });

    // OwnerRez returns the stay total but leaves the deposit split to the
    // account's payment schedule, which the API does not expose on the quote.
    // Reuse the local schedule so the guest always sees what is due today.
    const local = buildQuote({ property, arrival, departure, guests });
    const ratio = quote.total.amount / Math.max(1, local.total.amount);
    return {
      ...quote,
      schedule: {
        dueNow: {
          amount: Math.min(quote.total.amount, Math.round(local.schedule.dueNow.amount * ratio)),
          currency: quote.currency,
        },
        balance: local.schedule.balance
          ? {
              amount: Math.max(
                0,
                quote.total.amount -
                  Math.round(local.schedule.dueNow.amount * ratio),
              ),
              currency: quote.currency,
            }
          : null,
        balanceDueDate: local.schedule.balanceDueDate,
      },
    };
  } catch (error) {
    if (error instanceof StayUnavailableError) throw error;
    console.error('[ownerrez] quote failed; returning local estimate', error);
    return buildQuote({ property, arrival, departure, guests });
  }
}

export class StayUnavailableError extends Error {
  constructor(arrival: IsoDate, departure: IsoDate) {
    super(`These dates are no longer available (${arrival} → ${departure}).`);
    this.name = 'StayUnavailableError';
  }
}
