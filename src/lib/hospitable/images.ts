import 'server-only';
import { z } from 'zod';
import { hospitableFetch, HospitableNotConfiguredError } from './client';
import type { Property } from '@/data/types';
import { applyPhotoOverrides, isTrustedPhotoUrl, photoId, type PropertyPhoto } from '@/lib/photos';

/**
 * GET /properties/{uuid}/images — the ordered direct-booking gallery, the same
 * photos as the listings. Cached for an hour, so editing or reordering photos
 * in Hospitable reaches the site without a deploy.
 */

const PHOTO_REVALIDATE_SECONDS = 3600;

const imagesResponse = z.object({
  data: z.array(
    z.object({
      url: z.string(),
      caption: z.string().nullish(),
      order: z.number().nullish(),
    }),
  ),
});

export function normalizeImages(raw: unknown, property: Property): PropertyPhoto[] {
  const rows = imagesResponse
    .parse(raw)
    .data.map((row, index) => ({ ...row, index }))
    .filter((row) => isTrustedPhotoUrl(row.url))
    // Hospitable's order, ties kept in the order the API listed them.
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.index - b.index);

  const photos = rows.map((row, i) => ({
    id: photoId(row.url),
    src: row.url,
    alt: row.caption?.trim() || `${property.name}, photo ${i + 1}`,
  }));
  return applyPhotoOverrides(photos, property.photoOverrides);
}

/**
 * The property's photos, or [] when Hospitable can't be reached — pages then
 * fall back to placeholders rather than failing.
 */
export async function getPropertyPhotos(property: Property): Promise<PropertyPhoto[]> {
  try {
    const raw = await hospitableFetch<unknown>(`/properties/${encodeURIComponent(property.hospitable.uuid)}/images`, {
      revalidate: PHOTO_REVALIDATE_SECONDS,
    });
    return normalizeImages(raw, property);
  } catch (err) {
    if (err instanceof HospitableNotConfiguredError) console.warn('[photos] HOSPITABLE_PAT not set; showing placeholders');
    else console.error(`[photos] ${property.slug}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/** First photo of each property, keyed by slug (null when there are none). */
export async function getCoverPhotos(properties: Property[]): Promise<Record<string, PropertyPhoto | null>> {
  const entries = await Promise.all(properties.map(async (p) => [p.slug, (await getPropertyPhotos(p))[0] ?? null] as const));
  return Object.fromEntries(entries);
}
