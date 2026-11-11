/**
 * Meta (Facebook/Instagram) Pixel for ads tracking.
 *
 * The pixel ID is public (it ships in every page's HTML), so it lives here rather
 * than in an env var. Set NEXT_PUBLIC_META_PIXEL_ID to override it, or to "off"
 * to disable tracking (e.g. on preview deployments).
 *
 * Events sent from this site:
 *   PageView          every page, including client-side navigations
 *   ViewContent       a stay page is opened
 *   Search            the search page is shown with a query
 *   AddToCart         a price appears in the booking card for chosen dates
 *   InitiateCheckout  "Reserve" is pressed, just before the redirect to Hospitable
 *   Lead              a guest leaves their details in the chat, or signs up for the welcome offer
 * Purchase can't be sent from here: payment happens on booking.hospitable.com.
 */

const DEFAULT_PIXEL_ID = '1474031564861079';
const configured = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

export const META_PIXEL_ID: string | null =
  configured === 'off' ? null : configured || DEFAULT_PIXEL_ID;

type Fbq = (command: 'init' | 'track' | 'trackCustom', name: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

const RETRY_MS = 250;
const RETRY_FOR_MS = 8_000;

/**
 * Sends a standard Meta event. A no-op on the server or when disabled.
 *
 * An event sent while the page is still starting (e.g. ViewContent when a
 * visitor lands straight on a home's page) can run before the pixel's script
 * has defined fbq, so it waits for it briefly instead of being dropped. If the
 * pixel is blocked, the event is quietly given up.
 */
export function trackMeta(event: string, params?: Record<string, unknown>, waited = 0): void {
  if (typeof window === 'undefined' || !META_PIXEL_ID) return;
  if (typeof window.fbq !== 'function') {
    if (waited < RETRY_FOR_MS) setTimeout(() => trackMeta(event, params, waited + RETRY_MS), RETRY_MS);
    return;
  }
  try {
    window.fbq('track', event, params);
  } catch {
    // Tracking must never break the page.
  }
}

/** Meta wants values in currency units; the site's quotes are integer cents. */
export const centsToUnits = (cents: number) => Math.round(cents) / 100;
