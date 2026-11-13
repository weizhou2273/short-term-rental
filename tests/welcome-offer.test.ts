import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/subscribe/route';
import { toE164, WELCOME_TAG } from '@/lib/crm/highlevel';
import { addContact, withDisplayName } from '@/lib/email/send';
import { welcomeEmail, welcomeOffer } from '@/lib/offer/welcome';

const JANE = { name: 'Jane Doe', email: 'guest@example.com', phone: '(929) 555-0101' };

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
    expect(email.text).toMatch(/^Hi there,\n/);
    expect(email.text).toMatch(/\n\nEdward\nW&K Reserve/);
    // With a name, it greets them by first name.
    const named = welcomeEmail('guest@example.com', { code: 'WELCOME5', percent: 5, minNights: 2 }, 'Jane Doe');
    expect(named.text).toMatch(/^Hi Jane,\n/);
    expect(named.html).toContain('<p>Hi Jane,</p>');
    expect(email.html).toContain('<strong style="letter-spacing:.06em">WELCOME5</strong>');
    expect(email.html.match(/<li>/g)).toHaveLength(3);
  });

  it('signs it from the host at the verified sender address', () => {
    expect(withDisplayName('W&K Reserve <chat@wkreserve.com>', 'Edward at W&K Reserve')).toBe('"Edward at W&K Reserve" <chat@wkreserve.com>');
    expect(withDisplayName('stay@wkreserve.com', 'Ed "the host"')).toBe('"Ed the host" <stay@wkreserve.com>');
  });

  it('treats signing up twice as fine', async () => {
    mockResend({ contacts: 409, contactBody: '{"message":"Contact already exists"}' });
    await expect(addContact('guest@example.com', 'Jane Doe')).resolves.toBeUndefined();
    mockResend({ contacts: 401, contactBody: '{"message":"This API key is restricted to only send emails"}' });
    await expect(addContact('guest@example.com')).rejects.toThrow(/401/);
  });
});

