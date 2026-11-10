import type Anthropic from '@anthropic-ai/sdk';
import type { BetaContentBlock, BetaMessage, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { describe, expect, it, vi } from 'vitest';
import { ALL_PROPERTY_ENTRIES, PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';
import { CHAT_MODEL, echoContent, HANDOFF_TEXT, runChat } from '@/lib/chat/agent';
import { parseChat, parseInline, safeHref } from '@/lib/chat/markup';
import { dateContext, SYSTEM_TEXT } from '@/lib/chat/prompt';
import { type ChatEvent, chatRequestSchema } from '@/lib/chat/request';
import { checkAvailability, checkAvailabilityTool } from '@/lib/chat/tools';
import type { SearchResult } from '@/lib/booking/types';

const NOW = new Date('2026-11-10T15:00:00Z');

describe('what the assistant knows', () => {
  it('covers every listed home with its page, size and contact details', () => {
    for (const p of PROPERTIES) {
      expect(SYSTEM_TEXT).toContain(`## ${p.name}`);
      expect(SYSTEM_TEXT).toContain(`Page: /stays/${p.slug}`);
      expect(SYSTEM_TEXT).toContain(`Sleeps up to ${p.guests} guests`);
    }
    expect(SYSTEM_TEXT).toContain(SITE.contactPhone);
    expect(SYSTEM_TEXT).toContain(SITE.contactEmail);
  });

  it('leaves out hidden homes, Hospitable ids, coordinates and review text', () => {
    for (const p of ALL_PROPERTY_ENTRIES) {
      expect(SYSTEM_TEXT).not.toContain(p.hospitable.uuid);
      if (p.coords.lat != null) expect(SYSTEM_TEXT).not.toContain(String(p.coords.lat));
      for (const r of p.reviews) expect(SYSTEM_TEXT).not.toContain(r.text);
      if (p.hidden) expect(SYSTEM_TEXT).not.toContain(`/stays/${p.slug}`);
    }
  });

  it('dates "today" in the Poconos', () => {
    expect(dateContext(new Date('2026-11-11T03:00:00Z'))).toContain('Tuesday, November 10, 2026 (2026-11-10)');
  });
});

describe('chat request', () => {
  const ok = (messages: unknown) => chatRequestSchema.safeParse({ lead: 'token', messages }).success;

  it('takes alternating text turns that start and end with the guest', () => {
    expect(ok([{ role: 'user', content: 'Hi' }])).toBe(true);
    expect(ok([{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }, { role: 'user', content: 'Prices?' }])).toBe(true);
    expect(ok([{ role: 'assistant', content: 'Hello' }, { role: 'user', content: 'Hi' }])).toBe(false);
    expect(ok([{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }])).toBe(false);
    expect(ok([{ role: 'user', content: 'Hi' }, { role: 'user', content: 'Hi' }])).toBe(false);
    expect(ok([{ role: 'user', content: '   ' }])).toBe(false);
    expect(ok([{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }])).toBe(false);
  });

  it('needs the contact token', () => {
    expect(chatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'Hi' }] }).success).toBe(false);
  });

  it('caps message length, count and total size', () => {
    expect(ok([{ role: 'user', content: 'x'.repeat(1001) }])).toBe(false);
    const long = Array.from({ length: 21 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'Hi' }));
    expect(ok(long)).toBe(false);
    const big = Array.from({ length: 19 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(i % 2 ? 2000 : 900) }));
    expect(ok(big)).toBe(false);
  });
});

describe('reply rendering', () => {
  it('keeps links to this site, phone and email, and drops the rest', () => {
    expect(safeHref('/stays/minsi-pond?checkin=2026-12-04&checkout=2026-12-06&adults=8')).toEqual({
      href: '/stays/minsi-pond?checkin=2026-12-04&checkout=2026-12-06&adults=8',
      internal: true,
    });
    expect(safeHref('https://wkreserve.com/poconos/ski-rentals')).toEqual({ href: '/poconos/ski-rentals', internal: true });
    expect(safeHref('https://www.wkreserve.com')).toEqual({ href: '/', internal: true });
    expect(safeHref('tel:+1 929-500-4160')).toEqual({ href: 'tel:+19295004160', internal: false });
    expect(safeHref('mailto:stay@wkreserve.com')).toEqual({ href: 'mailto:stay@wkreserve.com', internal: false });
    for (const bad of ['javascript:alert(1)', '//evil.com', 'https://evil.com', 'https://wkreserve.com.evil.com/x', '/a/../../etc', 'data:text/html,x']) {
      expect(safeHref(bad), bad).toBeNull();
    }
  });

  it('parses paragraphs, lists, bold and links', () => {
    expect(parseInline('See [Minsi Pond](/stays/minsi-pond) — **$4,200** total. [x](javascript:alert)')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'Minsi Pond', href: '/stays/minsi-pond', internal: true },
      { type: 'text', text: ' — ' },
      { type: 'strong', text: '$4,200' },
      { type: 'text', text: ' total. ' },
      { type: 'text', text: 'x' },
    ]);
    const blocks = parseChat('Two homes fit:\n- The Ridge\n- Minsi Pond\n\n## Next\nWant prices?');
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul', 'p']);
    expect(blocks[1]).toEqual({ type: 'ul', items: [[{ type: 'text', text: 'The Ridge' }], [{ type: 'text', text: 'Minsi Pond' }]] });
    expect(blocks[2]).toEqual({ type: 'p', lines: [[{ type: 'text', text: 'Next' }], [{ type: 'text', text: 'Want prices?' }]] });
  });
});

