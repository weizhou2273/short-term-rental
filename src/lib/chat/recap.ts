import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';
import type { SearchResult } from '@/lib/booking/types';
import { checkStayWindow } from '@/lib/booking/validate';
import { isIsoDate, nightsBetween, PROPERTY_TIME_ZONE, todayIso } from '@/lib/dates';
import type { Email } from '@/lib/email/send';
import { money, plural } from '@/lib/format';
import type { SearchInput } from '@/lib/hospitable/search';
import { minStayText, type WelcomeOffer } from '@/lib/offer/welcome';
import { SITE_URL } from '@/lib/seo';
import type { Lead } from './request';
import { firstName } from './shared';

/**
 * The follow-up a chat guest gets the moment they leave the chat: what they
 * told us (dates, group), which homes are open for those dates with live
 * prices and booking links, the welcome code, and "just reply".
 *
 * Claude only reads the conversation and fills in a fixed form
 * (extractTripFacts); availability and prices come from Hospitable, and the
 * wording is written here, so nothing in the email is made up.
 */

export const RECAP_MODEL = 'claude-opus-5-5';
export const RECAP_SUBJECT_PREFIX = 'Your Poconos stay';

type Turn = { role: 'user' | 'assistant'; content: string };

const slugs = PROPERTIES.map((p) => p.slug) as [string, ...string[]];

export const tripFactsSchema = z.object({
  checkin: z.string().nullable().describe('Check-in date the guest asked about, YYYY-MM-DD, or null if they gave none.'),
  checkout: z.string().nullable().describe('Check-out date, YYYY-MM-DD, or null.'),
  adults: z.number().int().nullable().describe('Adults (or total people if the guest gave only a total), or null if not said.'),
  children: z.number().int().nullable().describe('Children, or null if not said.'),
  pets: z.number().int().nullable().describe('Pets, or null if not said.'),
  homes: z.array(z.enum(slugs)).describe('Homes the guest asked about or showed interest in, if any.'),
});
export type TripFacts = z.infer<typeof tripFactsSchema>;

const extractionInstructions = (now: Date) =>
  `You read a chat between a guest and the concierge of ${SITE.brand}, a Poconos vacation rental company, and fill in the guest's trip details. ` +
  `Today is ${todayIso(now)} (${PROPERTY_TIME_ZONE}). Use only what the guest said, or what the concierge repeated back from the guest; never guess. ` +
  `Write dates as YYYY-MM-DD; when the guest gives no year, use the next time that date comes after today. ` +
  `Leave a field null when the guest didn't give it. The homes are: ${PROPERTIES.map((p) => `${p.slug} (${p.name})`).join(', ')}.`;

const transcriptText = (lead: Lead, messages: Turn[]) =>
  messages.map((m) => `${m.role === 'user' ? firstName(lead.name) || 'Guest' : 'Concierge'}: ${m.content}`).join('\n\n');

/** The guest's dates, group and homes of interest, read from the chat by Claude. Null if it can't be read. */
export async function extractTripFacts(
  client: Pick<Anthropic, 'beta'>,
  lead: Lead,
  messages: Turn[],
  now = new Date(),
): Promise<TripFacts | null> {
  const response = await client.beta.messages.parse({
    model: RECAP_MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: betaZodOutputFormat(tripFactsSchema) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: extractionInstructions(now),
    messages: [{ role: 'user', content: `<chat>\n${transcriptText(lead, messages)}\n</chat>` }],
  });
  if (response.stop_reason === 'refusal') return null;
  return response.parsed_output ?? null;
}

/** "Wed, Dec 30, 2026" */
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export type Stay = { checkin: string; checkout: string; adults: number; children: number; pets: number; known: boolean };

