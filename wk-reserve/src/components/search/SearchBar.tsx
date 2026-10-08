'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SITE } from '@/data/site';
import { addDays, todayIso } from '@/lib/dates';
import { plural } from '@/lib/format';
import { MAX_GUESTS, toQueryString, type SearchState } from '@/lib/search-params';

/** Where / check-in / check-out / guests. Submitting goes to /search with the query in the URL. */
export function SearchBar({ initial }: { initial?: Partial<SearchState> }) {
  const router = useRouter();
  const [checkin, setCheckin] = useState(initial?.checkin ?? '');
  const today = todayIso();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const state: Partial<SearchState> = {
      where: String(fd.get('where') || ''),
      checkin: String(fd.get('checkin') || ''),
      checkout: String(fd.get('checkout') || ''),
      adults: Number(fd.get('adults')) || 0,
      amenities: initial?.amenities ?? [],
    };
    // A checkout on or before check-in is dropped rather than searched.
    if (state.checkin && state.checkout && state.checkout <= state.checkin) state.checkout = '';
    router.push(`/search${toQueryString(state)}`);
  }

  return (
    <form className="searchbar" role="search" onSubmit={onSubmit}>
      <div className="sb-field">
        <label htmlFor="sb-where">Where</label>
        <select id="sb-where" name="where" defaultValue={initial?.where ?? ''}>
          <option value="">Anywhere in the Poconos</option>
          {SITE.attractions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sb-field">
        <label htmlFor="sb-in">Check-in</label>
        <input id="sb-in" name="checkin" type="date" min={today} defaultValue={initial?.checkin ?? ''} onChange={(e) => setCheckin(e.target.value)} />
      </div>
      <div className="sb-field">
        <label htmlFor="sb-out">Check-out</label>
        <input id="sb-out" name="checkout" type="date" min={checkin ? addDays(checkin, 1) : today} defaultValue={initial?.checkout ?? ''} />
      </div>
      <div className="sb-field">
        <label htmlFor="sb-guests">Guests</label>
        <select id="sb-guests" name="adults" defaultValue={initial?.adults ? String(initial.adults) : ''}>
          <option value="">Add guests</option>
          {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {plural(n, 'guest')}
            </option>
          ))}
        </select>
      </div>
      <button className="sb-go" type="submit">
        Search
      </button>
    </form>
  );
}