describe('check_availability', () => {
  const minsi = PROPERTIES.find((p) => p.slug === 'minsi-pond')!;
  const results: SearchResult[] = PROPERTIES.map((p) => ({
    slug: p.slug,
    available: p.slug !== 'the-ridge',
    totalWithoutTaxes: 425_000,
    nightlyAverage: 212_500,
    currency: 'USD',
  }));
  const input = { checkin: '2026-12-04', checkout: '2026-12-06', adults: 10, children: 4, pets: 1 };

  it('streams its input and is validated before it runs', () => {
    expect(checkAvailabilityTool.eager_input_streaming).toBe(true);
    expect(checkAvailabilityTool.input_schema.required).toEqual(['checkin', 'checkout', 'adults']);
  });

  it('returns every home with prices, fit and a booking link carrying the stay', async () => {
    const search = vi.fn(async () => results);
    const out = await checkAvailability(input, { search, now: NOW });
    expect(out.isError).toBe(false);
    expect(search).toHaveBeenCalledWith({ checkin: '2026-12-04', checkout: '2026-12-06', guests: { adults: 10, children: 4, infants: 0, pets: 1 } });
    const body = JSON.parse(out.content);
    expect(body.stay).toMatchObject({ nights: 2, adults: 10, children: 4, pets: 1 });
    expect(body.homes).toHaveLength(PROPERTIES.length);
    const m = body.homes.find((h: { name: string }) => h.name === minsi.name);
    expect(m).toMatchObject({ available: true, fits_group: true, total_before_taxes: '$4,250.00', average_nightly: '$2,125.00' });
    expect(m.booking_link).toBe('/stays/minsi-pond?checkin=2026-12-04&checkout=2026-12-06&adults=10&children=4&pets=1');
    const ridge = body.homes.find((h: { page: string }) => h.page === '/stays/the-ridge');
    expect(ridge).toMatchObject({ available: false, booking_link: null });
    for (const h of body.homes) if (h.sleeps < 14) expect(h).toMatchObject({ fits_group: false, booking_link: null });
  });

  it('turns bad dates and a failed search into error results', async () => {
    const search = vi.fn(async () => results);
    expect(await checkAvailability({ ...input, checkin: '2026-11-01', checkout: '2026-11-03' }, { search, now: NOW })).toMatchObject({ isError: true });
    expect(search).not.toHaveBeenCalled();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = await checkAvailability(input, { search: async () => Promise.reject(new Error('502')), now: NOW });
    expect(down).toMatchObject({ isError: true });
    expect(down.content).toMatch(/could not be reached/);
  });
});

// ---------- the model loop, against a scripted client ----------

type Script = { deltas?: string[]; toolStart?: boolean; message?: Partial<BetaMessage> } | Error;

