'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GuestCount, Quote } from '@/lib/booking/types';
import type { IsoDate } from '@/lib/util/date';

export type QuoteState = {
  quote: Quote | null;
  loading: boolean;
  /** Message to show the guest; null when the request succeeded. */
  error: string | null;
  /** Per-field problems from stay validation, e.g. minimum-nights. */
  issues: { field: string; message: string }[];
};

type QuoteArgs = {
  propertyId: number;
  arrival: IsoDate | null;
  departure: IsoDate | null;
  guests: GuestCount;
  /** Skip fetching until the guest has actually picked both dates. */
  enabled?: boolean;
};

type Result = Omit<QuoteState, 'loading'> & { key: string };

const DEBOUNCE_MS = 350;
const EMPTY: QuoteState = { quote: null, loading: false, error: null, issues: [] };

/**
 * Prices a stay against the server.
 *
 * Quoting is server-side on purpose: rates, fees and taxes come from OwnerRez
 * and must not be reimplemented (or trusted) in the browser. The hook debounces
 * rapid date changes and aborts superseded requests so a fast clicker never
 * sees an older quote land after a newer one.
 *
 * State is keyed by the request it belongs to, and `loading` is derived from a
 * key mismatch rather than stored. That keeps every `setState` inside an async
 * callback instead of the effect body, and means a stale quote can never be
 * shown next to newly-chosen dates.
 */
export function useQuote({
  propertyId,
  arrival,
  departure,
  guests,
  enabled = true,
}: QuoteArgs): QuoteState & { refresh: () => void } {
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const key = useMemo(() => {
    if (!enabled || !arrival || !departure) return null;
    const { adults, children, infants, pets } = guests;
    return [propertyId, arrival, departure, adults, children, infants, pets, nonce].join('|');
  }, [enabled, arrival, departure, propertyId, guests, nonce]);

  const [result, setResult] = useState<Result | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (key === null) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, arrival, departure, guests }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          quote?: Quote;
          error?: string;
          issues?: { field: string; message: string }[];
        };

        if (controller.signal.aborted) return;

        if (!response.ok || !payload.quote) {
          setResult({
            key,
            quote: null,
            error: payload.error ?? 'We could not price these dates.',
            issues: payload.issues ?? [],
          });
          return;
        }

        setResult({ key, quote: payload.quote, error: null, issues: [] });
      } catch (error) {
        // An abort is the expected outcome of a superseded request, not a failure.
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return;
        setResult({
          key,
          quote: null,
          error: 'Something went wrong pricing these dates. Please try again.',
          issues: [],
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, propertyId, arrival, departure, guests]);

  if (key === null) return { ...EMPTY, refresh };

  // A result from a previous request is not this request's answer.
  if (result?.key !== key) return { ...EMPTY, loading: true, refresh };

  return {
    quote: result.quote,
    error: result.error,
    issues: result.issues,
    loading: false,
    refresh,
  };
}
