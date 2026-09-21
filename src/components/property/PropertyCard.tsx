import Image from 'next/image';
import Link from 'next/link';
import type { Property } from '@/lib/booking/types';
import { formatMoneyCompact } from '@/lib/util/money';
import { cn } from '@/lib/util/cn';

export function PropertyCard({
  property,
  priority = false,
  className,
}: {
  property: Property;
  /** Set on the first card above the fold so the LCP image is not lazy. */
  priority?: boolean;
  className?: string;
}) {
  const cover = property.images[0];
  const place = [property.location.locality, property.location.region]
    .filter(Boolean)
    .join(', ');

  return (
    <Link
      href={`/properties/${property.slug}`}
      className={cn('group block', className)}
      aria-label={`${property.name} in ${place}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-canvas-sunk)]">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt || property.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h3 className="display text-[1.3125rem] text-[var(--color-ink)]">{property.name}</h3>
        {property.baseNightlyRate ? (
          <p className="shrink-0 text-sm tabular text-[var(--color-ink-muted)]">
            {formatMoneyCompact(property.baseNightlyRate)}
            <span className="text-[var(--color-ink-faint)]">/night</span>
          </p>
        ) : null}
      </div>

      {place ? (
        <p className="mt-1 text-[0.8125rem] text-[var(--color-ink-faint)]">{place}</p>
      ) : null}

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        {property.summary}
      </p>

      <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
        {property.capacity.maxGuests} guests · {property.capacity.bedrooms}{' '}
        {property.capacity.bedrooms === 1 ? 'bedroom' : 'bedrooms'} ·{' '}
        {property.capacity.bathrooms} {property.capacity.bathrooms === 1 ? 'bath' : 'baths'}
      </p>
    </Link>
  );
}
