import 'server-only';

/**
 * Transport for the Hospitable Public API v2.
 *
 * HOSPITABLE_PAT is a Personal Access Token with write access, so it is read
 * here and nowhere else. `server-only` makes the build fail if any client
 * component ever imports this module, which is what keeps the token out of
 * the browser bundle.
 */

const DEFAULT_BASE_URL = 'https://public.api.hospitable.com/v2';
const TIMEOUT_MS = 10_000;

export class HospitableError extends Error {
  readonly status: number;
  readonly path: string;
  /** Upstream error message, when the API sent one. Safe to show guests for 4xx. */
  readonly upstreamMessage: string | null;

  constructor(status: number, path: string, upstreamMessage: string | null) {
    super(`Hospitable ${path} failed with ${status}${upstreamMessage ? `: ${upstreamMessage}` : ''}`);
    this.name = 'HospitableError';
    this.status = status;
    this.path = path;
    this.upstreamMessage = upstreamMessage;
  }
}

export class HospitableNotConfiguredError extends Error {
  constructor() {
    super('HOSPITABLE_PAT is not set.');
    this.name = 'HospitableNotConfiguredError';
  }
}

export function hospitableConfigured(): boolean {
  return Boolean(process.env.HOSPITABLE_PAT);
}

type Query = Record<string, string | number | undefined>;

export type HospitableRequest = {
  method?: 'GET' | 'POST';
  query?: Query;
  body?: unknown;
  /** Seconds to keep a GET in the Next data cache. Omit for no caching. */
  revalidate?: number;
};

function baseUrl(): string {
  return (process.env.HOSPITABLE_API_BASE || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Pulls a human-readable message out of a Hospitable error body. */
function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) return record.message;
  // Laravel-style validation errors: { errors: { field: ["message"] } }
  if (record.errors && typeof record.errors === 'object') {
    for (const value of Object.values(record.errors as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      if (typeof value === 'string') return value;
    }
  }
  return null;
}

export async function hospitableFetch<T>(path: string, req: HospitableRequest = {}): Promise<T> {
  const token = process.env.HOSPITABLE_PAT;
  if (!token) throw new HospitableNotConfiguredError();

  const method = req.method ?? 'GET';
  const init: RequestInit & { next?: { revalidate: number } } = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(req.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (method === 'GET' && req.revalidate) init.next = { revalidate: req.revalidate };
  else init.cache = 'no-store';

  const res = await fetch(buildUrl(path, req.query), init);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) throw new HospitableError(res.status, path, extractMessage(body));
  return body as T;
}
