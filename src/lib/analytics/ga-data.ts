import 'server-only';
import { createSign } from 'node:crypto';

/**
 * Google Analytics Data API (GA4 reports), read with a Google Cloud service
 * account that has Viewer access to the property. No Google library: the
 * service account signs a short-lived JWT, which Google swaps for an access
 * token (cached until shortly before it expires).
 *
 *   GA_SERVICE_ACCOUNT_KEY  the service account's JSON key (as downloaded, or base64 of it)
 *   GA_PROPERTY_ID          the GA4 property's numeric ID (Admin → Property details)
 */

export class GaNotConfiguredError extends Error {}

type ServiceAccount = { client_email: string; private_key: string };

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://analyticsdata.googleapis.com/v1beta';

export function serviceAccount(raw = process.env.GA_SERVICE_ACCOUNT_KEY): ServiceAccount {
  const text = raw?.trim();
  if (!text) throw new GaNotConfiguredError('GA_SERVICE_ACCOUNT_KEY is not set');
  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8'));
  } catch {
    throw new GaNotConfiguredError('GA_SERVICE_ACCOUNT_KEY is not the JSON key file (or its base64)');
  }
  if (!parsed.client_email || !parsed.private_key) throw new GaNotConfiguredError('GA_SERVICE_ACCOUNT_KEY is missing client_email or private_key');
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

export function propertyId(raw = process.env.GA_PROPERTY_ID): string {
  const id = raw?.trim().replace(/^properties\//, '');
  if (!id || !/^\d+$/.test(id)) throw new GaNotConfiguredError('GA_PROPERTY_ID must be the numeric property ID');
  return id;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

/** The signed JWT a service account sends to get an access token. */
export function signedAssertion(sa: ServiceAccount, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key, 'base64url');
  return `${head}.${claims}.${signature}`;
}

let cached: { token: string; expires: number; email: string } | null = null;

export async function accessToken(now = Date.now()): Promise<string> {
  const sa = serviceAccount();
  if (cached && cached.email === sa.client_email && cached.expires - 60_000 > now) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signedAssertion(sa, now) }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed (${res.status}): ${body.error_description ?? body.error ?? 'no token'}`);
  cached = { token: body.access_token, expires: now + (body.expires_in ?? 3600) * 1000, email: sa.client_email };
  return body.access_token;
}

/** For tests. */
export function forgetToken() {
  cached = null;
}

export type GaReport = {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
};

async function call<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API}/properties/${propertyId()}:${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Google Analytics answered ${res.status}: ${json.error?.message ?? 'error'}`);
  return json;
}

/** Up to 5 reports in one call. */
export const batchRunReports = (requests: object[]) => call<{ reports?: GaReport[] }>('batchRunReports', { requests });

export const runRealtimeReport = (request: object) => call<GaReport>('runRealtimeReport', request);

/** A report's rows as plain objects keyed by the dimension and metric names. */
export function rowsOf(report: GaReport | undefined): Record<string, string>[] {
  const dims = report?.dimensionHeaders?.map((h) => h.name) ?? [];
  const mets = report?.metricHeaders?.map((h) => h.name) ?? [];
  return (report?.rows ?? []).map((r) => {
    const row: Record<string, string> = {};
    dims.forEach((d, i) => (row[d] = r.dimensionValues?.[i]?.value ?? ''));
    mets.forEach((m, i) => (row[m] = r.metricValues?.[i]?.value ?? '0'));
    return row;
  });
}
