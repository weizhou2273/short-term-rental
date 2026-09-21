'use client';

import { useEffect, useState } from 'react';
import type { Money } from '@/lib/util/money';
import { formatMoneyCompact } from '@/lib/util/money';
import { cn } from '@/lib/util/cn';

/**
 * Sticky booking bar for narrow screens.
 *
 * On desktop the booking panel tracks the reader down the page; on mobile it
 * sits below several screens of copy, which puts the primary call to action out
 * of reach exactly where most traffic is. This keeps it one tap away.
 *
 * It appears only after the guest has scrolled past the panel, so it never
 * competes with the panel itself.
 */
export function MobileBookingBar({
  rate,
  minNights,
  targetId,
}: {
  rate: Money | null;
  minNights: number;
  targetId: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    // Show the bar whenever the real panel is off screen.
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry?.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  function scrollToPanel() {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-canvas)]/95 backdrop-blur-md transition-transform duration-300 ease-[var(--ease-out-quint)] lg:hidden',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
      // Hidden from assistive tech while off screen — the panel it mirrors is
      // always in the document, so this would otherwise be a duplicate control.
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0">
          {rate ? (
            <p className="text-[var(--color-ink)]">
              <span className="text-lg font-medium tabular">{formatMoneyCompact(rate)}</span>
              <span className="ml-1 text-xs text-[var(--color-ink-muted)]">per night</span>
            </p>
          ) : (
            <p className="text-sm text-[var(--color-ink)]">Rates on request</p>
          )}
          <p className="text-[0.6875rem] text-[var(--color-ink-faint)]">
            {minNights}-night minimum · no fees
          </p>
        </div>

        <button
          type="button"
          onClick={scrollToPanel}
          tabIndex={visible ? 0 : -1}
          className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-[var(--color-canvas)] transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Check dates
        </button>
      </div>
    </div>
  );
}
