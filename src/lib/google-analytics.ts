/**
 * Google Analytics 4. The measurement ID is public (it ships in every page),
 * like the Meta Pixel ID. Set NEXT_PUBLIC_GA_ID to override it, or to "off"
 * to disable it (e.g. on preview deployments).
 *
 * Page views are automatic, including client-side navigations (GA4's
 * enhanced measurement follows browser history). The booking funnel:
 *   view_item           a home's page is opened
 *   check_availability  a price appears in the booking card for chosen dates
 *   begin_checkout      "Reserve" is pressed, just before the redirect to Hospitable
 *   generate_lead       the chat's contact form or the welcome offer is sent
 *   search              the search page is shown
 * See them as a funnel in GA4 → Explore → Funnel exploration.
 */

const DEFAULT_GA_ID = 'G-QK3CL1J712';
const configured = process.env.NEXT_PUBLIC_GA_ID?.trim();

export const GA_ID: string | null = configured === 'off' ? null : configured || DEFAULT_GA_ID;

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    __wkGaReady?: boolean;
  }
}

/**
 * Sets up gtag's queue and configures the property, once. Called by the
 * loader and by every event, so an event sent before gtag.js has loaded is
 * queued after the config rather than lost.
 */
export function ensureGa(): Gtag | null {
  if (typeof window === 'undefined' || !GA_ID) return null;
  if (!window.__wkGaReady) {
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        // gtag.js reads the arguments object itself, exactly as Google's snippet pushes it.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    window.__wkGaReady = true;
  }
  return window.gtag!;
}

/** Sends a GA4 event. A no-op on the server or when disabled; never throws. */
export function trackGa(event: string, params?: Record<string, unknown>): void {
  try {
    ensureGa()?.('event', event, params);
  } catch {
    // Analytics must never break the page.
  }
}

/** GA4 wants values in currency units; the site's quotes are integer cents. */
export const centsToUnits = (cents: number) => Math.round(cents) / 100;
