import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { z } from 'zod';
import { PROPERTIES } from '@/data/properties';
import { checkStayWindow } from '@/lib/booking/validate';
import { isIsoDate, nightsBetween } from '@/lib/dates';
import { money } from '@/lib/format';
import type { SearchResult } from '@/lib/booking/types';
import type { SearchInput } from '@/lib/hospitable/search';
import { stayQuery } from '@/lib/search-params';

/** The assistant's one tool: live availability and pre-tax prices for every home, via the site's own search. */

export const CHECK_AVAILABILITY = 'check_availability';

export const checkAvailabilityTool: BetaTool = {
  name: CHECK_AVAILABILITY,
  description:
    'Live availability and prices for every home for one stay, from our booking system. Call it whenever the guest asks about prices, availability or booking for particular dates. Returns each home with whether it is available, whether it sleeps the group, the total before taxes, the average nightly rate and a booking link with the stay filled in.',
  // Streamed requests with client tools set this; the input is validated below before use.
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: {
      checkin: { type: 'string', description: 'Check-in date, YYYY-MM-DD.' },
      checkout: { type: 'string', description: 'Check-out date, YYYY-MM-DD.' },
      adults: { type: 'integer', minimum: 1, description: 'Number of adults. Use 1 if the guest has not said.' },
      children: { type: 'integer', minimum: 0, description: 'Number of children, if any.' },
      infants: { type: 'integer', minimum: 0, description: 'Number of infants, if any.' },
      pets: { type: 'integer', minimum: 0, description: 'Number of pets, if any.' },
    },
    required: ['checkin', 'checkout', 'adults'],
  },
};

const isoDate = z.string().refine(isIsoDate, 'Use YYYY-MM-DD dates.');
export const checkAvailabilityInput = z.object({
  checkin: isoDate,
  checkout: isoDate,
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(50).optional(),
  infants: z.number().int().min(0).max(20).optional(),
  pets: z.number().int().min(0).max(10).optional(),
});
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilityInput>;

export type ToolOutcome = { content: string; isError: boolean };

type Deps = { search: (input: SearchInput) => Promise<SearchResult[]>; now?: Date };

/** Runs the tool on input already validated with `checkAvailabilityInput`. Never throws. */
export async function checkAvailability(input: CheckAvailabilityInput, { search, now = new Date() }: Deps): Promise<ToolOutcome> {
  const { checkin, checkout, adults, children = 0, infants = 0, pets = 0 } = input;
  const windowError = checkStayWindow(checkin, checkout, now);
  if (windowError) return { content: windowError, isError: true };

  let results: SearchResult[];
  try {
    results = await search({ checkin, checkout, guests: { adults, children, infants, pets } });
  } catch (err) {
    console.error('[chat] availability search failed', err);
    return {
      content: 'The booking system could not be reached. Suggest the guest tries the home pages directly or contacts the host.',
      isError: true,
    };
  }

  const people = adults + children;
  const query = stayQuery({ checkin, checkout, adults });
  const extra = new URLSearchParams();
  if (children) extra.set('children', String(children));
  if (infants) extra.set('infants', String(infants));
  if (pets) extra.set('pets', String(pets));
  const homes = PROPERTIES.map((p) => {
    const r = results.find((x) => x.slug === p.slug);
    const fits = people <= p.guests && (!pets || p.features.petFriendly);
    const available = Boolean(r?.available);
    return {
      name: p.name,
      page: `/stays/${p.slug}`,
      sleeps: p.guests,
      fits_group: fits,
      available,
      total_before_taxes: r?.totalWithoutTaxes != null ? money(r.totalWithoutTaxes, r.currency) : null,
      average_nightly: r?.nightlyAverage != null ? money(r.nightlyAverage, r.currency) : null,
      booking_link: available && fits ? `/stays/${p.slug}${query}${extra.size ? `&${extra}` : ''}` : null,
    };
  });

  return {
    content: JSON.stringify({ stay: { checkin, checkout, nights: nightsBetween(checkin, checkout), adults, children, infants, pets }, homes }),
    isError: false,
  };
}
