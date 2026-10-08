import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import imagesFixture from './fixtures/images-1680-clover-rd.json';
import { getPropertyBySlug } from '@/data/properties';
import type { Property } from '@/data/types';
import { getCoverPhotos, getPropertyPhotos, normalizeImages } from '@/lib/hospitable/images';
import { applyPhotoOverrides, isTrustedPhotoUrl } from '@/lib/photos';

// The fixture is the first 8 of the 33 photos Hospitable returned for 1680 Clover Rd (property-2).
const clover = getPropertyBySlug('property-2')!;
const base = 'https://assets.hospitable.com/property_images/411552/';

function mockHospitable(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.HOSPITABLE_PAT = 'test-pat';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.HOSPITABLE_PAT;
});

describe('normalizeImages', () => {
  it('keeps Hospitable’s order and gives every photo alt text', () => {
    const photos = normalizeImages(imagesFixture, clover);
    expect(photos).toHaveLength(8);
    expect(photos[0]).toEqual({
      id: 'YlgaGTY9XgwOf5jYfY2juH9m9UGfTXh6KwB1dFbJ',
      src: `${base}YlgaGTY9XgwOf5jYfY2juH9m9UGfTXh6KwB1dFbJ.jpg`,
      alt: 'Property 2, photo 1', // caption is null/empty in Hospitable
    });
    // Ties on `order` (four photos at 33) stay in the order the API listed them.
    expect(photos.slice(4).map((p) => p.id)).toEqual([
      'FNYjMeWQtdW6nqeycFXEUAFc2uI42edAPFoHTcYZ',
      'TCTqMh3s3LQ2QADgtxiRFZtpFHXfdIzQkUovCNKO',
      'Jdt16L5qUGBRYqvHsGlTT06H80LRfCFDudpEhH3D',
      'iNgrT5aU3LyQGLq3eY1JPSkmBHGprg25dB3BYlpm',
    ]);
  });

  it('sorts by order and uses captions when Hospitable has them', () => {
    const photos = normalizeImages(
      {
        data: [
          { url: `${base}b.jpg`, order: 2, caption: null },
          { url: `${base}a.jpg`, order: 1, caption: ' Pool at dusk ' },
          { url: `${base}c.jpg`, order: null },
        ],
      },
      clover,
    );
    expect(photos.map((p) => [p.id, p.alt])).toEqual([
      ['a', 'Pool at dusk'],
      ['b', 'Property 2, photo 2'],
      ['c', 'Property 2, photo 3'],
    ]);
  });

  it('drops images that are not on Hospitable’s asset host', () => {
    const photos = normalizeImages(
      {
        data: [
          { url: 'https://evil.example.com/property_images/x.jpg', order: 0 },
          { url: 'http://assets.hospitable.com/property_images/411552/insecure.jpg', order: 1 },
          { url: 'https://assets.hospitable.com/avatars/me.jpg', order: 2 },
          { url: `${base}ok.jpg`, order: 3 },
        ],
      },
      clover,
    );
    expect(photos.map((p) => p.id)).toEqual(['ok']);
  });

  it('applies website-only cover and hide overrides', () => {
    const withOverrides: Property = {
      ...clover,
      photoOverrides: { cover: 'SRzz9AhLUSYud5wlcyDDbVhIUUh9wSQf3ZxB7VIz', hide: ['lUXeYlwROTO8uRztLFT0WYCKKW32EY1FbaguuAUk'] },
    };
    const ids = normalizeImages(imagesFixture, withOverrides).map((p) => p.id);
    expect(ids[0]).toBe('SRzz9AhLUSYud5wlcyDDbVhIUUh9wSQf3ZxB7VIz');
    expect(ids[1]).toBe('YlgaGTY9XgwOf5jYfY2juH9m9UGfTXh6KwB1dFbJ');
    expect(ids).not.toContain('lUXeYlwROTO8uRztLFT0WYCKKW32EY1FbaguuAUk');
    expect(ids).toHaveLength(7);
  });
});

describe('applyPhotoOverrides', () => {
  const photos = ['a', 'b', 'c'].map((id) => ({ id, src: `${base}${id}.jpg`, alt: id }));
  it('ignores an unknown cover id', () => {
    expect(applyPhotoOverrides(photos, { cover: 'zzz' }).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('isTrustedPhotoUrl', () => {
  it.each([
    [`${base}x.jpg`, true],
    ['https://assets.hospitable.com.evil.com/property_images/x.jpg', false],
    ['not a url', false],
  ])('%s → %s', (url, ok) => expect(isTrustedPhotoUrl(url)).toBe(ok));
});

describe('getPropertyPhotos', () => {
  it('fetches the property’s images from Hospitable, cached for an hour', async () => {
    const fetchMock = mockHospitable(200, imagesFixture);
    const photos = await getPropertyPhotos(clover);
    expect(photos).toHaveLength(8);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { next?: { revalidate: number } }];
    expect(url).toBe('https://public.api.hospitable.com/v2/properties/d37d9860-e7e2-4fa4-a582-633d918acddb/images');
    expect(init.next).toEqual({ revalidate: 3600 });
  });

  it('falls back to no photos (placeholders) when Hospitable fails or has no token', async () => {
    mockHospitable(500, { message: 'boom' });
    expect(await getPropertyPhotos(clover)).toEqual([]);
    delete process.env.HOSPITABLE_PAT;
    expect(await getPropertyPhotos(clover)).toEqual([]);
  });

  it('getCoverPhotos returns each property’s first photo by slug', async () => {
    mockHospitable(200, imagesFixture);
    const covers = await getCoverPhotos([clover]);
    expect(covers['property-2']?.id).toBe('YlgaGTY9XgwOf5jYfY2juH9m9UGfTXh6KwB1dFbJ');
  });
});
