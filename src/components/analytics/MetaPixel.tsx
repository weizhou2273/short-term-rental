'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { META_PIXEL_ID, trackMeta } from '@/lib/meta-pixel';

/**
 * Loads the Meta Pixel once (root layout) and sends PageView on the first load
 * and on every client-side navigation, which the stock snippet would miss.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // The snippet below sends the first PageView itself; only later navigations are sent here.
    if (first.current) {
      first.current = false;
      return;
    }
    trackMeta('PageView');
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;
n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}

/** Fires one Meta event when the page mounts (for use from server pages). */
export function MetaEvent({ event, params }: { event: string; params?: Record<string, unknown> }) {
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    trackMeta(event, params);
    // Re-fire only when the event or its data actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key]);
  return null;
}