/** A stay we can price: real dates in the bookable window. `known` says whether the guest gave the group size. */
export function stayFrom(facts: TripFacts | null, now = new Date()): Stay | null {
  if (!facts?.checkin || !facts.checkout || !isIsoDate(facts.checkin) || !isIsoDate(facts.checkout)) return null;
  if (checkStayWindow(facts.checkin, facts.checkout, now)) return null;
  const clamp = (n: number | null, max: number) => Math.max(0, Math.min(max, n ?? 0));
  return {
    checkin: facts.checkin,
    checkout: facts.checkout,
    adults: Math.max(1, clamp(facts.adults, 50)),
    children: clamp(facts.children, 50),
    pets: clamp(facts.pets, 10),
    known: facts.adults != null,
  };
}

type RecapInput = {
  lead: Lead;
  facts: TripFacts | null;
  stay: Stay | null;
  /** Hospitable's answer for the stay; null when there's no stay to price or the search failed. */
  results: SearchResult[] | null;
  offer: WelcomeOffer | null;
};

/** Writes the recap email from facts only: what the guest said and what Hospitable returned. */
export function buildRecap({ lead, facts, stay, results, offer }: RecapInput): Email {
  const name = firstName(lead.name);
  const people = stay ? stay.adults + stay.children : 0;
  const interest = new Set(facts?.homes ?? []);
  const promo = offer ? `&promo=${encodeURIComponent(offer.code)}` : '';
  const link = (slug: string) => {
    if (!stay) return `${SITE_URL}/stays/${slug}${offer ? `?promo=${encodeURIComponent(offer.code)}` : ''}`;
    const q = new URLSearchParams({ checkin: stay.checkin, checkout: stay.checkout });
    if (stay.known) q.set('adults', String(stay.adults));
    if (stay.children) q.set('children', String(stay.children));
    if (stay.pets) q.set('pets', String(stay.pets));
    return `${SITE_URL}/stays/${slug}?${q}${promo}`;
  };

  // Homes that are open and fit the group, the ones the guest asked about first.
  const open = stay && results
    ? PROPERTIES.filter((p) => {
        const r = results.find((x) => x.slug === p.slug);
        return r?.available && (!stay.known || people <= p.guests) && (!stay.pets || p.features.petFriendly);
      })
        .sort((a, b) => Number(interest.has(b.slug)) - Number(interest.has(a.slug)))
        .map((p) => ({ p, r: results.find((x) => x.slug === p.slug)! }))
    : [];

  const paragraphs: string[] = [];
  const htmlBlocks: string[] = [];
  const say = (text: string) => {
    paragraphs.push(text);
    htmlBlocks.push(`<p>${esc(text)}</p>`);
  };

  say(`Hi ${name || 'there'},`);
  say(`Thanks for chatting with us at ${SITE.domain}! Here’s a quick recap so you have everything in one place.`);

  if (stay) {
    const nights = nightsBetween(stay.checkin, stay.checkout);
    const group = stay.known
      ? `${plural(people, 'guest')}${stay.pets ? `, ${plural(stay.pets, 'pet')}` : ''}`
      : null;
    say(`Your dates: ${longDate(stay.checkin)} – ${longDate(stay.checkout)} (${plural(nights, 'night')})${group ? ` for ${group}` : ''}.`);
    if (results === null) {
      say('I couldn’t check live availability just now. Reply with your group size and I’ll send you what’s open.');
    } else if (open.length) {
      const intro = `${open.length === 1 ? 'This home is' : 'These homes are'} open for your dates (live prices, before taxes):`;
      const lines = open.map(({ p, r }) => {
        const price = r.totalWithoutTaxes != null ? `${money(r.totalWithoutTaxes, r.currency)} total` : 'see price';
        return { text: `• ${p.name} (sleeps ${p.guests}): ${price}. ${link(p.slug)}`, p, price };
      });
      paragraphs.push(`${intro}\n${lines.map((l) => l.text).join('\n')}`);
      htmlBlocks.push(
        `<p>${esc(intro)}</p><ul style="padding-left:20px;margin:0 0 14px">${lines
          .map(
            ({ p, price }) =>
              `<li style="margin-bottom:6px"><a href="${esc(link(p.slug))}" style="color:#1F3A2E;font-weight:600">${esc(p.name)}</a> (sleeps ${p.guests}): ${esc(price)}</li>`,
          )
          .join('')}</ul>`,
      );
      if (!stay.known) say('How many people are coming? Just reply and I’ll tell you which home fits best.');
    } else {
      say(`Those exact dates are already booked at the homes that fit${stay.known ? ' your group' : ''}. Reply and I’ll suggest the closest open dates.`);
    }
  } else {
    const homes = PROPERTIES.map((p) => `${p.name} (sleeps ${p.guests})`).join(', ');
    say(`When are you thinking of coming, and how many people? Just reply with your dates and I’ll send you what’s open with live prices. Our homes: ${homes}. See them all at ${SITE_URL}/search`);
  }

  if (offer) {
    say(
      `Your welcome code: ${offer.code}, for ${offer.percent}% off the nightly rate of your first direct stay${minStayText(offer.minNights)}. The links above apply it for you.`,
    );
  }
  say('Any other questions? Just hit reply. I read every message and answer personally.');
  const signature = `${SITE.hostName}\n${SITE.brand} · ${SITE_URL} · call or text ${SITE.contactPhone}`;
  paragraphs.push(signature);
  htmlBlocks.push(
    `<p>${esc(SITE.hostName)}<br><span style="color:#666">${esc(SITE.brand)} · <a href="${esc(SITE_URL)}" style="color:#8C6A3A">${esc(SITE.domain)}</a> · call or text ${esc(SITE.contactPhone)}</span></p>`,
  );
  const optOut = `You’re getting this because you chatted with us at ${SITE.domain}. Reply “stop” and we won’t email you again.`;
  paragraphs.push(optOut);
  htmlBlocks.push(`<p style="font-size:12px;color:#888">${esc(optOut)}</p>`);

  const when = stay ? `, ${longDate(stay.checkin).replace(/, \d{4}$/, '')} – ${longDate(stay.checkout).replace(/, \d{4}$/, '')}` : '';
  return {
    to: lead.email,
    subject: `${RECAP_SUBJECT_PREFIX}${when}`,
    text: paragraphs.join('\n\n'),
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1a;max-width:560px">${htmlBlocks.join('\n')}</div>`,
    replyTo: SITE.contactEmail,
    fromName: `${SITE.hostName} at ${SITE.brand}`,
    bccHost: true,
  };
}

