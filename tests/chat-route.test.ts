import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runChat = vi.fn();
vi.mock('@/lib/chat/agent', () => ({ runChat: (...args: unknown[]) => runChat(...args) }));

const { POST } = await import('@/app/api/chat/route');
const { signLead } = await import('@/lib/chat/lead');

let ip = 0;
function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://wkreserve.com/api/chat', {
    method: 'POST',
    // A fresh address per request keeps the rate limiter out of these tests.
    headers: { 'content-type': 'application/json', host: 'wkreserve.com', 'x-forwarded-for': `10.0.0.${++ip}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const JANE = { name: 'Jane Doe', email: 'jane@example.com', phone: '(929) 555-0101' };
let hi: { lead: string; messages: { role: string; content: string }[] };

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    runChat.mockReset();
    hi = { lead: signLead(JANE), messages: [{ role: 'user', content: 'Hi' }] };
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is off without an API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await POST(post(hi))).status).toBe(503);
    expect(runChat).not.toHaveBeenCalled();
  });

  it('refuses other sites and bad bodies', async () => {
    expect((await POST(post(hi, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await POST(post('{not json'))).status).toBe(400);
    expect((await POST(post({ messages: [{ role: 'assistant', content: 'Hi' }] }))).status).toBe(400);
    expect(runChat).not.toHaveBeenCalled();
  });

  it('needs the token from the contact form', async () => {
    const forged = `${Buffer.from(JSON.stringify({ ...JANE, iat: Math.floor(Date.now() / 1000) })).toString('base64url')}.abc`;
    for (const lead of ['', 'nonsense', forged, `${hi.lead}x`]) {
      const res = await POST(post({ ...hi, lead }));
      expect([400, 401]).toContain(res.status);
    }
    expect((await POST(post({ ...hi, lead: forged }))).status).toBe(401);
    expect(runChat).not.toHaveBeenCalled();
  });

  it('streams the reply as newline-delimited JSON events', async () => {
    runChat.mockImplementation(async ({ emit }) => {
      emit({ type: 'turn' });
      emit({ type: 'text', text: 'Hello' });
    });
    const res = await POST(post(hi, { origin: 'https://wkreserve.com' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(runChat.mock.calls[0]![0].history).toEqual(hi.messages);
    expect(runChat.mock.calls[0]![0].guestName).toBe('Jane');
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toEqual([{ type: 'turn' }, { type: 'text', text: 'Hello' }, { type: 'done' }]);
  });

  it('ends with a guest-friendly error when the model call fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    runChat.mockRejectedValue(new Error('boom'));
    const lines = (await (await POST(post(hi))).text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ type: 'error' });
    expect(lines.at(-1).message).not.toContain('boom');
  });

  it('limits how fast one visitor can send', async () => {
    runChat.mockResolvedValue(undefined);
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await POST(post(hi, { 'x-forwarded-for': '192.168.1.1' }))).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
