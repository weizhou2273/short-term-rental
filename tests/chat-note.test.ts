import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeGhl } from './stubs/fake-ghl';

type NextServer = typeof NextServerModule;

// Next's after() only runs inside a real request: queue the callbacks for the tests to run.
const deferred = vi.hoisted(() => ({ queue: [] as (() => unknown)[] }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<NextServer>()),
  after: (fn: () => unknown) => {
    deferred.queue.push(fn);
  },
}));
const runAfter = async () => {
  while (deferred.queue.length) await deferred.queue.shift()!();
};

const runChat = vi.fn();
vi.mock('@/lib/chat/agent', () => ({ runChat: (...args: unknown[]) => runChat(...args) }));
vi.mock('@/lib/chat/recap', () => ({ sendRecap: vi.fn(async () => 'skipped') }));

const { POST: postLead } = await import('@/app/api/chat/lead/route');
const { POST: postChat } = await import('@/app/api/chat/route');
const { POST: postTranscript } = await import('@/app/api/chat/transcript/route');
const { chatNoteBody, NO_MESSAGES, noteHeader, saveChatNote } = await import('@/lib/chat/chat-note');
const { signLead, verifyLead } = await import('@/lib/chat/lead');

const TOKEN = 'pit-test-secret-0000';
const JANE = { name: 'Jane Doe', email: 'jane@example.com', phone: '(929) 555-0101' };
const CHAT = 'chat-1234-abcd';
const AT = new Date('2026-11-14T03:52:00Z'); // 10:52 PM ET
const HI = [
  { role: 'user' as const, content: 'Is Minsi Pond free Dec 30?' },
  { role: 'assistant' as const, content: 'Yes! [Minsi Pond](/stays/minsi-pond) is **open** then.' },
];

