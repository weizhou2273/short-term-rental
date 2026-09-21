import 'server-only';
import { env } from '@/lib/config/env';

/**
 * Thin transport for the OwnerRez v2 REST API.
 *
 * Auth is HTTP Basic: the account's login email as the username and a Personal
 * Access Token as the password (OwnerRez issues these under Settings → API).
 * The same shape works for an OAuth bearer token by swapping the header, which
 * is why the header is built in one place.
 */

export class OwnerRezError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly body: string;

  constructor(message: string, status: number, endpoint: string, body: string) {
    super(message);
    this.name = 'OwnerRezError';
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }

  /** Upstream problems we can retry; caller errors we cannot. */
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/** Raised when a caller reaches the API without credentials configured. */
export class OwnerRezNotConfiguredError extends Error {
  constructor() {
    super(
      'OwnerRez is not configured. Set OWNERREZ_USERNAME and OWNERREZ_ACCESS_TOKEN.',
    );
    this.name = 'OwnerRezNotConfiguredError';
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export type OwnerRezRequest = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Seconds to cache a GET in the Next data cache. `0` disables caching. */
  revalidate?: number;
  /** Cache tags so a webhook can invalidate precisely. */
  tags?: string[];
  /** Total attempts for retryable failures, including the first. */
  attempts?: number;
  signal?: AbortSignal;
};

function authorizationHeader(): string {
  const { OWNERREZ_USERNAME, OWNERREZ_ACCESS_TOKEN } = env();
  if (!OWNERREZ_USERNAME || !OWNERREZ_ACCESS_TOKEN) throw new OwnerRezNotConfiguredError();
  const credentials = Buffer.from(
    `${OWNERREZ_USERNAME}:${OWNERREZ_ACCESS_TOKEN}`,
    'utf8',
  ).toString('base64');
  return `Basic ${credentials}`;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = env().OWNERREZ_API_BASE_URL.replace(/\/$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error('Aborted'));
      },
      { once: true },
    );
  });
}

/**
 * OwnerRez rate limits per token. On a 429 it sends `Retry-After`; honour it
 * when present and fall back to exponential backoff otherwise.
 */
function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 15_000);
  }
  return Math.min(2 ** attempt * 500, 8_000);
}

export async function ownerRezRequest<T>(
  path: string,
  options: OwnerRezRequest = {},
): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    revalidate,
    tags,
    attempts = 3,
    signal,
  } = options;

  const url = buildUrl(path, query);
  const headers: Record<string, string> = {
    Authorization: authorizationHeader(),
    Accept: 'application/json',
    'User-Agent': 'aerie-direct-booking/1.0 (+https://github.com)',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // Mutations must never be served from, or written to, a cache.
  const cacheable = method === 'GET' && revalidate !== 0;
  const next = cacheable ? { revalidate, tags } : undefined;

  let lastError: unknown;
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        ...(next ? { next } : { cache: 'no-store' as const }),
      });

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        const text = await response.text();
        return (text ? JSON.parse(text) : undefined) as T;
      }

      const text = await response.text().catch(() => '');
      const error = new OwnerRezError(
        `OwnerRez ${method} ${path} failed with ${response.status}`,
        response.status,
        path,
        text.slice(0, 2_000),
      );
      if (!error.retryable || attempt === attempts - 1) throw error;
      lastError = error;
      await delay(backoffMs(attempt, response.headers.get('retry-after')), signal);
    } catch (error) {
      // Credential and caller errors are terminal; transport blips are not.
      if (error instanceof OwnerRezNotConfiguredError) throw error;
      if (error instanceof OwnerRezError && !error.retryable) throw error;
      if (attempt === attempts - 1) throw error;
      lastError = error;
      await delay(backoffMs(attempt, null), signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OwnerRez request failed');
}

/**
 * OwnerRez paginates list endpoints with `offset`/`limit` and returns
 * `{ items, count, limit, offset, nextPageUrl }`. This walks every page, with a
 * hard ceiling so a misbehaving cursor cannot spin forever.
 */
export async function ownerRezList<T>(
  path: string,
  options: OwnerRezRequest = {},
  maxPages = 20,
): Promise<T[]> {
  const limit = Number(options.query?.limit ?? 50);
  const items: T[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const response = await ownerRezRequest<{
      items?: T[];
      count?: number;
      nextPageUrl?: string | null;
    }>(path, { ...options, query: { ...options.query, limit, offset: page * limit } });

    const batch = response?.items ?? [];
    items.push(...batch);
    if (batch.length < limit || !response?.nextPageUrl) break;
  }

  return items;
}
