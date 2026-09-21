import type { Property } from '@/lib/booking/types';
import { site } from '@/lib/config/site';
import { absoluteUrl, siteUrl } from '@/lib/config/metadata';
import { toMajorUnits } from '@/lib/util/money';
import { htmlToText, truncateText } from '@/lib/wordpress/sanitize';

/**
 * Structured data. Vacation rentals compete heavily in organic search, and
 * `VacationRental` / `LodgingBusiness` markup is what earns the rich result
 * that makes a direct-booking site findable next to the OTAs.
 *
 * The payload is serialised with `<` escaped so a stray angle bracket in CMS
 * copy cannot break out of the script tag.
 */
function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function OrganizationJsonLd() {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        name: site.name,
        description: site.description,
        url: siteUrl(),
        email: site.email,
        telephone: site.phone,
        address: {
          '@type': 'PostalAddress',
          addressLocality: site.address.locality,
          addressRegion: site.address.region,
          addressCountry: site.address.country,
        },
        sameAs: Object.values(site.social),
      }}
    />
  );
}

export function PropertyJsonLd({ property }: { property: Property }) {
  const rate = property.baseNightlyRate;

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'VacationRental',
        name: property.name,
        description: truncateText(htmlToText(property.description || property.summary), 400),
        url: absoluteUrl(`/properties/${property.slug}`),
        image: property.images.slice(0, 6).map((image) => image.url),
        numberOfBedrooms: property.capacity.bedrooms,
        numberOfBathroomsTotal: property.capacity.bathrooms,
        occupancy: {
          '@type': 'QuantitativeValue',
          maxValue: property.capacity.maxGuests,
          unitCode: 'C62',
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: property.location.locality,
          addressRegion: property.location.region,
          addressCountry: property.location.country,
        },
        ...(property.location.latitude !== null && property.location.longitude !== null
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: property.location.latitude,
                longitude: property.location.longitude,
              },
            }
          : {}),
        amenityFeature: property.amenities.slice(0, 20).map((amenity) => ({
          '@type': 'LocationFeatureSpecification',
          name: amenity.label,
          value: true,
        })),
        checkinTime: property.rules.checkInTime,
        checkoutTime: property.rules.checkOutTime,
        ...(rate
          ? {
              offers: {
                '@type': 'Offer',
                priceCurrency: rate.currency,
                price: toMajorUnits(rate),
                availability: 'https://schema.org/InStock',
                url: absoluteUrl(`/properties/${property.slug}`),
              },
            }
          : {}),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: absoluteUrl(item.path),
        })),
      }}
    />
  );
}
