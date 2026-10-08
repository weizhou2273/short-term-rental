'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { Property } from '@/data/types';
import type { PropertyPhoto } from '@/lib/photos';
import { Modal } from '@/components/ui/Modal';
import { Ph } from '@/components/ui/Ph';

const GRID_COUNT = 5;

/**
 * Hero grid (one large photo + four small) and the full gallery. Photos come
 * from Hospitable; with none available it falls back to labelled placeholders.
 */
export function PhotoGrid({ property: p, photos }: { property: Property; photos: PropertyPhoto[] }) {
  // null = closed; otherwise the photo to scroll to when the gallery opens.
  const [openAt, setOpenAt] = useState<number | null>(null);

  useEffect(() => {
    if (openAt === null) return;
    const frame = requestAnimationFrame(() => document.getElementById(`gallery-photo-${openAt}`)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [openAt]);

  if (!photos.length) {
    return (
      <>
        <section className="photo-grid" aria-label="Photos">
          {p.photos.slice(0, GRID_COUNT).map((label) => (
            <Ph key={label} label={label} />
          ))}
          <button className="btn show-all" onClick={() => setOpenAt(0)}>
            Show all {p.photos.length} photos
          </button>
        </section>
        <Modal title={`${p.name} · all photos`} open={openAt !== null} onClose={() => setOpenAt(null)}>
          <div className="gallery">
            {p.photos.map((label) => (
              <Ph key={label} label={label} />
            ))}
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <section className="photo-grid" aria-label="Photos">
        {photos.slice(0, GRID_COUNT).map((photo, i) => (
          <button key={photo.id} type="button" className="pg-item" onClick={() => setOpenAt(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes={i === 0 ? '(max-width: 760px) 100vw, 600px' : '300px'}
              // The large photo is the page's main image: fetch it first.
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
            />
          </button>
        ))}
        <button className="btn show-all" onClick={() => setOpenAt(0)}>
          Show all {photos.length} photos
        </button>
      </section>
      <Modal title={`${p.name} · all photos`} open={openAt !== null} onClose={() => setOpenAt(null)}>
        <div className="gallery">
          {photos.map((photo, i) => (
            <figure className="g-item" key={photo.id} id={`gallery-photo-${i}`}>
              <Image src={photo.src} alt={photo.alt} fill sizes={i % 3 === 0 ? '(max-width: 820px) 100vw, 780px' : '(max-width: 820px) 50vw, 390px'} />
            </figure>
          ))}
        </div>
      </Modal>
    </>
  );
}
