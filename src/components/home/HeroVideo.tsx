'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Plays once (day → night) and holds on the night frame. Muted + playsInline
 * so phones autoplay. Reduced-motion users get the night still instead.
 */

const MEDIA = {
  video: '/media/hero.mp4',
  poster: '/media/hero-poster.jpg',
  end: '/media/hero-end.jpg',
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
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, [reduced]);

  if (reduced) {
    // eslint-disable-next-line @next/next/no-img-element -- full-bleed decorative still, sized by CSS
    return <img className="hero-media" src={MEDIA.end} alt="" />;
  }

  return (
    <>
      <video
        ref={videoRef}
        className="hero-media"
        src={MEDIA.video}
        poster={MEDIA.poster}
        muted
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
        onEnded={() => setEnded(true)}
      />
      <button
        className="hero-replay"
        hidden={!ended}
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          setEnded(false);
          v.currentTime = 0;
          v.play().catch(() => {});
        }}
      >
        ↻ Replay
      </button>
    </>
  );
}
