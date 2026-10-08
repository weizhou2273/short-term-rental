'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { Property } from '@/data/types';
import { HERO_GRID_COUNT as GRID_COUNT, photoTour, type PropertyPhoto } from '@/lib/photos';
import { Modal } from '@/components/ui/Modal';
import { Ph } from '@/components/ui/Ph';

const PLACEHOLDER_LABELS = ['Exterior', 'Living room', 'Kitchen', 'Bedroom', 'Bathroom'];
const UNASSIGNED = 'More photos';

/** Where the photo tour opens: the room list at the top, or a photo (by index). */
type OpenAt = 'top' | number;

/**
 * Hero grid (one large photo + four small) and the photo tour, from the
 * property's ordered `photos`. The tour lists the rooms at the top; picking
 * one scrolls to that room's photos. With no rooms assigned it is a plain
 * gallery. With no photos at all, the grid shows placeholders.
 */
export function PhotoGrid({ property: p, photos }: { property: Property; photos: PropertyPhoto[] }) {
  const [openAt, setOpenAt] = useState<OpenAt | null>(null);
  const tour = useMemo(() => photoTour(photos), [photos]);
  const hasRooms = tour.some((r) => r.room !== null);

  useEffect(() => {
    if (typeof openAt !== 'number') return;
    const frame = requestAnimationFrame(() => document.getElementById(`tour-photo-${openAt}`)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [openAt]);

  if (!photos.length) {
    return (
      <section className="photo-grid" aria-label="Photos coming soon">
        {PLACEHOLDER_LABELS.map((label) => (
          <Ph key={label} label={label} />
        ))}
      </section>
    );
  }

  const goToRoom = (i: number) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`tour-room-${i}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    // Move keyboard and screen reader users to the room they picked.
    document.getElementById(`tour-room-${i}-title`)?.focus({ preventScroll: true });
  };

  // Full grid needs five photos; with fewer, use a layout with no empty cells.
  const shown = photos.length >= GRID_COUNT ? GRID_COUNT : photos.length >= 3 ? 3 : photos.length;

  return (
    <>
      <section className={`photo-grid${shown < GRID_COUNT ? ` count-${shown}` : ''}`} aria-label="Photos">
        {photos.slice(0, shown).map((photo, i) => (
          <button key={photo.src} type="button" className="pg-item" onClick={() => setOpenAt(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}>
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
        <button className="btn show-all" onClick={() => setOpenAt('top')}>
          Show all {photos.length} photos
        </button>
      </section>
      <Modal title={hasRooms ? 'Photo tour' : `${p.name} · all photos`} wide open={openAt !== null} onClose={() => setOpenAt(null)}>
        {hasRooms ? (
          <nav className="tour-index" aria-label="Rooms">
            {tour.map((r, i) => (
              <button key={r.room ?? UNASSIGNED} type="button" className="tour-index-item" onClick={() => goToRoom(i)}>
                <span className="tour-thumb">
                  {/* Named by the label below, so the thumbnail is decorative. */}
                  <Image src={r.photos[0]!.photo.src} alt="" fill sizes="(max-width: 760px) 33vw, 220px" />
                </span>
                {r.room ?? UNASSIGNED}
              </button>
            ))}
          </nav>
        ) : null}
        {tour.map((r, i) => (
          <section
            key={r.room ?? UNASSIGNED}
            id={`tour-room-${i}`}
            className={`tour-room${hasRooms ? ' titled' : ''}`}
            aria-labelledby={hasRooms ? `tour-room-${i}-title` : undefined}
          >
            {hasRooms ? (
              <h3 id={`tour-room-${i}-title`} tabIndex={-1}>
                {r.room ?? UNASSIGNED}
              </h3>
            ) : null}
            <div className="tour-photos">
              {r.photos.map(({ photo, index }, j) => {
                // One wide photo, then two side by side; a photo left alone in a row goes wide too.
                const wide = j % 3 === 0 || (j % 3 === 1 && j === r.photos.length - 1);
                return (
                  <figure key={photo.src} id={`tour-photo-${index}`} className={`tour-photo${wide ? ' wide' : ''}`}>
                    <Image src={photo.src} alt={photo.alt} fill sizes={wide ? '(max-width: 760px) 100vw, 920px' : '(max-width: 760px) 50vw, 460px'} />
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </Modal>
    </>
  );
}
