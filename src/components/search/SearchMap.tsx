'use client';

import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** Text on the pin: the stay's price, or its name when there's no price. */
  label: string;
  /** Accessible name and hover tooltip, e.g. "The Shawnee Estate, $1,080 total before taxes". */
  title: string;
  href: string;
};

/** Pins sit on each stay's approximate location, so don't zoom to street level. */
const MAX_ZOOM = 14;
/** Shown when no stays match, roughly the Pocono Mountains. */
const POCONOS: [number, number] = [41.09, -75.25];
/** Space kept between neighbouring pins, in pixels. */
const PIN_GAP = 4;

/**
 * Stays a few minutes apart would draw their pins on top of each other at
 * most zoom levels. Working from north to south, each pin that would overlap
 * one above it is nudged down until it clears, so pins keep their real
 * north–south order. Pins already sit on approximate locations, so a few
 * pixels of offset doesn't mislead.
 */
function declutter(map: Leaflet.Map, markers: Iterable<Leaflet.Marker>) {
  const pins = [...markers]
    .map((marker) => ({
      pill: marker.getElement()?.querySelector<HTMLElement>('.pin'),
      anchor: map.latLngToContainerPoint(marker.getLatLng()),
    }))
    .filter((p): p is { pill: HTMLElement; anchor: Leaflet.Point } => Boolean(p.pill))
    .sort((a, b) => a.anchor.y - b.anchor.y);

  const placed: { x: number; y: number; w: number; h: number }[] = [];
  for (const { pill, anchor } of pins) {
    const { x } = anchor;
    const w = pill.offsetWidth;
    const h = pill.offsetHeight;
    let y = anchor.y;
    for (let moved = true; moved; ) {
      moved = false;
      for (const r of placed) {
        const clearance = (h + r.h) / 2 + PIN_GAP;
        if (Math.abs(x - r.x) < (w + r.w) / 2 + PIN_GAP && Math.abs(y - r.y) < clearance) {
          y = r.y + clearance;
          moved = true;
        }
      }
    }
    pill.style.marginTop = `${y - anchor.y}px`;
    placed.push({ x, y, w, h });
  }
}

/**
 * Search results map: OpenStreetMap tiles with a price pin per stay (Airbnb
 * style). Pins are framed to fit whenever the set of stays changes, but not
 * when only prices change, so a guest's own panning is kept. `activeId`
 * highlights the pin of the card under the pointer.
 */
export function SearchMap({ pins, activeId }: { pins: MapPin[]; activeId: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [leaflet, setLeaflet] = useState<{ L: typeof Leaflet; map: Leaflet.Map } | null>(null);
  const markers = useRef(new Map<string, Leaflet.Marker>());
  const framed = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let map: Leaflet.Map | undefined;
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled) return;
      // On phones a one-finger swipe should scroll the page, not the map;
      // pinch and the +/− buttons still zoom.
      const touch = window.matchMedia('(pointer: coarse)').matches;
      map = L.map(el, { center: POCONOS, zoom: 9, maxZoom: MAX_ZOOM, dragging: !touch, scrollWheelZoom: !touch });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: MAX_ZOOM,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      setLeaflet({ L, map });
    });
    return () => {
      cancelled = true;
      map?.remove();
      framed.current = null;
    };
  }, []);

  // Rebuild the pins whenever their prices, links or the set of stays change.
  const pinsKey = JSON.stringify(pins);
  useEffect(() => {
    if (!leaflet) return;
    const { L, map } = leaflet;
    const list = JSON.parse(pinsKey) as MapPin[];
    const layer = L.layerGroup().addTo(map);
    const placed = markers.current;
    for (const pin of list) {
      const label = document.createElement('span');
      label.className = 'pin';
      label.textContent = pin.label;
      // A zero-size icon anchored on the point; the pill centres itself with CSS.
      const icon = L.divIcon({ className: 'pin-marker', html: label, iconSize: [0, 0] });
      const marker = L.marker([pin.lat, pin.lng], { icon, title: pin.title, keyboard: true }).addTo(layer);
      marker.getElement()?.setAttribute('aria-label', pin.title);
      // Enter on a focused pin fires click too.
      marker.on('click', () => router.push(pin.href));
      placed.set(pin.id, marker);
    }

    const ids = list.map((p) => p.id).join();
    if (framed.current !== ids) {
      framed.current = ids;
      if (list.length) map.fitBounds(L.latLngBounds(list.map((p) => [p.lat, p.lng])), { padding: [56, 56], maxZoom: 11 });
      else map.setView(POCONOS, 9);
    }
    // Pins' relative positions only change with zoom, not with panning.
    const spread = () => declutter(map, placed.values());
    spread();
    map.on('zoomend', spread);
    return () => {
      map.off('zoomend', spread);
      layer.remove();
      placed.clear();
    };
  }, [leaflet, pinsKey, router]);

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      const on = id === activeId;
      marker.getElement()?.querySelector('.pin')?.classList.toggle('active', on);
      marker.setZIndexOffset(on ? 1000 : 0);
    }
  }, [activeId, leaflet, pinsKey]);

  return <div ref={ref} className="search-map" role="region" aria-label="Map of the stays" />;
}
