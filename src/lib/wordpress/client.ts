import 'server-only';
import { env } from '@/lib/config/env';

/**
 * Headless WordPress over the built-in REST API (`/wp-json/wp/v2`).
 *
 * The REST API is used rather than WPGraphQL so the CMS needs no plugins beyond
 * whatever the editorial team already runs — a constraint that matters when the
 * site is handed to an owner who will manage their own hosting.
 *
 * Public content is fetched anonymously. Application Password credentials are
 * only attached when present, and are only needed for drafts and previews.
 */

export class WordPressError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'WordPressError';
    this.status = status;
  }
}

export type WpQuery = Record<string, string | number | boolean | undefined>;

export type WpRequestOptions = {
  query?: WpQuery;
  revalidate?: number;
  tags?: string[];
  /** Send credentials, required for drafts and preview. */
  authenticated?: boolean;
};

function apiRoot(): string {
  const base = env().WORDPRESS_API_URL;
  if (!base) throw new WordPressError('WORDPRESS_API_URL is not set', 500);
  return base.replace(/\/$/, '');
}

function authHeader(): Record<string, string> {
  const { WORDPRESS_APP_USER, WORDPRESS_APP_PASSWORD } = env();
  if (!WORDPRESS_APP_USER || !WORDPRESS_APP_PASSWORD) return {};
  const token = Buffer.from(
    `${WORDPRESS_APP_USER}:${WORDPRESS_APP_PASSWORD}`,
    'utf8',
  ).toString('base64');
  return { Authorization: `Basic ${token}` };
}

export async function wpRequest<T>(
  path: string,
  options: WpRequestOptions = {},
): Promise<T> {
  const { query, revalidate, tags, authenticated = false } = options;
  const url = new URL(`${apiRoot()}/wp-json/wp/v2${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(authenticated ? authHeader() : {}),
    },
    next: { revalidate: revalidate ?? env().CONTENT_REVALIDATE_SECONDS, tags },
  });

  if (!response.ok) {
    throw new WordPressError(
      `WordPress GET ${path} failed with ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}
