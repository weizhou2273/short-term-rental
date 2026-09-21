import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { fieldErrors } from '@/lib/booking/validation';

/** Uniform JSON error shape so every client handler can read one thing. */
export function apiError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function validationError(error: ZodError): NextResponse {
  return apiError('Some details need fixing.', 422, { fields: fieldErrors(error) });
}

/**
 * Logs the real cause server-side and returns something safe.
 *
 * Upstream errors routinely carry request bodies, credentials in URLs and stack
 * paths; none of that belongs in a browser response.
 */
export function unexpectedError(context: string, error: unknown): NextResponse {
  console.error(`[api] ${context}`, error);
  return apiError('Something went wrong on our side. Please try again.', 500);
}
