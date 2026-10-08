import { PROPERTIES } from '@/data/properties';
import { getCoverPhotos } from '@/lib/hospitable/images';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { PropertyGrid } from '@/components/home/PropertyGrid';
import { WhyBookDirect } from '@/components/home/WhyBookDirect';

// Rebuilt at most hourly so photo changes in Hospitable show up without a deploy.
export const revalidate = 3600;

export default async function HomePage() {
  const covers = await getCoverPhotos(PROPERTIES);
  return (
    <>
      <Header />
      <main id="main" className="container">
        <Hero />
        <PropertyGrid covers={covers} />
        <WhyBookDirect />
      </main>
      <Footer />
    </>
  );
}
