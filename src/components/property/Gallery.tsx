'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { PropertyImage } from '@/lib/booking/types';
import { cn } from '@/lib/util/cn';

/**
 * Editorial mosaic that opens into a lightbox.
 *
 * The first image is the page's LCP element, so it is eagerly loaded at high
 * priority while the rest stay lazy — the difference is worth several hundred
 * milliseconds on a photography-heavy page.
 */
export function Gallery({ images, title }: { images: PropertyImage[]; title: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const visible = images.slice(0, 5);

  const close = useCallback(() => setLightboxIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setLightboxIndex((current) =>
        current === null ? null : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    }
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [lightboxIndex, close, step]);

  if (visible.length === 0) {
    return <div className="aspect-[16/9] w-full rounded-[var(--radius-md)] bg-[var(--color-canvas-sunk)]" />;
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
        {visible.map((image, index) => (
          <button
            key={image.url}
            type="button"
            onClick={() => setLightboxIndex(index)}
            aria-label={`View photo ${index + 1} of ${images.length}`}
            className={cn(
              'group relative overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-canvas-sunk)]',
              index === 0
                ? 'aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto'
                : 'hidden aspect-[4/3] sm:block',
            )}
          >
            <Image
              src={image.url}
              alt={image.alt || `${title} — photo ${index + 1}`}
              fill
              priority={index === 0}
              sizes={index === 0 ? '(min-width: 640px) 50vw, 100vw' : '25vw'}
              className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {images.length > visible.length ? (
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="mt-3 text-[0.8125rem] text-[var(--color-ink-muted)] underline decoration-[var(--color-line-strong)] underline-offset-4 transition-colors hover:text-[var(--color-ink)] hover:decoration-[var(--color-accent)]"
        >
          View all {images.length} photographs
        </button>
      ) : null}

      {lightboxIndex !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photographs`}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/94 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close gallery"
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <LightboxArrow direction="previous" onClick={() => step(-1)} />
          <LightboxArrow direction="next" onClick={() => step(1)} />

          <figure
            className="relative max-h-[86vh] w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative aspect-[3/2] w-full">
              <Image
                src={images[lightboxIndex]!.url}
                alt={images[lightboxIndex]!.alt || `${title} — photo ${lightboxIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            <figcaption className="mt-4 text-center text-xs tabular text-white/60">
              {lightboxIndex + 1} / {images.length}
              {images[lightboxIndex]?.alt ? ` · ${images[lightboxIndex]!.alt}` : ''}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}

function LightboxArrow({
  direction,
  onClick,
}: {
  direction: 'previous' | 'next';
  onClick: () => void;
}) {
  const next = direction === 'next';
  return (
    <button
      type="button"
      aria-label={`${next ? 'Next' : 'Previous'} photo`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white',
        next ? 'right-4' : 'left-4',
      )}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d={next ? 'm7 3 7 7-7 7' : 'M13 3 6 10l7 7'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
