import Link from 'next/link';
import { PROPERTIES } from '@/data/properties';
import type { SuggestedStay } from '@/lib/booking/types';
import { PropertyCard } from '@/components/property/PropertyCard';

export function PropertyGrid({ suggested = {} }: { suggested?: Record<string, SuggestedStay> }) {
  const priced = Object.keys(suggested).length > 0;
  const sleeps = PROPERTIES.map((p) => p.guests);
  return (
    <section className="section">
      <span className="eyebrow">The collection</span>
      <h2 style={{ marginBottom: 8 }}>Our estates</h2>
      {/* Plain words for guests and search engines: where the homes are, who they're for, why book here. */}
      <p className="grid-intro">
        Private vacation homes in the Poconos for groups of {Math.min(...sleeps)} to {Math.max(...sleeps)}: in{' '}
        <Link href="/poconos/long-pond-pa-vacation-rentals">Long Pond</Link>, minutes from{' '}
        <Link href="/poconos/near-camelback-mountain">Camelback Mountain</Link> and{' '}
        <Link href="/poconos/near-kalahari-resort">Kalahari</Link>, and in{' '}
        <Link href="/poconos/east-stroudsburg-pa-vacation-rentals">East Stroudsburg</Link>, near{' '}
        <Link href="/poconos/near-shawnee-mountain">Shawnee Mountain</Link> and the{' '}
        <Link href="/poconos/near-delaware-water-gap">Delaware Water Gap</Link>. Every home has a pool, hot tub, sauna and movie
        room. They&apos;re the same homes you&apos;ll find on Airbnb, booked here directly with no service fee.{' '}
        <Link href="/poconos">Explore all our Poconos guides</Link>.
      </p>
      {priced ? <p className="muted grid-note">Prices are for the dates shown and include all fees, before taxes.</p> : null}
      <div className="grid-cards">
        {PROPERTIES.map((p) => (
          <PropertyCard key={p.id} property={p} suggested={suggested[p.slug]} />
        ))}
      </div>
    </section>
  );
}
