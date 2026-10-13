'use client';

import { useRef, useState } from 'react';

/**
 * A horizontal scroll-snap track of full-width slides, stepped one slide at a
 * time. Spread `onScroll` and `ref` onto the scrolling element; `index` is
 * the slide in view and `step` moves by one (arrows, keyboard).
 */
export function useCarousel<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [index, setIndex] = useState(0);

  const onScroll = (e: React.UIEvent<T>) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth));

  const step = (dir: 1 | -1) => {
    const track = ref.current;
    if (!track) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: dir * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return { ref, index, onScroll, step };
}
