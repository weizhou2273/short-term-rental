import type { Property } from '@/data/types';

/**
 * Property photos are files in /public/photos/[slug]/, listed in order in each
 * property's `photos` (src/data/properties.ts). The first is the cover (cards,
 * link previews), the first HERO_GRID_COUNT fill the stay page's photo grid,
 * and all of them appear in the gallery. next/image resizes them on request.
 */

/** A filename in the property's folder, optionally with alt text. */
export type PhotoEntry = string | { file: string; alt?: string };

export type PropertyPhoto = { src: string; alt: string };

export const PHOTO_ROOT = '/photos';
export const HERO_GRID_COUNT = 5;

export const entryFile = (entry: PhotoEntry) => (typeof entry === 'string' ? entry : entry.file);

export function propertyPhotos(property: Property): PropertyPhoto[] {
  return property.photos.map((entry, i) => {
    const alt = typeof entry === 'string' ? undefined : entry.alt?.trim();
    return {
      src: `${PHOTO_ROOT}/${property.slug}/${encodeURIComponent(entryFile(entry))}`,
      alt: alt || `${property.name}, photo ${i + 1}`,
    };
  });
}

export const coverPhoto = (property: Property): PropertyPhoto | undefined => propertyPhotos(property)[0];