type SendDeps = {
  client: Pick<Anthropic, 'beta'>;
  search: (input: SearchInput) => Promise<SearchResult[]>;
  send: (email: Email) => Promise<void>;
  alreadySent: (to: string, subjectPrefix: string) => Promise<boolean>;
  offer: WelcomeOffer | null;
  now?: Date;
};

/**
 * Sends the recap once per guest (at most one a day), right after the chat.
 * Returns what happened, for the log.
 */
export async function sendRecap(lead: Lead, messages: Turn[], deps: SendDeps): Promise<'sent' | 'skipped: already sent' | 'skipped: no question'> {
  const now = deps.now ?? new Date();
  if (!messages.some((m) => m.role === 'user')) return 'skipped: no question';
  if (await deps.alreadySent(lead.email, RECAP_SUBJECT_PREFIX)) return 'skipped: already sent';

  const facts = await extractTripFacts(deps.client, lead, messages, now).catch((err) => {
    console.error('[recap] could not read the chat:', err instanceof Error ? err.message : err);
    return null;
  });
  const stay = stayFrom(facts, now);
  let results: SearchResult[] | null = null;
  if (stay) {
    results = await deps
      .search({ checkin: stay.checkin, checkout: stay.checkout, guests: { adults: stay.adults, children: stay.children, pets: stay.pets } })
      .catch((err) => {
        console.error('[recap] availability search failed:', err instanceof Error ? err.message : err);
        return null;
      });
  }
  await deps.send(buildRecap({ lead, facts, stay, results, offer: deps.offer }));
  return 'sent';
}
