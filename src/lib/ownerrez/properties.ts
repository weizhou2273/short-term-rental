import 'server-only';
import { cache } from 'react';
import { env, ownerRezConfigured, propertyAllowList } from '@/lib/config/env';
import type { Property } from '@/lib/booking/types';
import { demoProperties } from '@/lib/demo/properties';
import { lowestNightlyRate } from '@/lib/booking/pricing';
import { uniqueSlug } from '@/lib/util/slug';
import { ownerRezList, OwnerRezNotConfiguredError } from './client';
import { mapProperty } from './mapper';
import { orListingSchema, orPropertySchema, parseMany } from './schema';

export const PROPERTIES_TAG = 'ownerrez:properties';
export const propertyTag = (id: number) => `ownerrez:property:${id}`;

/**
 * The portfolio, mapped into the domain model.
 *
 * Wrapped in React `cache` so a single render pass hits OwnerRez once no matter
 * how many components ask — the layout, the page and the JSON-LD block all call
 * this freely.
 */
async function loadFromOwnerRez(): Promise<Property[]> {
  const revalidate = env().CONTENT_REVALIDATE_SECONDS;

  const [propertyRows, listingRows] = await Promise.all([
    ownerRezList<unknown>('/properties', {
      query: { includeTags: false },
      revalidate,
      tags: [PROPERTIES_TAG],
    }),
    // Listing content (photos, descriptions, amenities) lives separately from
    // the property record. A failure here degrades content but not booking.
    ownerRezList<unknown>('/listings', { revalidate, tags: [PROPERTIES_TAG] }).catch(
      (error) => {
        console.error('[ownerrez] listings unavailable, continuing without them', error);
        return [] as unknown[];
      },
    ),
  ]);

  const properties = parseMany(orPropertySchema, propertyRows, 'property');
  const listings = parseMany(orListingSchema, listingRows, 'listing');
  const listingByProperty = new Map(
    listings
      .filter((listing) => typeof listing.property_id === 'number')
      .map((listing) => [listing.property_id as number, listing]),
  );

  const allowList = propertyAllowList();
  const taken = new Set<string>();

  return properties
    .filter((row) => (allowList ? allowList.has(row.id) : true))
    .filter((row) => row.active !== false)
    .map((row) => {
      const slug = uniqueSlug(row.name, row.id, taken);
      const property = mapProperty(row, listingByProperty.get(row.id) ?? null, slug);
      // OwnerRez does not expose a "from" price, so derive one from the rate
      // engine's forward window until a live rate calendar is fetched.
      return { ...property, baseNightlyRate: property.baseNightlyRate ?? null };
    });
}

export const getProperties = cache(async (): Promise<Property[]> => {
  if (!ownerRezConfigured()) return withDerivedRates(demoProperties);

  try {
    const properties = await loadFromOwnerRez();
    if (properties.length === 0) {
      console.warn('[ownerrez] returned no active properties; falling back to demo data');
      return withDerivedRates(demoProperties);
    }
    return withDerivedRates(properties);
  } catch (error) {
    if (error instanceof OwnerRezNotConfiguredError) return withDerivedRates(demoProperties);
    // A dead CMS should not take the marketing site down with it.
    console.error('[ownerrez] property load failed, serving demo portfolio', error);
    return withDerivedRates(demoProperties);
  }
});

/** Ensures every property carries a display rate, even when upstream omits one. */
function withDerivedRates(properties: Property[]): Property[] {
  return properties.map((property) => ({
    ...property,
    baseNightlyRate: property.baseNightlyRate ?? lowestNightlyRate(property),
  }));
}

export const getPropertyBySlug = cache(async (slug: string): Promise<Property | null> => {
  const properties = await getProperties();
  return properties.find((property) => property.slug === slug) ?? null;
});

export const getPropertyById = cache(async (id: number): Promise<Property | null> => {
  const properties = await getProperties();
  return properties.find((property) => property.id === id) ?? null;
});
