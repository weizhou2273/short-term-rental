import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { PropertyGrid } from '@/components/home/PropertyGrid';
import { PROPERTIES } from '@/data/properties';
import { getSuggestedStays } from '@/lib/hospitable/suggested';
import { siteJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';

// Card prices follow each property's next open stay, so the page is rebuilt in
// the background: at least hourly, and as often as every minute or two because
// the calendar and search fetches behind the prices are cached that long.
export const revalidate = 3600;

// Title and description come from the root layout's defaults.
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const suggested = await getSuggestedStays(PROPERTIES);
  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <Header />
      <main id="main">
        {/* Outside the container so it spans the full width */}
        <Hero />
        <div className="container">
          <PropertyGrid suggested={suggested} />
        </div>
      </main>
      <Footer />
    </>
  );
}
