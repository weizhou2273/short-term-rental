import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { PropertyGrid } from '@/components/home/PropertyGrid';

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="main">
        {/* Outside the container so it spans the full width */}
        <Hero />
        <div className="container">
          <PropertyGrid />
        </div>
      </main>
      <Footer />
    </>
  );
}
