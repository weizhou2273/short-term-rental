import type { PhotoEntry } from '@/lib/photos';

/**
 * Content types for the site. SITE and PROPERTIES (in ./site.ts and
 * ./properties.ts) are the only places brand and listing copy live; every
 * component reads from them.
 */

export type BookingMode =
  /** Our own booking card → /api/quote → redirect to Hospitable checkout. */
  | 'native'
  /** Hospitable's embedded Direct widget. Kept as a fallback / revert switch. */
  | 'widget';

export type Attraction = {
  id: string;
  name: string;
  kind: string;
};

export type Site = {
  brand: string;
  domain: string;
  tagline: string;
  subline: string;
  contactEmail: string;
  hospitable: {
    /** Hospitable Direct widget loader script. */
    loaderSrc: string;
    /** Direct site id. Also sent as `custom_site_id` when creating quotes. */
    siteUuid: string;
    theme: string;
  };
  bookingMode: BookingMode;
  /** "Where" options. Each property lists the attraction ids it is near. */
  attractions: Attraction[];
  /** Shown once on the results page instead of as filters. */
  everyEstate: string[];
};

export type PropertyFeatures = {
  privatePool: boolean;
  sportCourt: boolean;
  waterfront: boolean;
  petFriendly: boolean;
};

export type Property = {
  id: string;
  /** URL segment: /stays/[slug]. */
  slug: string;
  /** true = kept in the data file but removed from the site everywhere. */
  hidden?: boolean;
  /**
   * Name shown on the site. Only matters to Hospitable in bookingMode "widget":
   * the mockup noted the widget's health check looks for the Hospitable
   * property name in the page text, so test the widget if you switch to it.
   */
  name: string;
  /** One line under the name on cards and the stay page, e.g. "8 bedrooms · tennis court, pool". */
  tagline: string;
  location: string;
  area: string;
  type: string;
  guests: number;
  bedrooms: number;
  beds: number;
  baths: number;
  rating: number;
  reviewCount: number;
  nearby: string[];
  features: PropertyFeatures;
  /** % position on the search page's map placeholder. */
  mapPos: { x: number; y: number };
  /**
   * Center of the "Where you'll be" map, drawn as an approximate-area circle.
   * Never the exact address: these values are public in the page.
   * null = map placeholder.
   */
  coords: { lat: number | null; lng: number | null };
  /** One line under the map, e.g. drive times. The exact-address note is added after it. */
  neighborhood?: string;
  /**
   * Photos in display order: filenames in /public/photos/[slug]/, optionally
   * with alt text and a room, e.g.
   * ['pool.jpg', { file: 'kitchen.jpg', room: 'Full kitchen', alt: 'Chef’s kitchen' }].
   * The first is the cover; the first five are the stay page's photo grid.
   * Rooms group the photo tour, in order of each room's first photo.
   * Empty = placeholders.
   */
  photos: PhotoEntry[];
  /** "About this home": opening paragraphs, always shown. */
  description: string[];
  /** Titled sections ("Sun room", "Pool"…) behind "Show more" under the description. */
  details?: { title: string; text: string }[];
  sleeping: { room: string; beds: string }[];
  amenities: string[];
  rules: {
    checkIn: string;
    checkOut: string;
    house: string[];
    safety: string[];
    cancellation: string;
  };
  /** Guest first name, "Month YYYY", and the public review text. */
  reviews: { name: string; date: string; text: string }[];
  faqs: { q: string; a: string }[];
  hospitable: {
    /** data-property-id from the property's Hospitable widget code (null = placeholder). */
    propertyId: string | null;
    /** Public API v2 property UUID — used for quotes, search and calendar. */
    uuid: string;
  };
};
