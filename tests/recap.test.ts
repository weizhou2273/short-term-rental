import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROPERTIES } from '@/data/properties';
import type { SearchResult } from '@/lib/booking/types';
import { buildRecap, extractTripFacts, RECAP_MODEL, sendRecap, stayFrom, type TripFacts } from '@/lib/chat/recap';
import { sentRecently } from '@/lib/email/send';

const NOW = new Date('2026-11-11T15:00:00Z');
const KELSEY = { name: 'kelsey', email: 'yuki@example.com', phone: '2012406958' };
const OFFER = { code: 'WELCOME5', percent: 5, minNights: 2 };
const chat = [
  { role: 'user' as const, content: 'any discount' },
  { role: 'assistant' as const, content: 'Send me your dates and group size.' },
  { role: 'user' as const, content: '12/30-1/14' },
];
const facts = (f: Partial<TripFacts>): TripFacts => ({ checkin: null, checkout: null, adults: null, children: null, pets: null, homes: [], ...f });
// Hospitable's answer for Dec 30 – Jan 14 (Nov 2026): only Minsi Pond and Clover Lodge open.
const results: SearchResult[] = PROPERTIES.map((p) => ({
  slug: p.slug,
  available: p.slug === 'minsi-pond' || p.slug === 'clover-lodge',
  totalWithoutTaxes: p.slug === 'minsi-pond' ? 2489250 : 1199964,
  nightlyAverage: null,
  currency: 'USD',
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('stayFrom', () => {
  it('needs real dates in the bookable window', () => {
    expect(stayFrom(facts({ checkin: '2026-12-30', checkout: '2027-01-14' }), NOW)).toEqual({
      checkin: '2026-12-30',
      checkout: '2027-01-14',
      adults: 1,
      children: 0,
      pets: 0,
      known: false,
    });
    expect(stayFrom(facts({ checkin: '2026-12-30', checkout: '2027-01-14', adults: 8, children: 4 }), NOW)).toMatchObject({ adults: 8, children: 4, known: true });
    expect(stayFrom(facts({ checkin: '2026-11-01', checkout: '2026-11-03' }), NOW)).toBeNull();
    expect(stayFrom(facts({ checkin: '2027-01-14', checkout: '2026-12-30' }), NOW)).toBeNull();
    expect(stayFrom(facts({ checkin: 'Dec 30', checkout: '2027-01-14' }), NOW)).toBeNull();
    expect(stayFrom(null, NOW)).toBeNull();
  });
});

describe('buildRecap', () => {
  it('recaps Kelsey’s dates, lists what’s open with live prices and links, and asks the group size', () => {
    const f = facts({ checkin: '2026-12-30', checkout: '2027-01-14', homes: ['clover-lodge'] });
    const email = buildRecap({ lead: KELSEY, facts: f, stay: stayFrom(f, NOW), results, offer: OFFER });
    expect(email).toMatchObject({
      to: 'yuki@example.com',
      replyTo: 'stay@wkreserve.com',
      fromName: 'Edward at W&K Reserve',
      bccHost: true,
      subject: 'Your Poconos stay, Wed, Dec 30 – Thu, Jan 14',
    });
    expect(email.text).toContain('Hi kelsey,');
    expect(email.text).toContain('Your dates: Wed, Dec 30, 2026 – Thu, Jan 14, 2027 (15 nights).');
    // The home she asked about first, then the other open one; booked homes aren't offered.
    expect(email.text).toMatch(/• Clover Lodge \(sleeps 12\): \$11,999\.64 total\. .*\n• Minsi Pond \(sleeps 20\): \$24,892\.50 total\./);
    expect(email.text).toContain('https://wkreserve.com/stays/minsi-pond?checkin=2026-12-30&checkout=2027-01-14&promo=WELCOME5');
    expect(email.text).not.toContain('The Ridge');
    expect(email.text).toContain('How many people are coming?');
    expect(email.text).toContain('Your welcome code: WELCOME5, for 5% off the nightly rate of your first direct stay of 2 nights or more.');
    expect(email.text).toContain('Just hit reply');
    expect(email.text).toContain('Reply “stop”');
    expect(email.html).toContain('href="https://wkreserve.com/stays/clover-lodge?checkin=2026-12-30&#38;checkout=2027-01-14&#38;promo=WELCOME5"');
  });

  it('only offers homes that fit the group and take pets', () => {
    const f = facts({ checkin: '2026-12-30', checkout: '2027-01-14', adults: 14, pets: 1 });
    const open = PROPERTIES.map((p) => ({ slug: p.slug, available: true, totalWithoutTaxes: 100000, nightlyAverage: null, currency: 'USD' }));
    const email = buildRecap({ lead: KELSEY, facts: f, stay: stayFrom(f, NOW), results: open, offer: null });
    const offered = PROPERTIES.filter((p) => email.text.includes(`• ${p.name}`));
    expect(offered.length).toBeGreaterThan(0);
    for (const p of offered) expect(p.guests >= 14 && p.features.petFriendly).toBe(true);
    expect(email.text).toContain('for 14 guests, 1 pet');
    expect(email.text).toContain('&adults=14&pets=1');
    expect(email.text).not.toContain('How many people');
    expect(email.text).not.toContain('welcome code');
  });

  it('asks for dates when the guest gave none, and says so when nothing is open or the check failed', () => {
    const none = buildRecap({ lead: KELSEY, facts: facts({}), stay: null, results: null, offer: OFFER });
    expect(none.subject).toBe('Your Poconos stay');
    expect(none.text).toContain('When are you thinking of coming');
    expect(none.text).toContain('https://wkreserve.com/search');

    const f = facts({ checkin: '2026-12-30', checkout: '2027-01-14', adults: 4 });
    const booked = buildRecap({ lead: KELSEY, facts: f, stay: stayFrom(f, NOW), results: results.map((r) => ({ ...r, available: false })), offer: OFFER });
    expect(booked.text).toContain('already booked');
    expect(booked.text).not.toContain('•');

    const failed = buildRecap({ lead: KELSEY, facts: f, stay: stayFrom(f, NOW), results: null, offer: OFFER });
    expect(failed.text).toContain('couldn’t check live availability');
  });

  it('escapes what the guest typed', () => {
    const email = buildRecap({ lead: { ...KELSEY, name: 'Zoë' }, facts: null, stay: null, results: null, offer: null });
    expect(email.html).toContain('Hi Zoë,');
    expect(email.html).not.toMatch(/<script/);
  });
});

// ---------- reading the chat and sending ----------

function fakeClient(parsed: TripFacts | null | Error) {
  const calls: Record<string, unknown>[] = [];
  const parse = vi.fn(async (params: Record<string, unknown>) => {
    calls.push(params);
    if (parsed instanceof Error) throw parsed;
    return { stop_reason: 'end_turn', parsed_output: parsed };
  });
  return { calls, client: { beta: { messages: { parse } } } as unknown as Pick<Anthropic, 'beta'> };
}

describe('extractTripFacts', () => {
  it('asks Opus 5.5 for a fixed form, at low effort with fallback', async () => {
    const { calls, client } = fakeClient(facts({ checkin: '2026-12-30', checkout: '2027-01-14' }));
    const out = await extractTripFacts(client, KELSEY, chat, NOW);
    expect(out).toMatchObject({ checkin: '2026-12-30', checkout: '2027-01-14' });
    expect(calls[0]).toMatchObject({ model: RECAP_MODEL, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    const cfg = calls[0]!.output_config as { effort: string; format: { type: string } };
    expect(cfg.effort).toBe('low');
    expect(cfg.format.type).toBe('json_schema');
    expect(String(calls[0]!.system)).toContain('Today is 2026-11-11');
    expect(JSON.stringify(calls[0]!.messages)).toContain('kelsey: 12/30-1/14');
  });
});

describe('sendRecap', () => {
  const deps = (over: Partial<Parameters<typeof sendRecap>[2]> = {}) => {
    const send = vi.fn(async () => {});
    const search = vi.fn(async () => results);
    return { send, search, d: { client: fakeClient(facts({ checkin: '2026-12-30', checkout: '2027-01-14' })).client, search, send, alreadySent: async () => false, offer: OFFER, now: NOW, ...over } };
  };

  it('reads the chat, checks Hospitable and sends once', async () => {
    const { send, search, d } = deps();
    expect(await sendRecap(KELSEY, chat, d)).toBe('sent');
    expect(search).toHaveBeenCalledWith({ checkin: '2026-12-30', checkout: '2027-01-14', guests: { adults: 1, children: 0, pets: 0 } });
    expect(send).toHaveBeenCalledOnce();
    expect((send.mock.calls[0] as unknown as [{ text: string }])[0].text).toContain('Minsi Pond');
  });

  it('skips a guest who already got one today, and a chat with no question', async () => {
    const a = deps({ alreadySent: async () => true });
    expect(await sendRecap(KELSEY, chat, a.d)).toBe('skipped: already sent');
    expect(a.send).not.toHaveBeenCalled();
    const b = deps();
    expect(await sendRecap(KELSEY, [], b.d)).toBe('skipped: no question');
  });

  it('still sends a recap that asks for dates when the chat can’t be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { send, search, d } = deps({ client: fakeClient(new Error('overloaded')).client });
    expect(await sendRecap(KELSEY, chat, d)).toBe('sent');
    expect(search).not.toHaveBeenCalled();
    expect((send.mock.calls[0] as unknown as [{ text: string }])[0].text).toContain('When are you thinking of coming');
  });
});

describe('sentRecently', () => {
  const list = (rows: unknown[], status = 200) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ object: 'list', data: rows }), { status })));
  const now = Date.parse('2026-11-11T15:00:00Z');

  it('finds a recap sent to the same guest in the last day', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    list([{ to: ['Yuki@Example.com'], subject: 'Your Poconos stay, Wed, Dec 30 – Thu, Jan 14', created_at: '2026-11-11 02:19:14.478000+00' }]);
    expect(await sentRecently('yuki@example.com', 'Your Poconos stay', undefined, now)).toBe(true);
    expect(await sentRecently('other@example.com', 'Your Poconos stay', undefined, now)).toBe(false);
    list([{ to: ['yuki@example.com'], subject: 'Your Poconos stay', created_at: '2026-11-09 02:19:14.478000+00' }]);
    expect(await sentRecently('yuki@example.com', 'Your Poconos stay', undefined, now)).toBe(false);
  });

  it('says no when it can’t look, so a follow-up is never lost', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    list([], 401);
    expect(await sentRecently('yuki@example.com', 'Your Poconos stay', undefined, now)).toBe(false);
  });
});
