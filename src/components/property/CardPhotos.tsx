'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { PropertyPhoto } from '@/lib/photos';
import { useCarousel } from '@/components/ui/useCarousel';

/**
 * A result card's photos, Airbnb style: swipe on touch screens, ‹ › arrows
 * on hover with a mouse or trackpad, and a dot per photo. Every slide links
 * to the stay; the arrows are buttons beside the links (never inside one), so
 * stepping through photos doesn't open the stay. Only the first photo loads
 * up front; the rest load as they come near.
 */
export function CardPhotos({ photos, href, name, sizes }: { photos: PropertyPhoto[]; href: string; name: string; sizes: string }) {
  const { ref, index, onScroll, step } = useCarousel<HTMLDivElement>();
  return (
    <div className="card-photos">
      <div ref={ref} className="card-track" onScroll={onScroll}>
        {photos.map((photo) => (
          // The card's title link names the stay; these are extra click targets, out of the tab order.
          <Link key={photo.src} className="card-slide" href={href} tabIndex={-1} aria-hidden="true">
            <Image src={photo.src} alt="" fill sizes={sizes} />
          </Link>
        ))}
      </div>
      {photos.length > 1 ? (
        <>
          {index > 0 ? (
            <button type="button" className="card-arrow card-prev" onClick={() => step(-1)} aria-label={`Previous photo of ${name}`}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 2.5 4.5 8l5.5 5.5" />
              </svg>
            </button>
          ) : null}
          {index < photos.length - 1 ? (
            <button type="button" className="card-arrow card-next" onClick={() => step(1)} aria-label={`Next photo of ${name}`}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 2.5 11.5 8 6 13.5" />
              </svg>
            </button>
          ) : null}
          <span className="card-dots" aria-hidden="true">
            {photos.map((photo, i) => (
              <span key={photo.src} className={`card-dot${i === index ? ' on' : ''}`} />
            ))}
          </span>
        </>
      ) : null}
    </div>
  );
}
