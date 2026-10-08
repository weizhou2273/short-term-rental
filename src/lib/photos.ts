/**
 * Property photos as the site uses them. They come from Hospitable (the same
 * gallery as the listings) via src/lib/hospitable/images.ts; this module only
 * holds the shape and the pure helpers, so client components can import it.
 */

export type PropertyPhoto = {
  /** Hospitable's file id (the filename without extension) — stable across reorders. */
  id: string;
  src: string;
  alt: string;
};

/** Images are only ever loaded from Hospitable's asset host (also allowed in next.config.ts). */
export const PHOTO_HOST = 'assets.hospitable.com';
export const PHOTO_PATH_PREFIX = '/property_images/';

export function isTrustedPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === PHOTO_HOST && url.pathname.startsWith(PHOTO_PATH_PREFIX);
  } catch {
    return false;
  }
}

export function photoId(src: string): string {
  const file = new URL(src).pathname.split('/').pop() ?? src;
  return file.replace(/\.[a-z0-9]+$/i, '');
}

export type PhotoOverrides = {
  /** Photo id to show first (cards, photo grid, social previews). */
  cover?: string;
  /** Photo ids to leave off the website (they stay on the listings). */
  hide?: string[];
};

export function applyPhotoOverrides(photos: PropertyPhoto[], overrides?: PhotoOverrides): PropertyPhoto[] {
  if (!overrides) return photos;
  const hidden = new Set(overrides.hide ?? []);
  const visible = photos.filter((p) => !hidden.has(p.id));
  const coverIndex = overrides.cover ? visible.findIndex((p) => p.id === overrides.cover) : -1;
  if (coverIndex <= 0) return visible;
  const cover = visible[coverIndex]!;
  return [cover, ...visible.slice(0, coverIndex), ...visible.slice(coverIndex + 1)];
}
