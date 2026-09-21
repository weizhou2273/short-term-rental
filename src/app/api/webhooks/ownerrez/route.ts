import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/config/env';
import { PROPERTIES_TAG, propertyTag } from '@/lib/ownerrez/properties';
import { availabilityTag } from '@/lib/ownerrez/availability';
import { expireTag } from '@/lib/api/cache';

/**
 * OwnerRez webhook.
 *
 * Its job is cache invalidation. When a booking lands from Airbnb, a block is
 * added, or a rate changes, OwnerRez tells us and we drop the affected cache
 * tags so the next visitor sees a true calendar. Without this, a night sold on
 * an OTA could stay bookable here for the length of the revalidation window —
 * the single worst failure mode a direct-booking site has.
 */
export const dynamic = 'force-dynamic';

const payloadSchema = z
  .object({
    event: z.string().nullish(),
    action: z.string().nullish(),
    property_id: z.union([z.number(), z.string()]).nullish(),
    booking_id: z.union([z.number(), z.string()]).nullish(),
  })
  .passthrough();

/**
 * Verifies the shared-secret signature OwnerRez sends with each delivery.
 * Compared in constant time so the check cannot be probed byte by byte.
 */
function signatureValid(raw: string, provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided.replace(/^sha256=/, '').trim(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = env().OWNERREZ_WEBHOOK_SECRET;
  const raw = await request.text();

  if (secret) {
    const provided =
      request.headers.get('x-ownerrez-signature') ??
      request.headers.get('x-signature') ??
      request.headers.get('x-hub-signature-256');
    if (!signatureValid(raw, provided, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else {
    // Unsigned deliveries are accepted only so the integration can be wired up
    // before the secret is issued. Loudly, and never silently.
    console.warn('[ownerrez] webhook accepted without OWNERREZ_WEBHOOK_SECRET set');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unrecognised payload' }, { status: 400 });
  }

  const propertyId = Number.parseInt(String(parsed.data.property_id ?? ''), 10);
  const event = (parsed.data.event ?? parsed.data.action ?? 'unknown').toLowerCase();

  if (Number.isFinite(propertyId)) {
    expireTag(availabilityTag(propertyId));
    expireTag(propertyTag(propertyId));
  } else {
    // Without a property id we cannot be precise, so drop the whole portfolio
    // rather than risk serving a stale calendar.
    expireTag(PROPERTIES_TAG);
  }

  if (event.includes('property') || event.includes('listing')) {
    expireTag(PROPERTIES_TAG);
  }

  console.info(`[ownerrez] ${event} → revalidated property ${propertyId || 'all'}`);
  return NextResponse.json({ received: true });
}
