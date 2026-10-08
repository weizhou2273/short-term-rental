import type { Property } from '@/data/types';

/**
 * Property photos are files in /public/photos/[slug]/, listed in order in each
 * property's `photos` (src/data/properties.ts). The first is the cover (cards,
 * link previews), the first HERO_GRID_COUNT fill the stay page's photo grid,
 * and all of them appear in the photo tour, grouped by room.
 * next/image resizes them on request.
 */

/** A filename in the property's folder, optionally with alt text and the room it shows. */
export type PhotoEntry = string | { file: string; alt?: string; room?: string };

export type PropertyPhoto = { src: string; alt: string; room?: string };

/** A room in the photo tour. `room` is null for photos not assigned to one. */
export type TourRoom = { room: string | null; photos: { photo: PropertyPhoto; index: number }[] };

export const PHOTO_ROOT = '/photos';
export const HERO_GRID_COUNT = 5;

export const entryFile = (entry: PhotoEntry) => (typeof entry === 'string' ? entry : entry.file);

export function propertyPhotos(property: Property): PropertyPhoto[] {
  return property.photos.map((entry, i) => {
    const { file, alt, room } = typeof entry === 'string' ? { file: entry } : entry;
    return {
      src: `${PHOTO_ROOT}/${property.slug}/${encodeURIComponent(file)}`,
      alt: alt?.trim() || `${property.name}, photo ${i + 1}`,
      ...(room?.trim() ? { room: room.trim() } : {}),
    };
  });
}

export const coverPhoto = (property: Property): PropertyPhoto | undefined => propertyPhotos(property)[0];

/**
 * Groups photos by room for the photo tour. Rooms come in the order their
 * first photo appears in the list; each room keeps its photos in list order,
 * with `index` pointing back into the full list.
 */
export function photoTour(photos: PropertyPhoto[]): TourRoom[] {
  const rooms = new Map<string | null, TourRoom>();
  photos.forEach((photo, index) => {
    const key = photo.room ?? null;
    let group = rooms.get(key);
    if (!group) rooms.set(key, (group = { room: key, photos: [] }));
    group.photos.push({ photo, index });
  });
  return [...rooms.values()];
}
