import { PROPERTIES } from '@/data/properties';
import type { SuggestedStay } from '@/lib/booking/types';
import { PropertyCard } from '@/components/property/PropertyCard';

export function PropertyGrid({ suggested = {} }: { suggested?: Record<string, SuggestedStay> }) {
  const priced = Object.keys(suggested).length > 0;
  return (
    <section className="section">
      <span className="eyebrow">The collection</span>
      <h2 style={{ marginBottom: priced ? 8 : 24 }}>Our estates</h2>
      {priced ? <p className="muted grid-note">Prices are for the dates shown and include all fees, before taxes.</p> : null}
      <div className="grid-cards">
        {PROPERTIES.map((p) => (
          <PropertyCard key={p.id} property={p} suggested={suggested[p.slug]} />
        ))}
      </div>
    </section>
  );
}
