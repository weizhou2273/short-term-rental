'use client';

import { useEffect, useState } from 'react';
import { SITE } from '@/data/site';
import type { Property } from '@/data/types';

const CONTAINER_ID = 'hospitable-widget';

/**
 * Hospitable's embedded Direct widget (bookingMode "widget"), kept as the
 * fallback. The loader appends its iframe to #hospitable-widget and reads
 * checkin / checkout / adults from the page's real ?query string.
 */
export function WidgetSlot({ property: p }: { property: Property }) {
  const propertyId = p.hospitable.propertyId;
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    if (!propertyId) return;
    const fail = () => setStatus('failed');
    const timer = setTimeout(fail, 8000);
    const onReady = () => {
      clearTimeout(timer);
      setStatus('ready');
    };
    window.addEventListener('hospitable:widget-loader:ready', onReady, { once: true });

    const s = document.createElement('script');
    s.src = SITE.hospitable.loaderSrc;
    s.async = true;
    s.dataset.siteUuid = SITE.hospitable.siteUuid;
    s.dataset.propertyId = propertyId;
    s.dataset.theme = SITE.hospitable.theme;
    s.dataset.container = CONTAINER_ID;
    s.dataset.hospitableLoader = '';
    s.onerror = () => {
      clearTimeout(timer);
      fail();
    };
    document.body.appendChild(s);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('hospitable:widget-loader:ready', onReady);
      document.getElementById('booking-iframe')?.remove();
      s.remove();
      delete (window as unknown as Record<string, unknown>).__hospitableWidgetLoaderInit;
    };
  }, [propertyId]);

  return (
    <div id={CONTAINER_ID} className="widget-host">
      {!propertyId ? (
        <div className="widget-slot">
          <strong>Hospitable booking widget goes here</strong>
          <span>Add this property&apos;s data-property-id to</span>
          <code style={{ fontSize: 12 }}>PROPERTIES[&quot;{p.id}&quot;].hospitable.propertyId</code>
        </div>
      ) : status === 'loading' ? (
        <div className="widget-status muted">Loading booking widget…</div>
      ) : status === 'failed' ? (
        <div className="widget-slot">
          <strong>Booking widget couldn&apos;t load</strong>
          <span>
            Please try again, or email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> to book.
          </span>
        </div>
      ) : null}
    </div>
  );
}
