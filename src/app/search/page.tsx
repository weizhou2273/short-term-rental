import type { Metadata } from 'next';
import { SITE } from '@/data/site';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SearchBar } from '@/components/search/SearchBar';
import { AmenityFilters } from '@/components/search/AmenityFilters';
import { SearchResults } from '@/components/search/SearchResults';
import { plural } from '@/lib/format';
import { attractionById, filterProperties, parseSearchState } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Search stays',
  description: 'Find a private estate in the Poconos and book direct.',
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = parseSearchState(await searchParams);
  const place = attractionById(state.where);
  const results = filterProperties(state);

  return (
    <>
      <Header />
      <main id="main" className="container">
        <div style={{ paddingTop: 16 }}>
          {/* key remounts the form when the URL changes so its fields match the query */}
          <SearchBar key={JSON.stringify(state)} initial={state} />
        </div>
        <SearchResults
          slugs={results.map((p) => p.slug)}
          state={state}
          nearName={place?.name}
          heading={
            <h1 style={{ fontSize: 28 }}>
              {plural(results.length, 'estate')} {place ? `near ${place.name}` : 'in the Poconos'}
            </h1>
          }
          filters={<AmenityFilters state={state} />}
          everyEstate={SITE.everyEstate.join(' · ')}
        />
      </main>
      <Footer />
    </>
  );
}
