'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Metricool web analytics (metricool.com → Web connection). The hash is public, like the pixel ID. */
const METRICOOL_HASH = '8837882adeed51e48c2e51cf9bb4a7a3';

type BeTracker = { t: (o: { hash: string }) => void };

function track() {
  try {
    (window as unknown as { beTracker?: BeTracker }).beTracker?.t({ hash: METRICOOL_HASH });
  } catch {
    // Analytics must never break the page.
  }
}

/** Loads Metricool once and records a visit on the first load and on each client-side navigation. */
export function Metricool() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // The first visit is recorded by onReady once the script has loaded.
    if (first.current) {
      first.current = false;
      return;
    }
    track();
  }, [pathname]);

  return <Script id="metricool" src="https://tracker.metricool.com/resources/be.js" strategy="afterInteractive" onReady={track} />;
}
