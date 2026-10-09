/**
 * Shapes shared by API routes and client components. Amounts are integer
 * cents, as Hospitable sends them, so nothing is ever rounded twice.
 */

export type MoneyLine = { label: string; amount: number };

export type Quote = {
  quoteId: string;
  /** Hospitable's hosted checkout for this exact quote. */
  bookingUrl: string;
  currency: string;
  nights: number;
  /** Accommodation subtotal (nightly rates, after Hospitable's pricing rules). */
  accommodation: number;
  fees: MoneyLine[];
  discounts: MoneyLine[];
  taxes: MoneyLine[];
  total: number;
  /** Total with all fees, before taxes: the figure cards and the price heading show. */
  totalBeforeTaxes: number;
};

export type SearchResult = {
  slug: string;
  available: boolean;
  /** Stay total before taxes, in cents. Null when Hospitable did not price it. */
  totalWithoutTaxes: number | null;
  /** Average nightly rate across the stay, in cents. */
  nightlyAverage: number | null;
  currency: string;
};

export type CalendarDay = {
  date: string;
  available: boolean;
  minStay: number | null;
  closedForCheckin: boolean;
  closedForCheckout: boolean;
};

/**
 * A stay picked for a guest who hasn't chosen dates (as Airbnb does): the
 * property's first open stay, priced with all fees, before taxes.
 */
export type SuggestedStay = {
  checkin: string;
  checkout: string;
  nights: number;
  /** Cents. */
  total: number;
  currency: string;
};

export type ApiError = { error: string };
