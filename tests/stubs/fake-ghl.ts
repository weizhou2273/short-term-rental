import { vi } from 'vitest';

/**
 * A stand-in for Go High Level (and Resend) behind `fetch`, for tests: keeps
 * contacts, their tags and notes in memory, answers the calls the site makes,
 * and records every call so tests can check exactly what was sent.
 */

export type Call = { host: string; method: string; path: string; query: URLSearchParams; headers: Headers; body: Record<string, unknown> | null };

export type FakeGhl = {
  calls: Call[];
  contacts: Map<string, { email: string; phone: string; tags: Set<string>; notes: { id: string; body: string }[] }>;
  /** Makes the next matching call answer with this status. */
  failNext: (match: (c: Call) => boolean, status?: number) => void;
  toGhl: () => Call[];
  toResend: () => Call[];
};

export function installFakeGhl({ resendStatus = 200 }: { resendStatus?: number } = {}): FakeGhl {
  const calls: Call[] = [];
  const contacts: FakeGhl['contacts'] = new Map();
  const failures: { match: (c: Call) => boolean; status: number }[] = [];
  let ids = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const call: Call = {
        host: url.host,
        method: (init?.method ?? 'GET').toUpperCase(),
        path: url.pathname,
        query: url.searchParams,
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      };
      calls.push(call);
      if (call.host === 'api.resend.com') return new Response('{"id":"e1"}', { status: resendStatus });
      const failure = failures.findIndex((f) => f.match(call));
      if (failure !== -1) {
        const { status } = failures.splice(failure, 1)[0]!;
        return Response.json({ message: status === 401 ? 'Invalid token' : 'Not allowed' }, { status });
      }
      const p = call.path.split('/').filter(Boolean);
      if (call.method === 'POST' && call.path === '/contacts/upsert') {
        const b = call.body as { email: string; phone: string };
        let id = [...contacts].find(([, c]) => c.email === b.email)?.[0];
        const isNew = !id;
        if (!id) {
          id = `c_${++ids}`;
          contacts.set(id, { email: b.email, phone: b.phone, tags: new Set(), notes: [] });
        }
        return Response.json({ new: isNew, contact: { id } }, { status: isNew ? 201 : 200 });
      }
      if (call.method === 'GET' && call.path === '/contacts/search/duplicate') {
        const email = call.query.get('email');
        const number = call.query.get('number');
        const hit = [...contacts].find(([, c]) => (email && c.email === email) || (number && c.phone === number));
        return Response.json({ contact: hit ? { id: hit[0] } : null });
      }
      const contact = p[0] === 'contacts' ? contacts.get(p[1] ?? '') : undefined;
      if (!contact) return Response.json({ message: 'Contact not found' }, { status: 400 });
      if (call.method === 'POST' && p[2] === 'tags') {
        for (const t of (call.body as { tags: string[] }).tags) contact.tags.add(t);
        return Response.json({ tags: [...contact.tags] }, { status: 201 });
      }
      if (p[2] === 'notes' && call.method === 'GET') return Response.json({ notes: contact.notes });
      if (p[2] === 'notes' && call.method === 'POST') {
        const note = { id: `n_${++ids}`, body: String((call.body as { body: string }).body) };
        contact.notes.push(note);
        return Response.json({ note }, { status: 201 });
      }
      if (p[2] === 'notes' && call.method === 'PUT') {
        const note = contact.notes.find((n) => n.id === p[3]);
        if (!note) return Response.json({ message: 'Note not found' }, { status: 400 });
        note.body = String((call.body as { body: string }).body);
        return Response.json({ note });
      }
      return Response.json({ message: `unexpected ${call.method} ${call.path}` }, { status: 404 });
    }),
  );
  return {
    calls,
    contacts,
    failNext: (match, status = 500) => failures.push({ match, status }),
    toGhl: () => calls.filter((c) => c.host === 'services.leadconnectorhq.com'),
    toResend: () => calls.filter((c) => c.host === 'api.resend.com'),
  };
}

/** Next's `after()` only runs inside a real request; tests queue the callbacks and run them on demand. */
export function fakeAfter() {
  const queue: (() => unknown)[] = [];
  return {
    after: (fn: () => unknown) => {
      queue.push(fn);
    },
    run: async () => {
      while (queue.length) await queue.shift()!();
    },
  };
}
