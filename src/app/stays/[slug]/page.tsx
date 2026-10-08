import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPropertyBySlug, PROPERTIES } from '@/data/properties';
import { coverPhoto, propertyPhotos } from '@/lib/photos';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PhotoGrid } from '@/components/stay/PhotoGrid';
import { Amenities } from '@/components/stay/Amenities';
import { BookingPanel } from '@/components/stay/BookingPanel';
import {
  Description,
  FAQ,
  HouseRules,
  LocationMap,
  PropertyHeader,
  Reviews,
  SleepingArrangements,
  Summary,
} from '@/components/stay/sections';

// Every stay is prerendered; unknown slugs 404 instead of rendering on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return PROPERTIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const property = getPropertyBySlug((await params).slug);
  if (!property) return {};
  const cover = coverPhoto(property);
  return {
    title: property.name,
    description: `${property.tagline}. ${property.type} in ${property.area} for up to ${property.guests} guests. Book direct.`,
    // Link previews (iMessage, WhatsApp, social) show the property's cover photo.
    ...(cover ? { openGraph: { images: [{ url: cover.src, alt: cover.alt }] } } : {}),
  };
}

export default async function StayPage({ params }: { params: Promise<{ slug: string }> }) {
  const property = getPropertyBySlug((await params).slug);
  if (!property) notFound();
  const photos = propertyPhotos(property);

  return (
    <>
      <Header showMiniSearch />
      <main id="main" className="container">
        <PropertyHeader property={property} />
        <PhotoGrid property={property} photos={photos} />
        <div className="p-body">
          <div className="p-content">
            <Summary property={property} />
            <Description property={property} />
            <SleepingArrangements property={property} photos={photos} />
            <Amenities property={property} />
            <LocationMap property={property} />
            <HouseRules property={property} />
            <Reviews property={property} />
            <FAQ property={property} />
          </div>
          <BookingPanel property={property} />
        </div>
      </main>
      <Footer />
    </>
  );
}
