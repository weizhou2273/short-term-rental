import { SITE } from '@/data/site';
import { SearchBar } from '@/components/search/SearchBar';
import { HeroVideo } from './HeroVideo';

/**
 * Full-bleed hero: spans the whole window and sits directly under the header.
 * The text block stays aligned with the page's content column.
 */
export function Hero() {
  return (
    <section className="hero">
      <HeroVideo />
      <div className="container hero-inner">
        <div className="hero-content">
          <span className="eyebrow">W&amp;K Reserve · Poconos, PA</span>
          <h1>{SITE.tagline}</h1>
          <p className="hero-sub">{SITE.subline}</p>
          <SearchBar />
        </div>
      </div>
    </section>
  );
}
