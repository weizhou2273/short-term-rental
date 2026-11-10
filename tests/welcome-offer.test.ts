import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/subscribe/route';
import { addContact, withDisplayName } from '@/lib/email/send';
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
  it('uses the built-in code, which the env can override, and needs email set up', () => {
    vi.stubEnv('WELCOME_PROMO_CODE', '');
    expect(welcomeOffer()).toEqual({ code: 'WELCOME5', percent: 5, minNights: 2 });
    vi.stubEnv('WELCOME_PROMO_CODE', 'SPRING10');
    expect(welcomeOffer()).toEqual({ code: 'SPRING10', percent: 5, minNights: 2 });
    vi.stubEnv('WELCOME_PROMO_CODE', 'not a code!');
    expect(welcomeOffer()).toBeNull();
    vi.stubEnv('WELCOME_PROMO_CODE', 'WELCOME5');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(welcomeOffer()).toBeNull();
  });

  it('emails the guest their code and three questions from the host, with replies going to the host', () => {
    const email = welcomeEmail('guest@example.com', { code: 'WELCOME5', percent: 5, minNights: 2 });
    expect(email).toMatchObject({
      to: 'guest@example.com',
      replyTo: 'stay@wkreserve.com',
      fromName: 'Edward at W&K Reserve',
      subject: 'Your 5% code, and a quick question',
    });
    expect(email.text).toContain('Your code is WELCOME5: 5% off the nightly rate of your first direct stay of 2 nights or more.');
    expect(email.text).toContain('1. Roughly when are you thinking of coming?\n2. How many people, and any kids or dogs?\n3. What’s the occasion');
    expect(email.text).toContain('Reply “unsubscribe”');
    expect(email.text).toMatch(/\n\nEdward\nW&K Reserve/);
    expect(email.html).toContain('<strong style="letter-spacing:.06em">WELCOME5</strong>');
    expect(email.html.match(/<li>/g)).toHaveLength(3);
  });

  it('signs it from the host at the verified sender address', () => {
    expect(withDisplayName('W&K Reserve <chat@wkreserve.com>', 'Edward at W&K Reserve')).toBe('"Edward at W&K Reserve" <chat@wkreserve.com>');
    expect(withDisplayName('stay@wkreserve.com', 'Ed "the host"')).toBe('"Ed the host" <stay@wkreserve.com>');
  });

  it('treats signing up twice as fine', async () => {
    mockResend({ contacts: 409, contactBody: '{"message":"Contact already exists"}' });
    await expect(addContact('guest@example.com')).resolves.toBeUndefined();
    mockResend({ contacts: 401, contactBody: '{"message":"This API key is restricted to only send emails"}' });
    await expect(addContact('guest@example.com')).rejects.toThrow(/401/);
  });
});

describe('POST /api/subscribe', () => {
  it('saves the contact, emails the guest and the host, and returns the code', async () => {
    vi.stubEnv('LEADS_FROM_EMAIL', 'W&K Reserve <chat@wkreserve.com>');
    const calls = mockResend();
    const res = await POST(subscribe({ email: ' Guest@Example.com ' }, { origin: 'https://wkreserve.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: true });
    // The code reaches a browser only after signing up, never in the page's settings.
    expect(JSON.stringify((await import('@/data/site')).SITE)).not.toContain('WELCOME5');
    expect(calls.find((c) => c.path === '/contacts')?.body).toEqual({ email: 'Guest@Example.com', unsubscribed: false });
    const [welcome, notice] = calls.filter((c) => c.path === '/emails').map((c) => c.body);
    expect(welcome).toMatchObject({
      from: '"Edward at W&K Reserve" <chat@wkreserve.com>',
      to: ['Guest@Example.com'],
      reply_to: 'stay@wkreserve.com',
      subject: 'Your 5% code, and a quick question',
    });
    expect(notice).toMatchObject({ from: 'W&K Reserve <chat@wkreserve.com>', to: ['stay@wkreserve.com'], subject: 'New sign-up: Guest@Example.com', reply_to: 'Guest@Example.com' });
    expect(String(notice!.text)).toContain('Their answers will arrive in this inbox');
    expect(String(notice!.text)).toContain('Saved to Resend → Contacts.');
  });

  it('still gives the code when Resend can’t save or send, and logs the email', async () => {
    mockResend({ contacts: 500, emails: 403 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe({ email: 'guest@example.com' }));
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: false });
    expect(log.mock.calls.flat().join(' ')).toContain('guest@example.com');
  });

  it('tells the host when the key can’t save contacts', async () => {
    const calls = mockResend({ contacts: 401, contactBody: '{"message":"This API key is restricted to only send emails"}' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe({ email: 'guest@example.com' }));
    expect((await res.json()).emailed).toBe(true);
    const notice = calls.find((c) => c.path === '/emails' && String(c.body.subject).startsWith('New sign-up'));
    expect(notice?.body).toMatchObject({ to: ['stay@wkreserve.com'], reply_to: 'guest@example.com' });
    expect(String(notice?.body.text)).toContain('Full access');
  });

  it('tells the host when the welcome email couldn’t reach the guest, so they can write themselves', async () => {
    // Resend refuses mail to guests until the sending domain is verified.
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        calls.push(String(body.subject ?? 'contact'));
        if (body.to?.[0] === 'guest@example.com') return new Response('{"message":"You can only send testing emails to your own email address"}', { status: 403 });
        return new Response('{"id":"x"}', { status: 200 });
      }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe({ email: 'guest@example.com' }));
    expect((await res.json()).emailed).toBe(false);
    expect(calls).toContain('New sign-up: guest@example.com');
  });

  it('refuses bad emails, other sites, and a site without the offer', async () => {
    mockResend();
    expect((await POST(subscribe({ email: 'nope' }))).status).toBe(400);
    expect((await POST(subscribe({ email: 'guest@example.com' }, { origin: 'https://evil.example' }))).status).toBe(403);
    vi.stubEnv('RESEND_API_KEY', '');
    expect((await POST(subscribe({ email: 'guest@example.com' }))).status).toBe(503);
  });

  it('limits sign-ups from one visitor', async () => {
    mockResend();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(subscribe({ email: `g${i}@example.com` }, { 'x-forwarded-for': '192.168.7.7' }))).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
