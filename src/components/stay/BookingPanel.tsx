'use client';

import { Suspense, useEffect, useState } from 'react';
import { SITE } from '@/data/site';
import type { Property } from '@/data/types';
import { plural } from '@/lib/format';
import { NativeBookingCard } from './NativeBookingCard';
import { WidgetSlot } from './WidgetSlot';

/**
 * Booking card on desktop; on mobile the same card becomes a bottom sheet
 * opened from the fixed Reserve bar, so there is only ever one booking UI
 * (and one widget instance) on the page.
 */
export function BookingPanel({ property: p }: { property: Property }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('has-bar');
    return () => document.body.classList.remove('has-bar');
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <aside className={`booking-col${open ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        <div className="booking-card" id="booking">
          <div className="sheet-head">
            <strong>Reserve {p.name}</strong>
            <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="booking-price">
            From <strong>${p.priceFrom}</strong> / night
          </div>
          {SITE.bookingMode === 'widget' ? (
            <>
              <WidgetSlot property={p} />
              <p className="booking-foot">Secure checkout by Hospitable</p>
            </>
          ) : (
            <Suspense fallback={<p className="bk-loading">Loading booking…</p>}>
              <NativeBookingCard property={p} />
            </Suspense>
          )}
        </div>
      </aside>
      <div className="booking-bar">
        <div>
          <strong>From ${p.priceFrom}</strong> / night
          <div className="muted" style={{ fontSize: 13 }}>
            ★ {p.rating} · {plural(p.reviewCount, 'review')}
          </div>
        </div>
        <button className="btn btn-solid" onClick={() => setOpen(true)}>
          Reserve
        </button>
      </div>
    </>
  );
}
