'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Full-bleed background video, looping continuously. Muted + playsInline so
 * phones autoplay. A small pause/play button keeps endless motion optional
 * (WCAG 2.2.2), and visitors who ask for reduced motion get a still instead.
 */

const MEDIA = {
  video: '/media/hero.mp4',
  poster: '/media/hero-poster.jpg',
  still: '/media/hero-end.jpg',
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function HeroVideo() {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    // Some browsers (iOS Low Power Mode) refuse autoplay; the button then offers Play.
    videoRef.current?.play().catch(() => setPlaying(false));
  }, [reduced]);

  if (reduced) {
    // eslint-disable-next-line @next/next/no-img-element -- full-bleed decorative still, sized by CSS
    return <img className="hero-media" src={MEDIA.still} alt="" />;
  }

  return (
    <>
      <video
        ref={videoRef}
        className="hero-media"
        src={MEDIA.video}
        poster={MEDIA.poster}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className="hero-toggle"
        aria-label={playing ? 'Pause background video' : 'Play background video'}
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
    </>
  );
}