describe('POST /api/subscribe', () => {
  it('saves the contact, emails the guest and the host, and returns the code', async () => {
    vi.stubEnv('LEADS_FROM_EMAIL', 'W&K Reserve <chat@wkreserve.com>');
    const calls = mockResend();
    const res = await POST(subscribe({ name: ' Jane van Doe ', email: ' Guest@Example.com ', phone: '(929) 555-0101' }, { origin: 'https://wkreserve.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: true });
    // The code reaches a browser only after signing up, never in the page's settings.
    expect(JSON.stringify((await import('@/data/site')).SITE)).not.toContain('WELCOME5');
    expect(calls.find((c) => c.path === '/contacts')?.body).toEqual({ email: 'Guest@Example.com', unsubscribed: false, first_name: 'Jane', last_name: 'van Doe' });
    const [welcome, notice] = calls.filter((c) => c.path === '/emails').map((c) => c.body);
    expect(welcome).toMatchObject({
      from: '"Edward at W&K Reserve" <chat@wkreserve.com>',
      to: ['Guest@Example.com'],
      reply_to: 'stay@wkreserve.com',
      subject: 'Your 5% code, and a quick question',
    });
    expect(String(welcome!.text)).toMatch(/^Hi Jane,\n/);
    // The host gets the name, email and phone, with one-tap call and text links.
    expect(notice).toMatchObject({ from: 'W&K Reserve <chat@wkreserve.com>', to: ['stay@wkreserve.com'], subject: 'New sign-up: Jane van Doe', reply_to: 'Guest@Example.com' });
    expect(String(notice!.text)).toContain('Name: Jane van Doe\nEmail: Guest@Example.com\nPhone: (929) 555-0101');
    expect(String(notice!.html)).toContain('<a href="sms:9295550101">Text</a>');
    expect(String(notice!.html)).toContain('<a href="tel:9295550101">Call</a>');
    expect(String(notice!.text)).toContain('Their answers will arrive in this inbox');
    expect(String(notice!.text)).toContain('Saved to Resend → Contacts.');
  });

  it('still gives the code when Resend can’t save or send, and logs the details', async () => {
    mockResend({ contacts: 500, emails: 403 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe(JANE));
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: false });
    const logged = log.mock.calls.flat().join(' ');
    for (const detail of Object.values(JANE)) expect(logged).toContain(detail);
  });

  it('tells the host when the key can’t save contacts', async () => {
    const calls = mockResend({ contacts: 401, contactBody: '{"message":"This API key is restricted to only send emails"}' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe(JANE));
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
    const res = await POST(subscribe(JANE));
    expect((await res.json()).emailed).toBe(false);
    expect(calls).toContain('New sign-up: Jane Doe');
  });

  it('needs a real-looking name, email and phone, and says which is wrong', async () => {
    const calls = mockResend();
    const tries: [object, string][] = [
      [{ ...JANE, email: 'nope' }, 'Please enter a valid email address.'],
      [{ ...JANE, name: '' }, 'Please enter your name.'],
      [{ ...JANE, name: 'Jane <script>' }, 'Please enter your name using letters only.'],
      [{ ...JANE, phone: '555-0101' }, 'Please enter a phone number we can call or text, with area code.'],
    ];
    for (const [body, message] of tries) {
      const res = await POST(subscribe(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error).toBe(message);
    }
    // An email alone, as the form used to send, is no longer enough.
    expect((await POST(subscribe({ email: JANE.email }))).status).toBe(400);
    // Nothing is saved or sent for a refused sign-up.
    expect(calls).toHaveLength(0);
  });

  it('refuses other sites, and a site without the offer', async () => {
    mockResend();
    expect((await POST(subscribe(JANE, { origin: 'https://evil.example' }))).status).toBe(403);
    vi.stubEnv('RESEND_API_KEY', '');
    expect((await POST(subscribe(JANE))).status).toBe(503);
  });

  it('limits sign-ups from one visitor', async () => {
    mockResend();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(subscribe({ ...JANE, email: `g${i}@example.com` }, { 'x-forwarded-for': '192.168.7.7' }))).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe('POST /api/subscribe with Go High Level', () => {
  const TOKEN = 'pit-test-0000';
  type Call = { host: string; path: string; headers: Headers; body: Record<string, unknown> };

  /** Fakes Go High Level (`upsert` and `tags` statuses, tried in order) and Resend. */
  function mockCrm({ upsert = [201], tags = 201 }: { upsert?: number[]; tags?: number } = {}) {
    const calls: Call[] = [];
    let upserts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const { host, pathname: path } = new URL(url);
        calls.push({ host, path, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
        if (host === 'api.resend.com') return new Response('{"id":"e1"}', { status: 200 });
        if (path === '/contacts/upsert') {
          const status = upsert[Math.min(upserts++, upsert.length - 1)]!;
          return status < 300
            ? Response.json({ new: true, contact: { id: 'c_123' } }, { status })
            : Response.json({ message: status === 401 ? 'Invalid Private Integration token' : ['property source should not exist'] }, { status });
        }
        return tags < 300 ? Response.json({ tags: ['wkreserve-5-off'] }, { status: tags }) : Response.json({ message: 'The token does not have access to this scope' }, { status: tags });
      }),
    );
    return calls;
  }
  const toCrm = (calls: Call[]) => calls.filter((c) => c.host === 'services.leadconnectorhq.com');
  const toResend = (calls: Call[]) => calls.filter((c) => c.host === 'api.resend.com');

  beforeEach(() => {
    vi.stubEnv('GHL_API_TOKEN', TOKEN);
    vi.stubEnv('GHL_LOCATION_ID', 'loc_1');
  });

  it('writes phone numbers the way Go High Level matches them', () => {
    expect(toE164('(929) 555-0101')).toBe('+19295550101');
    expect(toE164('1 929.555.0101')).toBe('+19295550101');
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
    expect(toE164('020 7946 0958 22')).toBe('020 7946 0958 22');
  });

  it('shows the offer with Go High Level alone, no Resend needed', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(welcomeOffer()).toEqual({ code: 'WELCOME5', percent: 5, minNights: 2 });
    vi.stubEnv('GHL_LOCATION_ID', '');
    expect(welcomeOffer()).toBeNull();
  });

  it('sends the name, email and phone to Go High Level, tags the contact, and sends nothing to Resend', async () => {
    const calls = mockCrm();
    const res = await POST(subscribe({ name: ' Jane van Doe ', email: 'Guest@Example.com', phone: '(929) 555-0101' }, { origin: 'https://wkreserve.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: false });
    expect(toResend(calls)).toHaveLength(0);
    const [upsert, tag] = toCrm(calls);
    expect(upsert).toMatchObject({ path: '/contacts/upsert' });
    expect(upsert!.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(upsert!.headers.get('version')).toBe('2021-07-28');
    expect(upsert!.body).toEqual({
      locationId: 'loc_1',
      firstName: 'Jane',
      lastName: 'van Doe',
      name: 'Jane van Doe',
      email: 'Guest@Example.com',
      phone: '+19295550101',
      source: 'wkreserve.com 5% welcome offer',
    });
    // Tags sent with an upsert would replace an existing contact's tags; the tag is added separately.
    expect(upsert!.body).not.toHaveProperty('tags');
    expect(tag).toMatchObject({ path: '/contacts/c_123/tags', body: { tags: [WELCOME_TAG] } });
  });

  it('tries again with the essentials if Go High Level refuses a field', async () => {
    const calls = mockCrm({ upsert: [422, 201] });
    const res = await POST(subscribe(JANE));
    expect((await res.json()).code).toBe('WELCOME5');
    const upserts = toCrm(calls).filter((c) => c.path === '/contacts/upsert');
    expect(upserts).toHaveLength(2);
    expect(upserts[1]!.body).toEqual({ locationId: 'loc_1', firstName: 'Jane', lastName: 'Doe', name: 'Jane Doe', email: 'guest@example.com', phone: '+19295550101' });
    expect(toResend(calls)).toHaveLength(0);
  });

  it('still gives the code and emails the host the details when Go High Level says no, without the token', async () => {
    const calls = mockCrm({ upsert: [401] });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe(JANE));
    expect(await res.json()).toEqual({ code: 'WELCOME5', percent: 5, emailed: false });
    // A wrong token isn't retried.
    expect(toCrm(calls)).toHaveLength(1);
    const [notice] = toResend(calls);
    expect(notice!.body).toMatchObject({ to: ['stay@wkreserve.com'], subject: 'New sign-up: Jane Doe (NOT added to Go High Level)', reply_to: 'guest@example.com' });
    expect(String(notice!.body.text)).toContain('Name: Jane Doe\nEmail: guest@example.com\nPhone: (929) 555-0101');
    expect(String(notice!.body.text)).toContain('Go High Level answered 401: Invalid Private Integration token');
    const everything = JSON.stringify(toResend(calls).map((c) => c.body)) + log.mock.calls.flat().join(' ');
    expect(everything).not.toContain(TOKEN);
    expect(log.mock.calls.flat().join(' ')).toContain('guest@example.com');
  });

  it('tells the host when the contact was saved but the tag wasn’t', async () => {
    const calls = mockCrm({ tags: 401 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(subscribe(JANE));
    expect((await res.json()).code).toBe('WELCOME5');
    const [notice] = toResend(calls);
    expect(notice!.body.subject).toBe('New sign-up: Jane Doe (tag not added in Go High Level)');
    expect(String(notice!.body.text)).toContain('was added to Go High Level, but without its tag');
  });
});
