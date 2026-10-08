import { PROPERTIES } from '@/data/properties';
import { PropertyCard } from '@/components/property/PropertyCard';

export function PropertyGrid() {
  return (
    <section className="section">
      <span className="eyebrow">The collection</span>
      <h2 style={{ marginBottom: 24 }}>Our estates</h2>
      <div className="grid-cards">
        {PROPERTIES.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </section>
  );
}