function scriptedClient(scripts: Script[]) {
  const calls: Record<string, unknown>[] = [];
  const stream = (params: Record<string, unknown>) => {
    calls.push(structuredClone(params));
    const script = scripts.shift()!;
    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
      on(name: string, fn: (...args: unknown[]) => void) {
        (handlers[name] ??= []).push(fn);
        return this;
      },
      async finalMessage() {
        if (script instanceof Error) throw script;
        for (const d of script.deltas ?? []) for (const h of handlers.text ?? []) h(d, '');
        if (script.toolStart) {
          for (const h of handlers.streamEvent ?? []) h({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use' } }, {});
        }
        return {
          model: CHAT_MODEL,
          stop_reason: 'end_turn',
          content: (script.deltas?.length ? [{ type: 'text', text: script.deltas.join('') }] : []) as BetaContentBlock[],
          usage: { input_tokens: 10, output_tokens: 5 },
          ...script.message,
        } as BetaMessage;
      },
    };
  };
  return { calls, client: { beta: { messages: { stream } } } as unknown as Pick<Anthropic, 'beta'> };
}

const toolUse = (input: unknown): BetaToolUseBlock => ({ type: 'tool_use', id: 'toolu_1', name: 'check_availability', input }) as BetaToolUseBlock;

async function collect(scripts: Script[], runTool?: Parameters<typeof runChat>[0]['runTool']) {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const { calls, client } = scriptedClient(scripts);
  const events: ChatEvent[] = [];
  const result = runChat({ client, history: [{ role: 'user', content: 'Hi' }], emit: (e) => events.push(e), now: NOW, runTool });
  return { calls, events, result };
}

const text = (events: ChatEvent[]) => {
  let out = '';
  let mark = 0;
  for (const e of events) {
    if (e.type === 'turn') mark = out.length;
    if (e.type === 'text') out += e.text;
    if (e.type === 'reset') out = out.slice(0, mark);
  }
  return out;
};

describe('runChat', () => {
  it('asks Opus 5.5 at low effort, with server-side fallback and a cached system prompt', async () => {
    const { calls, events, result } = await collect([{ deltas: ['Hello', ' there'] }]);
    await result;
    expect(text(events)).toBe('Hello there');
    const params = calls[0]!;
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('tool_choice');
    const system = params.system as { text: string; cache_control?: unknown }[];
    expect(system[0]).toMatchObject({ text: SYSTEM_TEXT, cache_control: { type: 'ephemeral' } });
    expect(system[1]!.cache_control).toBeUndefined();
    expect(system[1]!.text).toContain('2026-11-10');
    expect(system[1]!.text).not.toContain('first name');
  });

  it('tells the model the guest’s first name, outside the cached prompt', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { calls, client } = scriptedClient([{ deltas: ['Hi Jane'] }]);
    await runChat({ client, history: [{ role: 'user', content: 'Hi' }], guestName: 'Jane', emit: () => {}, now: NOW });
    const system = calls[0]!.system as { text: string }[];
    expect(system[0]!.text).toBe(SYSTEM_TEXT);
    expect(system[1]!.text).toContain('The guest\'s first name is Jane.');
  });

  it('runs check_availability on the server and answers from its result', async () => {
    const runTool = vi.fn(async () => ({ content: '{"homes":[]}', isError: false }));
    const { calls, events, result } = await collect(
      [
        { deltas: ['Let me check.'], toolStart: true, message: { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Let me check.' }, toolUse({ checkin: '2026-12-04' })] as BetaContentBlock[] } },
        { deltas: ['Minsi Pond is free.'] },
      ],
      runTool,
    );
    await result;
    expect(runTool).toHaveBeenCalledOnce();
    expect(events).toContainEqual({ type: 'status', text: 'Checking live availability…' });
    expect(text(events)).toBe('Let me check.\n\nMinsi Pond is free.');
    const second = calls[1]!.messages as { role: string; content: unknown }[];
    expect(second).toHaveLength(3);
    expect(second[1]).toMatchObject({ role: 'assistant', content: [{ type: 'text' }, { type: 'tool_use', id: 'toolu_1' }] });
    expect(second[2]).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"homes":[]}' }] });
  });

  it('sends invalid tool input back as an error result instead of running it', async () => {
    const { calls, result } = await collect([
      { message: { stop_reason: 'tool_use', content: [toolUse({ checkin: 'next friday', adults: '4' })] as BetaContentBlock[] } },
      { deltas: ['Which dates?'] },
    ]);
    await result;
    const toolResult = (calls[1]!.messages as { content: { is_error?: boolean; content: string }[] }[])[2]!.content[0]!;
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('INVALID_JSON');
  });

  it('replaces a refused reply with the hand-off', async () => {
    const { events, result } = await collect([{ deltas: ['Partial'], message: { stop_reason: 'refusal' } }]);
    await result;
    expect(text(events)).toBe(HANDOFF_TEXT);
  });

  it('never runs a tool whose input was cut off at max_tokens', async () => {
    const runTool = vi.fn();
    const { result } = await collect([{ message: { stop_reason: 'max_tokens', content: [toolUse({ checkin: '2026-12-04' })] as BetaContentBlock[] } }], runTool);
    await expect(result).rejects.toThrow(/truncated/);
    expect(runTool).not.toHaveBeenCalled();
  });

  it('re-issues a turn whose tool input was not JSON, dropping its partial text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { events, result } = await collect([new SyntaxError('Unexpected token'), { deltas: ['Done.'] }]);
    await result;
    expect(events.filter((e) => e.type === 'reset')).toHaveLength(1);
    expect(text(events)).toBe('Done.');
  });

  it('echoes only text before a fallback boundary', () => {
    const content = [
      { type: 'thinking', thinking: 'x', signature: 's' },
      { type: 'text', text: 'Sure, ' },
      { type: 'tool_use', id: 'a', name: 'check_availability', input: {} },
      { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-5' } },
      { type: 'thinking', thinking: 'y', signature: 't' },
      { type: 'tool_use', id: 'b', name: 'check_availability', input: {} },
    ] as unknown as BetaContentBlock[];
    expect(echoContent(content).map((b) => `${b.type}${'id' in b ? `:${b.id}` : ''}`)).toEqual(['text', 'fallback', 'thinking', 'tool_use:b']);
    const plain = [{ type: 'thinking' }, { type: 'text' }] as unknown as BetaContentBlock[];
    expect(echoContent(plain)).toEqual(plain);
  });
});
