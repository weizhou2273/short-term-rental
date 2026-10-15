import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { GUIDES, guideHomes } from '@/data/guides';
import { ALL_PROPERTY_ENTRIES, getPropertyBySlug, PROPERTIES } from '@/data/properties';
import { jsonLdScript, siteJsonLd, stayJsonLd } from '@/lib/seo';

describe('sitemap.xml', () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it('lists the home page, search, every listed stay and every built guide at the live domain', () => {
    expect(urls[0]).toBe('https://wkreserve.com/');
    expect(urls).toContain('https://wkreserve.com/search');
    expect(urls).toContain('https://wkreserve.com/poconos');
    for (const p of PROPERTIES) expect(urls).toContain(`https://wkreserve.com/stays/${p.slug}`);
    const built = GUIDES.filter((g) => guideHomes(g, PROPERTIES).length > 0);
    for (const g of built) expect(urls).toContain(`https://wkreserve.com/poconos/${g.slug}`);
    expect(urls).toHaveLength(PROPERTIES.length + built.length + 3);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('leaves hidden stays out', () => {
    const hidden = ALL_PROPERTY_ENTRIES.filter((p) => p.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    for (const p of hidden) expect(urls.some((u) => u.includes(p.slug))).toBe(false);
  });

  it('gives each stay its lead photos as absolute image URLs', () => {
    const stay = entries.find((e) => e.url.endsWith('/stays/minsi-pond'))!;
    expect(stay.images?.length).toBeGreaterThan(0);
    expect(stay.images!.every((src) => src.startsWith('https://wkreserve.com/photos/minsi-pond/'))).toBe(true);
  });
});

describe('robots.txt', () => {
  it('opens the site, keeps crawlers out of the booking API and points to the sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: '/api/' },
      sitemap: 'https://wkreserve.com/sitemap.xml',
    });
  });
});

describe('structured data', () => {
  it('names the brand the ways people type it', () => {
    const [website] = siteJsonLd()['@graph'];
    expect(website).toMatchObject({ '@type': 'WebSite', name: 'W&K Reserve', url: 'https://wkreserve.com/' });
    expect(website!.alternateName).toContain('WK Reserve');
  });

  it('describes a stay with the facts and rating the page shows, but only its town', () => {
    const p = getPropertyBySlug('the-ridge')!;
    const data = stayJsonLd(p);
    expect(data).toMatchObject({
      '@type': 'LodgingBusiness',
      name: 'The Ridge',
      url: 'https://wkreserve.com/stays/the-ridge',
      address: { addressLocality: p.area, addressRegion: 'PA', addressCountry: 'US' },
      aggregateRating: { ratingValue: p.rating, reviewCount: p.reviewCount },
      containsPlace: { occupancy: { maxValue: p.guests }, numberOfBedrooms: p.bedrooms },
    });
    expect(data.address).not.toHaveProperty('streetAddress');
    expect(data).not.toHaveProperty('geo');
  });

  it('cannot break out of its script tag', () => {
    expect(jsonLdScript({ name: '</script><script>alert(1)</script>' })).not.toContain('<');
  });
});
