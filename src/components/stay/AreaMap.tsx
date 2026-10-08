'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';

/** Radius of the "approximate area" circle, in metres. */
const AREA_RADIUS = 1000;
/** Zoomed in any further, the circle stops reading as an area. */
const MAX_ZOOM = 15;

/**
 * OpenStreetMap map with a circle around the stay's approximate location,
 * never a pin on the address. Leaflet loads only when the map comes near the
 * screen, so guests who don't scroll that far don't download it.
 */
export function AreaMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let map: LeafletMap | undefined;
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void import('leaflet').then((L) => {
          if (cancelled) return;
          // On phones a one-finger swipe should scroll the page, not the map;
          // pinch and the +/− buttons still zoom.
          const touch = window.matchMedia('(pointer: coarse)').matches;
          map = L.map(el, { center: [lat, lng], zoom: 13, maxZoom: MAX_ZOOM, scrollWheelZoom: false, dragging: !touch });
          map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: MAX_ZOOM,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(map);
          L.circle([lat, lng], { radius: AREA_RADIUS, color: '#1F3A2E', weight: 2, fillColor: '#1F3A2E', fillOpacity: 0.15 }).addTo(map);
        });
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      map?.remove();
    };
  }, [lat, lng]);

  return <div ref={ref} className="loc-map area-map" role="region" aria-label={`Map of the area around ${label}`} />;
}
