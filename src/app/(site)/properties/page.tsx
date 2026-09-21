import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getProperties } from '@/lib/ownerrez/properties';
import { pageMetadata } from '@/lib/config/metadata';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Container } from '@/components/ui/Container';
import { PropertyFilters } from '@/components/property/PropertyFilters';

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: 'The homes',
  description:
    'Three design-led houses in the Hudson Valley and the Berkshires, available to book direct without platform fees.',
  path: '/properties',
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const properties = await getProperties();

  // Filters are URL state, not component state: a filtered view stays
  // shareable, bookmarkable and indexable.
  const guests = Number.parseInt(first(params.guests) ?? '', 10);
  const petsOnly = first(params.pets) === '1';
  const bedrooms = Number.parseInt(first(params.bedrooms) ?? '', 10);

  const filtered = properties.filter((property) => {
    if (Number.isFinite(guests) && property.capacity.maxGuests < guests) return false;
    if (Number.isFinite(bedrooms) && property.capacity.bedrooms < bedrooms) return false;
    if (petsOnly && !property.rules.petsAllowed) return false;
    return true;
  });

  const maxCapacity = Math.max(...properties.map((p) => p.capacity.maxGuests), 2);

  return (
    <>
      <SiteHeader />

      <div className="pt-[72px]">
        <Container size="wide" className="py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">The portfolio</p>
            <h1 className="display text-[clamp(2.25rem,5vw,3.5rem)]">
              Three houses, each one different on purpose
            </h1>
            <p className="mt-6 text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
              A glass house on two hundred acres, a rebuilt fieldstone farmhouse with a lap
              pool, and a cabin on a ridge with no neighbours at all.
            </p>
          </div>

          <div className="mt-12">
            <Suspense
              fallback={<div className="h-9 w-full max-w-lg animate-pulse rounded bg-[var(--color-canvas-sunk)]" />}
            >
              <PropertyFilters maxGuests={maxCapacity} />
            </Suspense>
          </div>

          <p className="mt-8 text-sm text-[var(--color-ink-faint)]" aria-live="polite">
            {filtered.length} of {properties.length} {properties.length === 1 ? 'home' : 'homes'}
            {Number.isFinite(guests) ? ` sleeping ${guests} or more` : ''}
            {petsOnly ? ', dog friendly' : ''}
          </p>

          {filtered.length === 0 ? (
            <div className="mt-16 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] px-8 py-20 text-center">
              <p className="display text-2xl text-[var(--color-ink)]">
                Nothing matches those filters
              </p>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--color-ink-muted)]">
                With a portfolio this small that happens. Loosen a filter, or tell us what
                you need and we will say whether we have it.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((property, index) => (
                <PropertyCard key={property.id} property={property} priority={index < 2} />
              ))}
            </div>
          )}
        </Container>
      </div>
    </>
  );
}
