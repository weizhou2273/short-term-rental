import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_PROPERTY_ENTRIES, getPropertyBySlug } from '@/data/properties';
import type { Property } from '@/data/types';
import { coverPhoto, entryFile, propertyPhotos } from '@/lib/photos';

const PUBLIC_PHOTOS = path.join(process.cwd(), 'public', 'photos');
const ALLOWED = /\.(jpe?g|png|webp|avif)$/i;

const withPhotos = (photos: Property['photos']): Property => ({ ...getPropertyBySlug('clover-lodge')!, photos });

describe('propertyPhotos', () => {
  it('serves files from /photos/<slug>/ in the listed order', () => {
    const photos = propertyPhotos(withPhotos(['pool.jpg', { file: 'kitchen.jpg', alt: ' Chef’s kitchen ' }, 'deck.jpg']));
    expect(photos).toEqual([
      { src: '/photos/clover-lodge/pool.jpg', alt: 'Clover Lodge, photo 1' },
      { src: '/photos/clover-lodge/kitchen.jpg', alt: 'Chef’s kitchen' },
      { src: '/photos/clover-lodge/deck.jpg', alt: 'Clover Lodge, photo 3' },
    ]);
  });

  it('URL-encodes awkward filenames', () => {
    expect(propertyPhotos(withPhotos(['Great Room #1.jpg']))[0]!.src).toBe('/photos/clover-lodge/Great%20Room%20%231.jpg');
  });

  it('uses the first photo as the cover, or none when the list is empty', () => {
    expect(coverPhoto(withPhotos(['a.jpg', 'b.jpg']))?.src).toBe('/photos/clover-lodge/a.jpg');
    expect(coverPhoto(withPhotos([]))).toBeUndefined();
  });
});

// Runs against the real data: a typo or a missing upload fails the build's
// checks instead of shipping a broken image.
describe.each(ALL_PROPERTY_ENTRIES.map((p) => [p.slug, p] as const))('photos listed for %s', (slug, property) => {
  const files = property.photos.map(entryFile);

  it('are plain image filenames, each listed once', () => {
    for (const file of files) {
      expect(file, `${slug}: "${file}" must be a filename, not a path`).not.toMatch(/[\\/]|^\.|\.\./);
      expect(file, `${slug}: "${file}" must be .jpg, .png, .webp or .avif`).toMatch(ALLOWED);
    }
    expect(new Set(files).size, `${slug}: a photo is listed twice`).toBe(files.length);
  });

  it(`exist in public/photos/${slug}/`, () => {
    const missing = files.filter((file) => !fs.existsSync(path.join(PUBLIC_PHOTOS, slug, file)));
    expect(missing, `${slug}: listed but not uploaded`).toEqual([]);
  });
});
