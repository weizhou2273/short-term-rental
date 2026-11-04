import 'server-only';
import { createHash } from 'node:crypto';
import { getPropertyByUuid } from '@/data/properties';
import type { HospitableReservation } from '@/lib/hospitable/reservation';
import { META_PIXEL_ID } from '@/lib/meta-pixel';
import { SITE_URL } from '@/lib/seo';

/**
 * Meta Conversions API: sends a Purchase for each confirmed direct booking.
 *
 * Payment happens on Hospitable's checkout, so the browser pixel never sees the
 * booking. Hospitable's webhook tells us about it and we report it from here.
 *
 * The event is sent as action_source "system_generated" (reported by the booking
 * system), because Meta requires the guest's browser user agent for "website"
 * events and the webhook doesn't carry it. Meta matches the guest by hashed
 * email, phone, name and location instead.
 *
 * META_CAPI_TOKEN is a secret (Events Manager → dataset → Settings → Conversions
 * API → Generate access token). It is read only here, on the server.
 */

const GRAPH_VERSION = 'v25.0';
/** Meta rejects events more than 7 days old. */
const MAX_EVENT_AGE_S = 7 * 24 * 60 * 60;

export class MetaNotConfiguredError extends Error {
  constructor() {
    super('META_CAPI_TOKEN is not set.');
    this.name = 'MetaNotConfiguredError';
  }
}

export class MetaApiError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Meta Conversions API failed with ${status}: ${detail}`);
    this.name = 'MetaApiError';
  }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Normalizes then hashes, as Meta requires. Empty values are dropped. */
function hashed(value: string | null | undefined, normalize: (v: string) => string = (v) => v.trim().toLowerCase()) {
  if (!value) return undefined;
  const n = normalize(value);
  return n ? [sha256(n)] : undefined;
}

const digitsOnly = (v: string) => v.replace(/\D/g, '');
const lettersOnly = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');

/** "West Caldwell, NJ" → city "westcaldwell", state "nj". Anything else is ignored. */
function splitLocation(location: string | null | undefined): { city?: string; state?: string } {
  const m = location?.match(/^\s*([^,]+),\s*([A-Za-z]{2})\s*$/);
  return m ? { city: m[1], state: m[2] } : {};
}

export type PurchaseDecision =
  | { send: true; event: Record<string, unknown> }
  | { send: false; reason: string };

const statusOf = (r: HospitableReservation) =>
  (r.reservation_status?.current?.category ?? r.status ?? '').toLowerCase();

/** Builds the Purchase event for a reservation, or says why it shouldn't be sent. */
export function buildPurchaseEvent(r: HospitableReservation, nowS = Math.floor(Date.now() / 1000)): PurchaseDecision {
  if (r.platform !== 'direct') return { send: false, reason: `platform ${r.platform}` };
  if (statusOf(r) !== 'accepted') return { send: false, reason: `status ${statusOf(r) || 'unknown'}` };

  const cents = r.financials?.guest?.total_price?.amount;
  if (typeof cents !== 'number' || cents <= 0) return { send: false, reason: 'no total price' };

  const bookedS = r.booking_date ? Math.floor(Date.parse(r.booking_date) / 1000) : NaN;
  if (!Number.isFinite(bookedS)) return { send: false, reason: 'no booking date' };
  if (nowS - bookedS > MAX_EVENT_AGE_S) return { send: false, reason: 'booked more than 7 days ago' };

  const g = r.guest ?? {};
  const { city, state } = splitLocation(g.location);
  const phones = (g.phone_numbers ?? []).map(digitsOnly).filter(Boolean).map(sha256);
  const propertyUuid = r.properties?.[0]?.id;
  const property = propertyUuid ? getPropertyByUuid(propertyUuid) : undefined;

  const userData: Record<string, unknown> = {
    em: hashed(g.email),
    ph: phones.length ? phones : undefined,
    fn: hashed(g.first_name, lettersOnly),
    ln: hashed(g.last_name, lettersOnly),
    ct: hashed(city, lettersOnly),
    st: hashed(state, lettersOnly),
    country: city ? [sha256('us')] : undefined,
    external_id: g.id != null ? hashed(String(g.id)) : undefined,
  };
  for (const key of Object.keys(userData)) if (userData[key] === undefined) delete userData[key];
  if (!userData.em && !userData.ph) return { send: false, reason: 'no guest email or phone to match on' };

  return {
    send: true,
    event: {
      event_name: 'Purchase',
      event_time: Math.min(bookedS, nowS),
      // Same id for every webhook about this booking, so Meta counts it once.
      event_id: `purchase-${r.id}`,
      action_source: 'system_generated',
      event_source_url: SITE_URL,
      user_data: userData,
      custom_data: {
        currency: (r.financials?.currency ?? 'USD').toUpperCase(),
        value: Math.round(cents) / 100,
        order_id: r.code ?? r.id,
        content_ids: [property?.slug ?? propertyUuid ?? 'unknown'],
        content_name: property?.name,
        content_type: 'hotel',
        num_items: 1,
        checkin_date: r.arrival_date?.slice(0, 10),
        checkout_date: r.departure_date?.slice(0, 10),
      },
    },
  };
}

export function metaCapiConfigured(): boolean {
  return Boolean(process.env.META_CAPI_TOKEN && META_PIXEL_ID);
}

/** Posts events to Meta. Set META_TEST_EVENT_CODE to see them under Events Manager → Test events. */
export async function sendMetaEvents(events: Record<string, unknown>[]): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !META_PIXEL_ID) throw new MetaNotConfiguredError();

  const body: Record<string, unknown> = { data: events };
  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  if (testCode) body.test_event_code = testCode;

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text.slice(0, 300);
    try {
      detail = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? detail;
    } catch {
      // keep the raw text
    }
    throw new MetaApiError(res.status, detail);
  }
}
