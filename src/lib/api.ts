import 'server-only';
import { ZodError } from 'zod';
import { HospitableError, HospitableNotConfiguredError } from '@/lib/hospitable/client';
import type { ApiError } from '@/lib/booking/types';

/** JSON responses for the API routes. Every response is uncacheable by intermediaries. */

export function json<T>(body: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return Response.json(body, { ...init, headers });
}

export function errorResponse(error: string, status: number, headers?: HeadersInit): Response {
  return json<ApiError>({ error }, { status, headers });
}

/**
 * Maps an upstream failure to something a guest can act on, and logs the
 * detail for us. Hospitable's own message is passed through only for
 * request-level problems (dates unavailable, min stay, occupancy), never for
 * auth or server errors.
 */
export function upstreamErrorResponse(err: unknown, context: string): Response {
  if (err instanceof HospitableNotConfiguredError) {
    console.error(`[${context}] HOSPITABLE_PAT is not set`);
    return errorResponse('Online booking is temporarily unavailable. Please contact us to book.', 503);
  }
  if (err instanceof HospitableError) {
    console.error(`[${context}] ${err.message}`);
    if (err.status === 422 || err.status === 400 || err.status === 409) {
      return errorResponse(err.upstreamMessage ?? 'Those dates can’t be booked. Try different dates.', 422);
    }
    if (err.status === 404) return errorResponse('That stay isn’t available for online booking.', 404);
    if (err.status === 429) {
      return errorResponse('We’re getting a lot of requests. Please try again in a minute.', 503, { 'Retry-After': '60' });
    }
    return errorResponse('Couldn’t reach our booking system. Please try again.', 502);
  }
  if (err instanceof ZodError) {
    console.error(`[${context}] unexpected Hospitable response shape`, err.issues);
    return errorResponse('Couldn’t read the price from our booking system. Please try again.', 502);
  }
  console.error(`[${context}]`, err);
  return errorResponse('Something went wrong. Please try again.', 500);
}
