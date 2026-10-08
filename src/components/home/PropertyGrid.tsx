import { PROPERTIES } from '@/data/properties';
import type { PropertyPhoto } from '@/lib/photos';
import { PropertyCard } from '@/components/property/PropertyCard';

export function PropertyGrid({ covers }: { covers: Record<string, PropertyPhoto | null> }) {
  return (
    <section className="section">
      <span className="eyebrow">The collection</span>
      <h2 style={{ marginBottom: 24 }}>Our estates</h2>
      <div className="grid-cards">
        {PROPERTIES.map((p) => (
          <PropertyCard key={p.id} property={p} cover={covers[p.slug]} />
        ))}
      </div>
    </section>
  );
}
