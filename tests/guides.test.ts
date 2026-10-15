import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDES, getGuide, guideHomes } from '@/data/guides';
import { PROPERTIES } from '@/data/properties';

const built = GUIDES.filter((g) => guideHomes(g, PROPERTIES).length > 0);

describe('Poconos guides', () => {
  it('have unique, URL-safe slugs and unique titles', () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(GUIDES.map((g) => g.title)).size).toBe(GUIDES.length);
    expect(new Set(GUIDES.map((g) => g.metaTitle)).size).toBe(GUIDES.length);
  });

  it('builds a page for every attraction, group, amenity and town guide', () => {
    expect(built.map((g) => g.slug)).toEqual(GUIDES.map((g) => g.slug));
    expect(built.length).toBeGreaterThanOrEqual(15);
  });

  it('says why each listed home fits, in its own words', () => {
    for (const g of built) {
      for (const p of guideHomes(g, PROPERTIES)) {
        expect(g.note(p), `${g.slug} / ${p.slug}`).toBeTruthy();
      }
    }
  });

  it('only lists homes that really match', () => {
    expect(guideHomes(getGuide('large-group-rentals')!, PROPERTIES).every((p) => p.guests >= 16)).toBe(true);
    expect(guideHomes(getGuide('rentals-on-a-private-pond')!, PROPERTIES).map((p) => p.slug).sort()).toEqual(['minsi-pond', 'shawnee-estate']);
    expect(guideHomes(getGuide('near-camelback-mountain')!, PROPERTIES).every((p) => p.nearby.includes('camelback'))).toBe(true);
    expect(guideHomes(getGuide('east-stroudsburg-pa-vacation-rentals')!, PROPERTIES).every((p) => p.area === 'East Stroudsburg')).toBe(true);
  });

  it('writes descriptions and intros from the matching homes', () => {
    const g = getGuide('large-group-rentals')!;
    const homes = guideHomes(g, PROPERTIES);
    const max = Math.max(...homes.map((p) => p.guests));
    expect(g.description(homes)).toContain(String(max));
    expect(g.intro(homes).join(' ')).toContain(`${homes.length} homes`);
  });

  it('is linked from the home page and footer only to guides that exist', () => {
    const source = ['src/components/home/PropertyGrid.tsx', 'src/components/layout/Footer.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n');
    const linked = [...source.matchAll(/\/poconos\/([a-z0-9-]+)/g), ...source.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)',\n/g)].map((m) => m[1]!);
    expect(linked.length).toBeGreaterThan(5);
    for (const slug of linked) expect(getGuide(slug), slug).toBeDefined();
  });
});
