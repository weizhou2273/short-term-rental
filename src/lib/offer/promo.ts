/**
 * Promo codes in the browser: the welcome-offer popup saves the guest's code
 * here, and the booking card sends it with every price check. Hospitable
 * decides whether a code applies (src/app/api/quote/route.ts).
 */

/** Letters, digits, - and _, as Hospitable codes are written. */
export const PROMO_PATTERN = /^[A-Za-z0-9_-]{2,30}$/;

const KEY = 'wk-promo-v1';

export function readSavedPromo(): string | null {
  try {
    const code = localStorage.getItem(KEY);
    return code && PROMO_PATTERN.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function savePromo(code: string | null): void {
  try {
    if (code) localStorage.setItem(KEY, code);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the guest can still type the code in.
  }
}
