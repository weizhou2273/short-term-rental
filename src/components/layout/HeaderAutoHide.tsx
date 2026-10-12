'use client';

import { useEffect, useRef } from 'react';

/** Phones only (matches the CSS), where the header is worth the room it takes. */
const PHONE = '(max-width: 760px)';
/** Pixels of scrolling in one direction before the header reacts, so jitter doesn't flicker it. */
const THRESHOLD = 8;
/** Near the top of the page the header always shows. */
const TOP = 80;

/**
 * Slides the sticky header away while the visitor scrolls down and brings it
 * back as soon as they scroll up, as on Airbnb's mobile site. Renders nothing
 * visible; it toggles `is-hidden` on the header it sits in. Keyboard focus
 * inside the header always shows it.
 */
export function HeaderAutoHide() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = ref.current?.closest('header');
    if (!header) return;
    const phone = window.matchMedia(PHONE);
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (!phone.matches || y < TOP || header.contains(document.activeElement)) {
        header.classList.remove('is-hidden');
        lastY = y;
      } else if (y > lastY + THRESHOLD) {
        header.classList.add('is-hidden');
        lastY = y;
      } else if (y < lastY - THRESHOLD) {
        header.classList.remove('is-hidden');
        lastY = y;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const show = () => header.classList.remove('is-hidden');

    window.addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', show);
    return () => {
      window.removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', show);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <span ref={ref} hidden />;
}
