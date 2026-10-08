'use client';

import { useState } from 'react';
import type { Property } from '@/data/types';
import { Modal } from '@/components/ui/Modal';

const SHOWN = 10;

function AmenityList({ items }: { items: string[] }) {
  return (
    <div className="amenities">
      {items.map((a) => (
        <div className="amenity" key={a}>
          <svg className="amenity-check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12.5l4 4L18 8" />
          </svg>
          {a}
        </div>
      ))}
    </div>
  );
}

export function Amenities({ property: p }: { property: Property }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="section">
      <h2>What this place offers</h2>
      <AmenityList items={p.amenities.slice(0, SHOWN)} />
      {p.amenities.length > SHOWN ? (
        <button className="btn" onClick={() => setOpen(true)}>
          Show all {p.amenities.length} amenities
        </button>
      ) : null}
      <Modal title="What this place offers" open={open} onClose={() => setOpen(false)}>
        <AmenityList items={p.amenities} />
      </Modal>
    </section>
  );
}
