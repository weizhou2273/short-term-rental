'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { ensureGa, GA_ID, trackGa } from '@/lib/google-analytics';

/** Loads Google Analytics 4 once (root layout). Page views are sent by GA itself. */
export function GoogleAnalytics() {
  useEffect(() => {
    ensureGa();
  }, []);
  if (!GA_ID) return null;
  return <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />;
}

/** Sends one GA4 event when the page mounts (for use from server pages). */
export function GaEvent({ event, params }: { event: string; params?: Record<string, unknown> }) {
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    trackGa(event, params);
    // Re-send only when the event or its data actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key]);
  return null;
}
