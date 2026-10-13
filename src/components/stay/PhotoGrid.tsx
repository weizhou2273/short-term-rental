'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Property } from '@/data/types';
import { HERO_GRID_COUNT as GRID_COUNT, photoTour, type PropertyPhoto } from '@/lib/photos';
import { Modal } from '@/components/ui/Modal';
import { Ph } from '@/components/ui/Ph';
import { useCarousel } from '@/components/ui/useCarousel';

const PLACEHOLDER_LABELS = ['Exterior', 'Living room', 'Kitchen', 'Bedroom', 'Bathroom'];
const UNASSIGNED = 'More photos';

/** Where the photo tour opens: the room list at the top, or a photo (by index). */
type OpenAt = 'top' | number;

/**
 * True when the previous history entry is on this site: the stay page was
 * reached by an in-site link (the page first loaded at another path), or the
 * full page load came from one of our pages.
 */
function cameFromThisSite(): boolean {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav && new URL(nav.name).pathname !== window.location.pathname) return true;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}


/**
 * Hero grid (one large photo + four small) and the photo tour, from the
 * property's ordered `photos`. On phones the same row of photos becomes an
 * Airbnb-style carousel: every photo, swiped one at a time, with a "1 / N"
 * counter; tapping one opens the tour there. The tour lists the rooms at the
 * top; picking one scrolls to that room's photos. With no rooms assigned it
 * is a plain gallery. With no photos at all, the grid shows placeholders.
 */
export function PhotoGrid({ property: p, photos }: { property: Property; photos: PropertyPhoto[] }) {
  const [openAt, setOpenAt] = useState<OpenAt | null>(null);
  // The phone carousel (the desktop grid doesn't scroll): arrows and the keyboard step it one photo at a time.
  const { ref: trackRef, index: current, onScroll, step } = useCarousel<HTMLElement>();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // Back: to the results the guest came from (scroll kept), else to search with this stay's dates.
  const goBack = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (cameFromThisSite() && window.history.length > 1) router.back();
    else router.push(`/search${window.location.search}`);
  };

  // The phone's share sheet where there is one; otherwise copy the link.
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      // Dismissing the share sheet rejects; nothing to do.
      await navigator.share({ title: p.name, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  };
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
      <div className="pg-wrap">
        <section
          ref={trackRef}
          className={`photo-grid${shown < GRID_COUNT ? ` count-${shown}` : ''}`}
          aria-label="Photos"
          onScroll={onScroll}
          onKeyDown={(e) => {
            // Only the phone-layout carousel scrolls sideways; on the desktop grid this is a no-op.
            if (e.key === 'ArrowRight') step(1);
            else if (e.key === 'ArrowLeft') step(-1);
          }}
        >
          {/* All photos are here for the phone carousel; the desktop grid hides the extras (never fetched there). */}
          {photos.map((photo, i) => (
            <button
              key={photo.src}
              type="button"
              className={`pg-item${i >= shown ? ' pg-extra' : ''}`}
              onClick={() => setOpenAt(i)}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes={i === 0 ? '(max-width: 760px) 100vw, 600px' : '(max-width: 760px) 100vw, 300px'}
                // The large photo is the page's main image: fetch it first.
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
              />
            </button>
          ))}
        </section>
        <button className="btn show-all" onClick={() => setOpenAt('top')}>
          Show all {photos.length} photos
        </button>
        {photos.length > 1 ? (
          <>
            <span className="pg-count" aria-hidden="true">
              {current + 1} / {photos.length}
            </span>
            {/* Phone layout with a mouse or trackpad (no swiping): previous / next arrows. */}
            {current > 0 ? (
              <button type="button" className="pg-arrow pg-prev" onClick={() => step(-1)} aria-label="Previous photo">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 2.5 4.5 8l5.5 5.5" />
                </svg>
              </button>
            ) : null}
            {current < photos.length - 1 ? (
              <button type="button" className="pg-arrow pg-next" onClick={() => step(1)} aria-label="Next photo">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 2.5 11.5 8 6 13.5" />
                </svg>
              </button>
            ) : null}
          </>
        ) : null}
        {/* Phones: back and share float on the photos, as on Airbnb. */}
        <div className="pg-actions">
          <a className="pg-action" href="/search" onClick={goBack} aria-label="Back to all stays">
            {/* An arrow with a tail, so it doesn't read as the carousel's "previous photo" chevron. */}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M14 8H2.5M7 3 2 8l5 5" />
            </svg>
          </a>
          <button type="button" className="pg-action" onClick={share} aria-label={`Share ${p.name}`}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 10V1.5M4.75 4.75 8 1.5l3.25 3.25M3 7.5v6.5h10V7.5" />
            </svg>
          </button>
        </div>
        <span className="pg-toast" role="status">
          {copied ? 'Link copied' : ''}
        </span>
      </div>
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
