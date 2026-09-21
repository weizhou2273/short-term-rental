import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getPropertyBySlug } from '@/lib/ownerrez/properties';
import { defaultAvailabilityWindow, getAvailability } from '@/lib/ownerrez/availability';
import { getQuote } from '@/lib/ownerrez/quotes';
import { guestCountSchema, validateStay } from '@/lib/booking/validation';
import { paymentsUnavailable } from '@/lib/payments';
import { pageMetadata } from '@/lib/config/metadata';
import { formatLongDate, isIsoDate, nightsBetween } from '@/lib/util/date';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Container } from '@/components/ui/Container';
import { Alert } from '@/components/ui/Alert';
import { QuoteSummary } from '@/components/booking/QuoteSummary';
import { CheckoutFlow } from '@/components/booking/CheckoutFlow';
import { guestSummary } from '@/lib/booking/format';

/** Checkout is per-guest and must never be cached or indexed. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Complete your booking',
  description: 'Confirm your dates and details.',
  path: '/book',
  noIndex: true,
});

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function intOr(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const property = await getPropertyBySlug(slug);
  if (!property) notFound();

  const arrival = first(query.arrival);
  const departure = first(query.departure);

  // A checkout without valid dates is meaningless — send them back to pick some
  // rather than rendering a broken form.
  if (!arrival || !departure || !isIsoDate(arrival) || !isIsoDate(departure)) {
    redirect(`/properties/${property.slug}`);
  }

  const guestsParsed = guestCountSchema.safeParse({
    adults: intOr(first(query.adults), 2),
    children: intOr(first(query.children), 0),
    infants: intOr(first(query.infants), 0),
    pets: intOr(first(query.pets), 0),
  });
  const guests = guestsParsed.success
    ? guestsParsed.data
    : { adults: 2, children: 0, infants: 0, pets: 0 };

  const window = defaultAvailabilityWindow();
  const calendar = await getAvailability(property, window.from, window.to);
  const issues = validateStay({ property, arrival, departure, guests, calendar });

  const cover = property.images[0];
  const nights = nightsBetween(arrival, departure);

  if (issues.length > 0) {
    return (
      <>
        <SiteHeader />
        <div className="pt-[72px]">
          <Container size="narrow" className="py-24">
            <h1 className="display text-3xl">These dates will not work</h1>
            <Alert tone="warning" className="mt-8">
              <ul className="space-y-1">
                {issues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
            <Link
              href={`/properties/${property.slug}`}
              className="mt-8 inline-block text-sm text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
            >
              Choose different dates for {property.name}
            </Link>
          </Container>
        </div>
      </>
    );
  }

  const quote = await getQuote({ property, arrival, departure, guests });

  return (
    <>
      <SiteHeader />

      <div className="pt-[72px]">
        <Container size="default" className="py-14 sm:py-20">
          <Link
            href={`/properties/${property.slug}`}
            className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            ← Back to {property.name}
          </Link>

          <h1 className="display mt-6 text-[clamp(2rem,4vw,2.75rem)]">Confirm your stay</h1>

          {paymentsUnavailable() ? (
            <Alert tone="warning" className="mt-8" title="Payments are not yet connected">
              Your booking will be sent to us as a request and we will follow up with an
              invoice. Nothing is charged now.
            </Alert>
          ) : null}

          <div className="mt-12 grid gap-x-16 gap-y-12 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 lg:order-1">
              <CheckoutFlow
                property={property}
                arrival={arrival}
                departure={departure}
                guests={guests}
                quote={quote}
              />
            </div>

            <aside className="lg:order-2 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
                <div className="flex gap-4">
                  {cover ? (
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-canvas-sunk)]">
                      <Image
                        src={cover.url}
                        alt={cover.alt || property.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="display text-lg leading-tight text-[var(--color-ink)]">
                      {property.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                      {[property.location.locality, property.location.region]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>

                <dl className="rule mt-6 space-y-3 pt-6 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-ink-muted)]">Check in</dt>
                    <dd className="text-right text-[var(--color-ink)]">
                      {formatLongDate(arrival)}
                      <span className="block text-xs text-[var(--color-ink-faint)]">
                        from {property.rules.checkInTime}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-ink-muted)]">Check out</dt>
                    <dd className="text-right text-[var(--color-ink)]">
                      {formatLongDate(departure)}
                      <span className="block text-xs text-[var(--color-ink-faint)]">
                        by {property.rules.checkOutTime}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-ink-muted)]">Length</dt>
                    <dd className="text-[var(--color-ink)]">
                      {nights} {nights === 1 ? 'night' : 'nights'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-ink-muted)]">Guests</dt>
                    <dd className="text-[var(--color-ink)]">{guestSummary(guests)}</dd>
                  </div>
                </dl>

                <QuoteSummary quote={quote} className="rule mt-6 pt-6" />
              </div>
            </aside>
          </div>
        </Container>
      </div>
    </>
  );
}
