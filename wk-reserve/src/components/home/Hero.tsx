import { SITE } from '@/data/site';
import { SearchBar } from '@/components/search/SearchBar';
import { HeroVideo } from './HeroVideo';

export function Hero() {
  return (
    <section className="hero">
      <HeroVideo />
      <div className="hero-content">
        <span className="eyebrow">W&amp;K Reserve · Poconos, PA</span>
        <h1>{SITE.tagline}</h1>
        <p className="hero-sub">{SITE.subline}</p>
        <SearchBar />
      </div>
    </section>
  );
}
