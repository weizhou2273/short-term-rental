import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { json } from '@/lib/api';
import { HospitableError } from '@/lib/hospitable/client';
import { getReservation } from '@/lib/hospitable/reservation';
import { buildPurchaseEvent, MetaApiError, metaCapiConfigured, sendMetaEvents } from '@/lib/meta/capi';

/**
 * POST /api/webhooks/hospitable?key=HOSPITABLE_WEBHOOK_KEY
 *
 * Hospitable (Apps → Webhooks, type Reservations) calls this on
 * reservation.created / reservation.changed. For a confirmed direct booking
 * we send a Meta Purchase event.
 *
 * - The URL must carry ?key= matching HOSPITABLE_WEBHOOK_KEY.
 * - Only the reservation id is taken from the body; everything else is read
 *   back from Hospitable's API, so a forged call can't report a fake booking.
 * - Meta drops repeats with the same event_id, so retries and later
 *   reservation.changed calls don't double count.
 * - 2xx tells Hospitable to stop; 5xx makes it retry (up to 5 times).
 */

function keyMatches(given: string | null): boolean {
  const expected = process.env.HOSPITABLE_WEBHOOK_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ok = (result: string) => json({ ok: true, result });

export async function POST(request: NextRequest): Promise<Response> {
  if (!keyMatches(request.nextUrl.searchParams.get('key'))) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: unknown; data?: { id?: unknown } } | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send a JSON body.' }, { status: 400 });
  }

  const action = typeof body?.action === 'string' ? body.action : '';
  if (action !== 'reservation.created' && action !== 'reservation.changed') return ok(`ignored ${action || 'unknown action'}`);

  const id = body?.data?.id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Missing reservation id.' }, { status: 400 });

  // Skip cheaply before calling Hospitable when the webhook already says it's not direct.
  const platform = (body?.data as { platform?: unknown }).platform;
  if (typeof platform === 'string' && platform !== 'direct') return ok(`skipped: platform ${platform}`);

  if (!metaCapiConfigured()) {
    console.error('[hospitable-webhook] META_CAPI_TOKEN is not set');
    return json({ error: 'Not configured.' }, { status: 503 });
  }

  try {
    const reservation = await getReservation(id);
    const decision = buildPurchaseEvent(reservation);
    if (!decision.send) return ok(`skipped: ${decision.reason}`);
    await sendMetaEvents([decision.event]);
    console.info(`[hospitable-webhook] Purchase sent for ${reservation.code ?? id}`);
    return ok('purchase sent');
  } catch (err) {
    if (err instanceof HospitableError && err.status === 404) return ok('skipped: reservation not found');
    console.error('[hospitable-webhook]', err instanceof Error ? err.message : err);
    // 4xx from Meta won't fix itself on retry; 5xx and network errors might.
    if (err instanceof MetaApiError && err.status >= 400 && err.status < 500) {
      return json({ error: 'Meta rejected the event.' }, { status: 200 });
    }
    return json({ error: 'Temporary failure.' }, { status: 502 });
  }
}
