import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_PROPERTY_ENTRIES, getPropertyBySlug } from '@/data/properties';
import type { Property } from '@/data/types';
import { coverPhoto, entryFile, photoTour, propertyPhotos } from '@/lib/photos';

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

  it('carries the room through, trimmed, and drops blank ones', () => {
    const photos = propertyPhotos(withPhotos([{ file: 'a.jpg', room: ' Bedroom 1 ' }, { file: 'b.jpg', room: '  ' }, 'c.jpg']));
    expect(photos.map((p) => p.room)).toEqual(['Bedroom 1', undefined, undefined]);
  });
});

describe('photoTour', () => {
  const tourOf = (photos: Property['photos']) =>
    photoTour(propertyPhotos(withPhotos(photos))).map((r) => [r.room, r.photos.map((p) => p.index)]);

  it('groups by room in order of first appearance, keeping list order and indexes', () => {
    expect(
      tourOf([
        { file: 'yard-1.jpg', room: 'Backyard' },
        { file: 'kitchen-1.jpg', room: 'Kitchen' },
        { file: 'yard-2.jpg', room: 'Backyard' },
        { file: 'bed-1.jpg', room: 'Bedroom 1' },
        { file: 'kitchen-2.jpg', room: 'Kitchen' },
      ]),
    ).toEqual([
      ['Backyard', [0, 2]],
      ['Kitchen', [1, 4]],
      ['Bedroom 1', [3]],
    ]);
  });

  it('puts photos without a room in one group', () => {
    expect(tourOf(['a.jpg', { file: 'b.jpg', room: 'Pool' }, 'c.jpg'])).toEqual([
      [null, [0, 2]],
      ['Pool', [1]],
    ]);
    expect(tourOf(['a.jpg', 'b.jpg'])).toEqual([[null, [0, 1]]]);
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

  it('are either all sorted into rooms or none are', () => {
    // A photo left out by mistake would otherwise show up as a stray "More photos" room.
    const withRoom = propertyPhotos(property).filter((p) => p.room).length;
    expect([0, files.length], `${slug}: ${files.length - withRoom} photo(s) have no room`).toContain(withRoom);
  });

  it(`exist in public/photos/${slug}/`, () => {
    const missing = files.filter((file) => !fs.existsSync(path.join(PUBLIC_PHOTOS, slug, file)));
    expect(missing, `${slug}: listed but not uploaded`).toEqual([]);
  });
});