let ip = 0;
const req = (path: string, body: unknown) =>
  new NextRequest(`https://wkreserve.com${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'wkreserve.com', origin: 'https://wkreserve.com', 'x-forwarded-for': `10.9.0.${++ip}` },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('GHL_API_TOKEN', TOKEN);
  vi.stubEnv('GHL_LOCATION_ID', 'loc_1');
  deferred.queue.length = 0;
  runChat.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the transcript note', () => {
  it('reads as the team asked: header, then Visitor / Concierge, with plain links', () => {
    const body = chatNoteBody(null, { header: noteHeader(AT, '/stays/minsi-pond?utm_source=facebook'), messages: HI, ref: CHAT });
    expect(body).toBe(
      [
        'Website chat transcript – Nov 13, 2026, 10:52 PM ET – page: /stays/minsi-pond',
        '',
        'Visitor: Is Minsi Pond free Dec 30?',
        '',
        'Concierge: Yes! Minsi Pond (https://wkreserve.com/stays/minsi-pond) is open then.',
        '',
        '—',
        `Chat ref: ${CHAT}`,
      ].join('\n'),
    );
  });

  it('says so when the guest typed nothing, and records their text-message choice', () => {
    const body = chatNoteBody(null, { header: noteHeader(AT, '/'), messages: [], consent: { smsNonMarketing: true, smsMarketing: false }, ref: CHAT });
    expect(body).toContain(`\n\n${NO_MESSAGES}\n\n—\n`);
    expect(NO_MESSAGES).toBe('Started chat, no messages.');
    expect(body).toContain('Texts agreed to in this chat: non-marketing yes, marketing no');
  });

  it('keeps the header and the recorded choice as the chat goes on, and never loses earlier messages', () => {
    const start = chatNoteBody(null, { header: noteHeader(AT, '/'), messages: [], consent: { smsNonMarketing: false, smsMarketing: false }, ref: CHAT });
    const later = chatNoteBody(start, { header: noteHeader(new Date(), '/search'), messages: HI, ref: CHAT });
    expect(later.split('\n')[0]).toBe(start.split('\n')[0]);
    expect(later).not.toContain(NO_MESSAGES);
    expect(later).toContain('Texts agreed to in this chat: non-marketing no, marketing no');
    // Long chats: the browser drops the oldest messages; the note keeps them.
    const turns = Array.from({ length: 6 }, (_, i) => [
      { role: 'user' as const, content: `Question ${i}` },
      { role: 'assistant' as const, content: `Answer ${i}` },
    ]).flat();
    const full = chatNoteBody(null, { header: 'H', messages: turns.slice(0, 8), ref: CHAT });
    const next = chatNoteBody(full, { header: 'H', messages: turns.slice(4), ref: CHAT });
    for (let i = 0; i < 6; i++) expect(next).toContain(`Visitor: Question ${i}\n\nConcierge: Answer ${i}`);
    expect(next.match(/Question 2/g)).toHaveLength(1);
  });
});

describe('saving a chat to Go High Level', () => {
  it('creates the note and tags the contact once, then updates that same note', async () => {
    const ghl = installFakeGhl();
    ghl.contacts.set('c_7', { email: JANE.email, phone: '+19295550101', tags: new Set(['sms-consent-marketing']), notes: [] });
    const lead = { ...JANE, contactId: 'c_7' };
    expect(await saveChatNote({ lead, chatId: CHAT, page: '/', messages: [], at: AT })).toEqual({ ok: true, created: true });
    expect(await saveChatNote({ lead, chatId: CHAT, messages: HI })).toEqual({ ok: true, created: false });
    const contact = ghl.contacts.get('c_7')!;
    expect(contact.notes).toHaveLength(1);
    expect(contact.notes[0]!.body).toContain('Visitor: Is Minsi Pond free Dec 30?');
    // The tag is added; a tag already on the contact (here a consent tag) stays.
    expect([...contact.tags].sort()).toEqual(['chat-transcript', 'sms-consent-marketing']);
    expect(ghl.toGhl().filter((c) => c.path.endsWith('/tags'))).toHaveLength(1);
    // The calls carry the token only in the Authorization header, with the API version.
    const put = ghl.toGhl().find((c) => c.method === 'PUT')!;
    expect(put.path).toBe(`/contacts/c_7/notes/${contact.notes[0]!.id}`);
    expect(put.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(put.headers.get('version')).toBe('2021-07-28');
    // A different chat is a different note.
    await saveChatNote({ lead, chatId: 'chat-5678-efgh', messages: HI });
    expect(contact.notes).toHaveLength(2);
  });

  it('finds the contact by email or phone when the sign-in token predates contact ids, and adds one if missing', async () => {
    const ghl = installFakeGhl();
    ghl.contacts.set('c_3', { email: 'other@example.com', phone: '+19295550101', tags: new Set(), notes: [] });
    await saveChatNote({ lead: JANE, chatId: CHAT, messages: HI });
    expect(ghl.contacts.get('c_3')!.notes).toHaveLength(1);
    const dup = ghl.toGhl().filter((c) => c.path === '/contacts/search/duplicate');
    expect(dup.map((c) => [c.query.get('email'), c.query.get('number')])).toEqual([
      ['jane@example.com', null],
      [null, '+19295550101'],
    ]);
    // Nobody to find: added with the chat tag only, never a text-message tag (we don't know their choice).
    const fresh = installFakeGhl();
    await saveChatNote({ lead: { ...JANE, email: 'new@example.com', phone: '(212) 555-0199' }, chatId: CHAT, messages: HI });
    const [added] = [...fresh.contacts.values()];
    expect([...added!.tags].sort()).toEqual(['chat-transcript', 'wkreserve-chat']);
    expect(fresh.toGhl().find((c) => c.path === '/contacts/upsert')!.body).not.toHaveProperty('tags');
  });

  it('reports a failure without throwing, and never logs the token', async () => {
    const ghl = installFakeGhl();
    ghl.failNext(() => true, 401);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await saveChatNote({ lead: { ...JANE, contactId: 'c_1' }, chatId: CHAT, messages: HI });
    expect(result).toMatchObject({ ok: false, error: 'Go High Level answered 401: Invalid token' });
    expect(log.mock.calls.flat().join(' ')).not.toContain(TOKEN);
  });

  it('does nothing without Go High Level set up', async () => {
    const ghl = installFakeGhl();
    vi.stubEnv('GHL_API_TOKEN', '');
    expect(await saveChatNote({ lead: JANE, chatId: CHAT, messages: HI })).toEqual({ ok: true });
    expect(ghl.calls).toHaveLength(0);
  });
});

describe('a chat, start to finish', () => {
  it('starts the note at sign-in, fills it after each reply, and finishes it at the end, with the email as backup', async () => {
    const ghl = installFakeGhl();
    // 1. Sign-in: no boxes ticked.
    const res = await postLead(req('/api/chat/lead', { ...JANE, page: '/stays/minsi-pond?utm_source=facebook', chatId: CHAT }));
    const { token } = await res.json();
    expect(verifyLead(token)).toEqual({ ...JANE, contactId: 'c_1' });
    await runAfter();
    const contact = ghl.contacts.get('c_1')!;
    expect(contact.notes).toHaveLength(1);
    expect(contact.notes[0]!.body).toMatch(/^Website chat transcript – .+ ET – page: \/stays\/minsi-pond\n\nStarted chat, no messages\.\n\n—\nTexts agreed to in this chat: non-marketing no, marketing no\nChat ref: chat-1234-abcd$/);
    // Consent: nothing ticked, so no consent tag.
    expect([...contact.tags].sort()).toEqual(['chat-transcript', 'wkreserve-chat']);

    // 2. A message and its reply: the server updates the note, no browser needed.
    runChat.mockImplementation(async ({ emit }) => {
      emit({ type: 'turn' });
      emit({ type: 'text', text: 'Let me check…' });
      emit({ type: 'reset' });
      emit({ type: 'text', text: HI[1]!.content });
    });
    const chat = await postChat(req('/api/chat', { lead: token, chatId: CHAT, page: '/stays/minsi-pond', messages: [HI[0]] }));
    await chat.text();
    await runAfter();
    expect(contact.notes).toHaveLength(1);
    expect(contact.notes[0]!.body).toContain('Visitor: Is Minsi Pond free Dec 30?\n\nConcierge: Yes! Minsi Pond (https://wkreserve.com/stays/minsi-pond) is open then.');
    expect(contact.notes[0]!.body).not.toContain('Let me check');
    expect(contact.notes[0]!.body).toContain('Texts agreed to in this chat: non-marketing no, marketing no');

    // 3. The guest leaves: same note, and the email backup.
    expect((await postTranscript(req('/api/chat/transcript', { lead: token, chatId: CHAT, page: '/', messages: HI }))).status).toBe(204);
    expect(contact.notes).toHaveLength(1);
    expect(ghl.toResend().map((c) => c.body?.subject)).toEqual(['Website chat: Jane Doe', 'Website chat: Jane Doe']);
    expect(ghl.toGhl().filter((c) => c.path.endsWith('/tags')).map((c) => c.body)).toEqual([{ tags: ['wkreserve-chat'] }, { tags: ['chat-transcript'] }]);
    // Nothing ever removes a tag.
    expect(ghl.toGhl().filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('keeps the visitor’s question in the note even when the reply fails', async () => {
    const ghl = installFakeGhl();
    ghl.contacts.set('c_2', { email: JANE.email, phone: '+19295550101', tags: new Set(), notes: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    runChat.mockRejectedValue(new Error('boom'));
    const res = await postChat(req('/api/chat', { lead: signLead(JANE, Date.now(), 'c_2'), chatId: CHAT, messages: [HI[0]] }));
    await res.text();
    await runAfter();
    expect(ghl.contacts.get('c_2')!.notes[0]!.body).toContain('Visitor: Is Minsi Pond free Dec 30?\n\n—');
  });

  it('sends the email when Go High Level fails, and saves to Go High Level when the email fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const token = signLead(JANE, Date.now(), 'c_1');
    // Go High Level down.
    let ghl = installFakeGhl();
    ghl.failNext((c) => c.host === 'services.leadconnectorhq.com', 503);
    expect((await postTranscript(req('/api/chat/transcript', { lead: token, chatId: CHAT, messages: HI }))).status).toBe(204);
    expect(ghl.toResend()).toHaveLength(1);
    expect(log.mock.calls.flat().join(' ')).toContain('transcript note not saved');
    // Email down.
    ghl = installFakeGhl({ resendStatus: 500 });
    ghl.contacts.set('c_1', { email: JANE.email, phone: '+19295550101', tags: new Set(), notes: [] });
    expect((await postTranscript(req('/api/chat/transcript', { lead: token, chatId: CHAT, messages: HI }))).status).toBe(204);
    expect(ghl.contacts.get('c_1')!.notes).toHaveLength(1);
    expect(log.mock.calls.flat().join(' ')).toContain('transcript email not sent');
    expect(log.mock.calls.flat().join(' ')).not.toContain(TOKEN);
  });

  it('adds each text-message tag only for the box ticked in that sign-in, and never removes one', async () => {
    const ghl = installFakeGhl();
    ghl.contacts.set('c_5', { email: JANE.email, phone: '+19295550101', tags: new Set(['sms-consent-non-marketing']), notes: [] });
    // Nothing ticked now: no consent tag sent, and the one already there stays.
    await postLead(req('/api/chat/lead', { ...JANE, chatId: CHAT }));
    await runAfter();
    const tagCalls = () => ghl.toGhl().filter((c) => c.path.endsWith('/tags')).map((c) => c.body!.tags);
    expect(tagCalls()).toEqual([['wkreserve-chat'], ['chat-transcript']]);
    expect([...ghl.contacts.get('c_5')!.tags].sort()).toEqual(['chat-transcript', 'sms-consent-non-marketing', 'wkreserve-chat']);
    // Only the marketing box ticked: only the marketing tag.
    await postLead(req('/api/chat/lead', { ...JANE, smsMarketing: true, chatId: 'chat-9999-zzzz' }));
    expect(tagCalls().at(-1)).toEqual(['wkreserve-chat', 'sms-consent-marketing']);
    // The upsert itself never carries tags (that would replace the contact's tags).
    expect(ghl.toGhl().filter((c) => c.path === '/contacts/upsert').every((c) => !('tags' in c.body!))).toBe(true);
    expect(ghl.toGhl().filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('makes no chat note for the /text-signup page, which isn’t a chat', async () => {
    const ghl = installFakeGhl();
    await postLead(req('/api/chat/lead', { ...JANE, page: '/text-signup' }));
    await runAfter();
    expect([...ghl.contacts.values()][0]!.notes).toHaveLength(0);
  });
});
