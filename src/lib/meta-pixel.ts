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
 *   InitiateCheckout  "Reserve" is pressed, just before the redirect to Hospitable
 *   Lead              a guest leaves their name, email and phone in the chat
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

/** Sends a standard Meta event. A no-op on the server, when disabled, or if the pixel is blocked. */
export function trackMeta(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !META_PIXEL_ID || typeof window.fbq !== 'function') return;
  try {
    window.fbq('track', event, params);
  } catch {
    // Tracking must never break the page.
  }
}

/** Meta wants values in currency units; the site's quotes are integer cents. */
export const centsToUnits = (cents: number) => Math.round(cents) / 100;
