import { describe, expect, it } from 'vitest';
import { PROPERTIES } from '@/data/properties';
import { REVIEW_HISTORY } from '@/data/reviews';
import { SYSTEM_TEXT } from '@/lib/chat/prompt';

const MONTH = /^(January|February|March|April|May|June|July|August|September|October|November|December) (20\d\d)$/;
const monthIndex = (d: string) => {
  const [, m, y] = d.match(MONTH)!;
  return Number(y) * 12 + 'January February March April May June July August September October November December'.split(' ').indexOf(m!);
};

const LISTS = Object.fromEntries(await Promise.all(Object.entries(REVIEW_HISTORY).map(async ([slug, h]) => [slug, await h.load()] as const)));

describe('review history', () => {
  it('has a list for every listed home', () => {
    for (const p of PROPERTIES) expect(REVIEW_HISTORY[p.slug], p.slug).toBeDefined();
  });

  for (const [slug, h] of Object.entries(REVIEW_HISTORY)) {
    describe(slug, () => {
      const reviews = LISTS[slug]!;
      const home = PROPERTIES.find((p) => p.slug === slug)!;

      it('shows only 4- and 5-star reviews, with the counts the page states', () => {
        expect(reviews).toHaveLength(h.shown);
        expect(reviews.every((r) => r.rating === 4 || r.rating === 5)).toBe(true);
        expect(reviews.filter((r) => r.rating === 4)).toHaveLength(h.fourStar);
        expect(reviews.at(-1)!.date).toBe(h.since);
      });

      it('gives the home’s rating and count from all its reviews, not just the ones shown', () => {
        expect(home.reviewCount).toBe(h.allReviews);
        expect(home.rating).toBe(Math.round(h.average * 100) / 100);
        expect(h.shown).toBeLessThanOrEqual(h.allReviews);
      });

      it('lists real text, newest first, with first names only', () => {
        const texts = new Set<string>();
        let previous = Infinity;
        for (const r of reviews) {
          expect(r.text.trim().length, r.text).toBeGreaterThanOrEqual(40);
          expect(r.text).toBe(r.text.trim());
          expect(texts.has(r.text), r.text).toBe(false);
          texts.add(r.text);
          // One given name (or two joined by "&"), no surname.
          expect(r.name, r.name).toMatch(/^[\p{L}][\p{L}\p{M}'’.-]*( & [\p{L}][\p{L}\p{M}'’.-]*)?$/u);
          expect(r.date).toMatch(MONTH);
          expect(monthIndex(r.date)).toBeLessThanOrEqual(previous);
          previous = monthIndex(r.date);
        }
      });

      it('keeps contact details out', () => {
        for (const r of reviews) {
          expect(r.text).not.toMatch(/https?:\/\/|www\.|[\w.+-]+@[\w-]+\.\w|\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/);
        }
      });

      it('is not in the chat assistant’s knowledge', () => {
        for (const r of reviews.slice(0, 20)) expect(SYSTEM_TEXT).not.toContain(r.text.slice(0, 60));
      });
    });
  }
});
