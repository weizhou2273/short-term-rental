import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProperties, getPropertyBySlug } from '@/lib/ownerrez/properties';
import { defaultAvailabilityWindow, getAvailability } from '@/lib/ownerrez/availability';
import { getPropertyContent } from '@/lib/wordpress/content';
import { pageMetadata } from '@/lib/config/metadata';
import { htmlToText, truncateText } from '@/lib/wordpress/sanitize';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Container } from '@/components/ui/Container';
import { Gallery } from '@/components/property/Gallery';
import { Amenities } from '@/components/property/Amenities';
import { HouseRules, PropertyFacts } from '@/components/property/PropertyFacts';
import { BookingWidget } from '@/components/booking/BookingWidget';
import { MobileBookingBar } from '@/components/booking/MobileBookingBar';
import { PropertyCard } from '@/components/property/PropertyCard';
import { BreadcrumbJsonLd, PropertyJsonLd } from '@/components/seo/JsonLd';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

/** Pre-render every property at build time; there are few and they change rarely. */
export async function generateStaticParams() {
  const properties = await getProperties();
  return properties.map((property) => ({ slug: property.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) return pageMetadata({ title: 'Not found', description: '', path: `/properties/${slug}`, noIndex: true });

  const content = (await getPropertyContent()).get(property.id);
  const description =
    content?.seoDescription ??
    truncateText(htmlToText(property.summary || property.description), 160);

  return pageMetadata({
    title: content?.seoTitle ?? `${property.name}, ${property.location.locality}`,
    description,
    path: `/properties/${property.slug}`,
    image: property.images[0]?.url ?? null,
  });
}

export default async function PropertyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) notFound();

  const window = defaultAvailabilityWindow();
  const [calendar, cms, allProperties] = await Promise.all([
    getAvailability(property, window.from, window.to),
    getPropertyContent(),
    getProperties(),
  ]);

  const content = cms.get(property.id);
  const others = allProperties.filter((item) => item.id !== property.id).slice(0, 2);
  const place = [property.location.locality, property.location.region].filter(Boolean).join(', ');

  return (
    <>
      <SiteHeader />
      <PropertyJsonLd property={property} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Homes', path: '/properties' },
          { name: property.name, path: `/properties/${property.slug}` },
        ]}
      />

      <div className="pt-[72px]">
        <Container size="wide" className="pt-12 sm:pt-16">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              {place ? <p className="eyebrow mb-3">{place}</p> : null}
              <h1 className="display text-[clamp(2rem,4.5vw,3.25rem)]">
                {content?.headline ?? property.headline}
              </h1>
            </div>
          </div>

          <Gallery images={property.images} title={property.name} />
        </Container>

        <Container size="wide" className="py-14 sm:py-20">
          <div className="grid gap-x-16 gap-y-14 lg:grid-cols-[1fr_380px]">
            <div className="min-w-0">
              <PropertyFacts property={property} />

              {content?.highlights && content.highlights.length > 0 ? (
                <ul className="mt-12 grid gap-3 sm:grid-cols-2">
                  {content.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex items-start gap-3 text-sm leading-relaxed text-[var(--color-ink-muted)]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="rule mt-12 pt-12">
                <div
                  className="prose-editorial"
                  dangerouslySetInnerHTML={{
                    __html: content?.body ?? property.description,
                  }}
                />
              </div>

              {property.amenities.length > 0 ? (
                <div className="rule mt-12 pt-12">
                  <h2 className="display mb-8 text-2xl">What the house has</h2>
                  <Amenities amenities={property.amenities} />
                </div>
              ) : null}

              {content?.neighbourhood ? (
                <div className="rule mt-12 pt-12">
                  <h2 className="display mb-6 text-2xl">The area</h2>
                  <div
                    className="prose-editorial"
                    dangerouslySetInnerHTML={{ __html: content.neighbourhood }}
                  />
                </div>
              ) : null}

              <div className="rule mt-12 pt-12">
                <h2 className="display mb-6 text-2xl">House rules</h2>
                <HouseRules property={property} />
                <p className="mt-6 text-xs leading-relaxed text-[var(--color-ink-faint)]">
                  The exact address is sent once a stay is confirmed. Full terms, including
                  the cancellation schedule, are on the{' '}
                  <Link
                    href="/terms"
                    className="underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                  >
                    rental terms
                  </Link>{' '}
                  page.
                </p>
              </div>
            </div>

            {/* The panel tracks the reader down a long page — the single most
                effective conversion device on a property page. */}
            <aside id="booking-panel" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
              {/* The widget reads dates from the URL, so it suspends while the
                  page itself stays prerendered. */}
              <Suspense
                fallback={
                  <div className="h-[28rem] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-canvas-sunk)]" />
                }
              >
                <BookingWidget property={property} nights={calendar.nights} />
              </Suspense>
            </aside>
          </div>
        </Container>

        {others.length > 0 ? (
          <section className="border-t border-[var(--color-line)] py-20">
            <Container size="wide">
              <h2 className="display mb-12 text-2xl">The other houses</h2>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
                {others.map((item) => (
                  <PropertyCard key={item.id} property={item} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        <MobileBookingBar
          rate={property.baseNightlyRate}
          minNights={property.rules.minNights}
          targetId="booking-panel"
        />
        {/* Clears the fixed bar so the footer is never trapped beneath it. */}
        <div aria-hidden="true" className="h-20 lg:hidden" />
      </div>
    </>
  );
}
