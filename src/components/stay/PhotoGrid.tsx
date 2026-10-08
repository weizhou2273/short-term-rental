'use client';

import { useState } from 'react';
import type { Property } from '@/data/types';
import { Modal } from '@/components/ui/Modal';
import { Ph } from '@/components/ui/Ph';

export function PhotoGrid({ property: p }: { property: Property }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="photo-grid" aria-label="Photos">
        {p.photos.slice(0, 5).map((ph) => (
          <Ph key={ph} label={ph} />
        ))}
        <button className="btn show-all" onClick={() => setOpen(true)}>
          Show all {p.photos.length} photos
        </button>
      </section>
      <Modal title={`${p.name} · all photos`} open={open} onClose={() => setOpen(false)}>
        <div className="gallery">
          {p.photos.map((ph) => (
            <Ph key={ph} label={ph} />
          ))}
        </div>
      </Modal>
    </>
  );
}
