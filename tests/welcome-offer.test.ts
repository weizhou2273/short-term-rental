import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/subscribe/route';
import { addContact } from '@/lib/email/send';
import { welcomeEmail, welcomeOffer } from '@/lib/offer/welcome';

let ip = 0;
function subscribe(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://wkreserve.com/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'wkreserve.com', 'x-forwarded-for': `10.2.0.${++ip}`, ...headers },
    body: JSON.stringify(body),
  });
}

/** Fakes Resend: `/contacts` and `/emails` answer with the given statuses. */
function mockResend({ contacts = 200, emails = 200, contactBody = '{"id":"c1"}' } = {}) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      calls.push({ path, body: JSON.parse(String(init?.body)) });
      if (path === '/contacts') return new Response(contactBody, { status: contacts });
      return new Response('{"id":"e1"}', { status: emails });
    }),
  );
  return calls;
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('WELCOME_PROMO_CODE', 'WELCOME5');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('welcome offer', () => {
  it('is on only with a valid code and email set up', () => {
    expect(welcomeOffer()).toEqual({ code: 'WELCOME5', percent: 5 });
    vi.stubEnv('WELCOME_PROMO_CODE', 'not a code!');
    expect(welcomeOffer()).toBeNull();
    vi.stubEnv('WELCOME_PROMO_CODE', '');
    expect(welcomeOffer()).toBeNull();
    vi.stubEnv('WELCOME_PROMO_CODE', 'WELCOME5');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(welcomeOffer()).toBeNull();
  });

  it('emails the guest their code, with replies going to the host', () => {
    const email = welcomeEmail('guest@example.com', { code: 'WELCOME5', percent: 5 });
    expect(email).toMatchObject({ to: 'guest@example.com', replyTo: 'stay@wkreserve.com', subject: 'Your 5% off code for W&K Reserve' });
    expect(email.text).toContain('Your code: WELCOME5');
    expect(email.text).toContain('https://wkreserve.com/search');
    expect(email.html).toContain('WELCOME5');
  });

  it('treats signing up twice as fine', async () => {
    mockResend({ contacts: 409, contactBody: '{"message":"Contact already exists"}' });
    await expect(addContact('guest@example.com')).resolves.toBeUndefined();
    mockResend({ contacts: 401, contactBody: '{"message":"This API key is restricted to only send emails"}' });
    await expect(addContact('guest@example.com')).rejects.toThrow(/401/);
  });
});

describe('POST /api/subscribe', () => {
  it('saves the contact, emails the code and returns it', async () => {
    const calls = mockResend();
    const res = await POST(subscribe({ email: ' Guest@Example.com ' }, { origin: 'https://wkreserve.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: true });
    expect(calls.find((c) => c.path === '/contacts')?.body).toEqual({ email: 'Guest@Example.com', unsubscribed: false });
    expect(calls.find((c) => c.path === '/emails')?.body).toMatchObject({ to: ['Guest@Example.com'], subject: 'Your 5% off code for W&K Reserve' });
  });

  it('still gives the code when Resend can’t save or send, and logs the email', async () => {
    mockResend({ contacts: 500, emails: 403 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe({ email: 'guest@example.com' }));
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: false });
    expect(log.mock.calls.flat().join(' ')).toContain('guest@example.com');
  });

  it('refuses bad emails, other sites, and a site without the offer', async () => {
    mockResend();
    expect((await POST(subscribe({ email: 'nope' }))).status).toBe(400);
    expect((await POST(subscribe({ email: 'guest@example.com' }, { origin: 'https://evil.example' }))).status).toBe(403);
    vi.stubEnv('WELCOME_PROMO_CODE', '');
    expect((await POST(subscribe({ email: 'guest@example.com' }))).status).toBe(503);
  });

  it('limits sign-ups from one visitor', async () => {
    mockResend();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(subscribe({ email: `g${i}@example.com` }, { 'x-forwarded-for': '192.168.7.7' }))).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
