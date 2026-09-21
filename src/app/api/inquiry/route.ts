import { NextResponse } from 'next/server';
import { inquirySchema } from '@/lib/booking/validation';
import { getPropertyBySlug } from '@/lib/ownerrez/properties';
import { ownerRezConfigured } from '@/lib/config/env';
import { ownerRezRequest } from '@/lib/ownerrez/client';
import { apiError, unexpectedError, validationError } from '@/lib/api/respond';
import { clientKey, rateLimit } from '@/lib/api/rate-limit';

/**
 * Contact and enquiry form.
 *
 * Enquiries are pushed into OwnerRez as inquiries so they land in the same
 * inbox as platform leads and inherit the account's auto-responder rules,
 * rather than becoming an email nobody triages.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, 'inquiry'), 5, 10 * 60_000);
  if (!limit.ok) {
    return apiError('Thanks — we already have your message.', 429, {
      retryAfter: limit.retryAfter,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError('Expected a JSON body.', 400);
  }

  const parsed = inquirySchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  // Honeypot. Answer as though it worked so a bot learns nothing.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }

  const { name, email, message, arrival, departure, propertySlug } = parsed.data;

  try {
    const property = propertySlug ? await getPropertyBySlug(propertySlug) : null;

    if (!ownerRezConfigured()) {
      // Without credentials there is nowhere to file it; log it so a developer
      // running locally can still see the submission landed.
      console.info('[inquiry] received (OwnerRez not configured)', {
        name,
        email,
        property: property?.name ?? null,
      });
      return NextResponse.json({ ok: true, delivered: false });
    }

    const [firstName, ...rest] = name.split(' ');
    await ownerRezRequest('/inquiries', {
      method: 'POST',
      body: {
        property_id: property?.id,
        arrival,
        departure,
        notes: message,
        guest: {
          first_name: firstName || name,
          last_name: rest.join(' ') || '—',
          email_addresses: [{ address: email, is_default: true }],
        },
        source: 'Direct website',
      },
      revalidate: 0,
    });

    return NextResponse.json({ ok: true, delivered: true });
  } catch (error) {
    return unexpectedError('inquiry', error);
  }
}
