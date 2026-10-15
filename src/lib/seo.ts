import { SITE } from '@/data/site';
import type { Property } from '@/data/types';
import { propertyPhotos } from '@/lib/photos';

/**
 * Search engine helpers: the canonical site address, page descriptions and
 * schema.org structured data (JSON-LD). Everything here is public and must
 * match what the pages show; the exact street address is never included.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || `https://${SITE.domain}`).replace(/\/$/, '');

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Ways people type the brand, so "WK Reserve" finds "W&K Reserve". */
export const BRAND_ALIASES = ['WK Reserve', 'W and K Reserve', 'W & K Reserve', 'wkreserve'];

/** Photos listed per stay in the sitemap and structured data: the curated first few. */
const SEO_PHOTO_COUNT = 10;

export const stayPath = (p: Property) => `/stays/${p.slug}`;

export const stayPhotoUrls = (p: Property) => propertyPhotos(p).slice(0, SEO_PHOTO_COUNT).map((photo) => absoluteUrl(photo.src));

export const stayTitle = (p: Property) => `${p.name} — ${p.bedrooms}-Bedroom Poconos Vacation Rental`;

export const stayDescription = (p: Property) =>
  `${p.tagline}. ${p.type} in ${p.area}, PA in the Pocono Mountains, for up to ${p.guests} guests. Book direct with ${SITE.brand} and pay no service fee.`;

const ORG_ID = `${SITE_URL}/#organization`;

/** Home page: the site and the business behind it. The site name and aliases feed Google's site name in results. */
export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE.brand,
        alternateName: BRAND_ALIASES,
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: SITE.brand,
        alternateName: BRAND_ALIASES,
        url: `${SITE_URL}/`,
        description: `${SITE.tagline}. ${SITE.subline}`,
        email: SITE.contactEmail,
        telephone: SITE.contactPhone.replace(/[^\d+]/g, ''),
        sameAs: [`https://www.instagram.com/${SITE.instagram}/`],
        areaServed: 'Pocono Mountains, Pennsylvania',
      },
    ],
  };
}

/**
 * A stay page: the home as lodging, with the same facts and rating the page shows.
 *
 * Not schema.org VacationRental: Google validates that type for its vacation
 * rental listings, which need a Hotel Center partnership and the home's exact
 * coordinates. Those listings come through Hospitable's Google Vacation
 * Rentals connection instead, and the exact location stays off the page.
 */
export function stayJsonLd(p: Property) {
  const fullBaths = Math.floor(p.baths);
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${absoluteUrl(stayPath(p))}#rental`,
    name: p.name,
    description: stayDescription(p),
    url: absoluteUrl(stayPath(p)),
    image: stayPhotoUrls(p),
    brand: { '@type': 'Brand', name: SITE.brand },
    // Town only: the exact address is shared after booking.
    address: { '@type': 'PostalAddress', addressLocality: p.area, addressRegion: 'PA', addressCountry: 'US' },
    containsPlace: {
      '@type': 'Accommodation',
      additionalType: 'EntirePlace',
      occupancy: { '@type': 'QuantitativeValue', maxValue: p.guests },
      numberOfBedrooms: p.bedrooms,
      numberOfFullBathrooms: fullBaths,
      numberOfPartialBathrooms: p.baths > fullBaths ? 1 : 0,
      amenityFeature: p.amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
    },
    petsAllowed: p.features.petFriendly,
    aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewCount, bestRating: 5 },
  };
}

/** Script-safe JSON for a `<script type="application/ld+json">` (no `</script>` break-out). */
export const jsonLdScript = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');
