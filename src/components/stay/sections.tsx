import Image from 'next/image';
import type { Property } from '@/data/types';
import { plural, specs } from '@/lib/format';
import type { PropertyPhoto } from '@/lib/photos';
import { Ph } from '@/components/ui/Ph';
import { AreaMap } from './AreaMap';

/** Static content sections of a stay page, in page order. */

export function PropertyHeader({ property: p }: { property: Property }) {
  return (
    <section className="p-head">
      <span className="eyebrow">A W&amp;K Reserve estate</span>
      <h1>{p.name}</h1>
      <p className="p-tagline">{p.tagline}</p>
      <div className="p-head-row">
        <span>
          ★ {p.rating} · <a href="#reviews">{plural(p.reviewCount, 'review')}</a> · {p.location}
        </span>
      </div>
    </section>
  );
}

export function Summary({ property: p }: { property: Property }) {
  return (
    <section className="section">
      <h2>
        {p.type} in {p.area}
      </h2>
      <p className="summary-line muted">{specs(p)}</p>
    </section>
  );
}

export function Description({ property: p }: { property: Property }) {
  return (
    <section className="section desc">
      <h2>About this home</h2>
      {p.description.map((d, i) => (
        <p key={i}>{d}</p>
      ))}
      {p.details?.length ? (
        <details className="desc-more">
          <summary>
            <span className="when-closed">Show more</span>
            <span className="when-open">Show less</span>
          </summary>
          {p.details.map((d) => (
            <div className="desc-detail" key={d.title}>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
            </div>
          ))}
        </details>
      ) : null}
    </section>
  );
}

/** Each room shows its first photo from the photo tour (photos with the same `room` name). */
export function SleepingArrangements({ property: p, photos }: { property: Property; photos: PropertyPhoto[] }) {
  return (
    <section className="section">
      <h2>Where you&apos;ll sleep</h2>
      <div className="rooms">
        {p.sleeping.map((r) => {
          const photo = photos.find((ph) => ph.room === r.room);
          return (
            <div className="room" key={r.room}>
              {photo ? (
                <div className="room-photo">
                  <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 760px) 50vw, 240px" />
                </div>
              ) : (
                <Ph />
              )}
              <h3>{r.room}</h3>
              <p className="muted">{r.beds}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LocationMap({ property: p }: { property: Property }) {
  const { lat, lng } = p.coords;
  const hasMap = lat !== null && lng !== null;
  return (
    <section className="section" id="location">
      <h2>Where you&apos;ll be</h2>
      {hasMap ? <AreaMap lat={lat} lng={lng} label={p.location} /> : <Ph label="Map coming soon" className="loc-map" />}
      <p>
        <strong>{p.location}</strong>
      </p>
      <p className="muted">
        {p.neighborhood ? `${p.neighborhood} ` : ''}The map shows the general area; the exact address is shared after booking.
      </p>
      {hasMap ? (
        <p>
          <a href={`https://www.google.com/maps/@${lat},${lng},13z`} target="_blank" rel="noopener noreferrer">
            Open the area in Google Maps
          </a>
        </p>
      ) : null}
    </section>
  );
}

export function HouseRules({ property: p }: { property: Property }) {
  return (
    <section className="section">
      <h2>Things to know</h2>
      <div className="rules">
        <div>
          <h3>House rules</h3>
          <ul>
            <li>Check-in: {p.rules.checkIn}</li>
            <li>Check-out: {p.rules.checkOut}</li>
            <li>Max {plural(p.guests, 'guest')}</li>
            {p.rules.house.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Safety &amp; property</h3>
          <ul>
            {p.rules.safety.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Cancellation policy</h3>
          <ul>
            <li>{p.rules.cancellation}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Reviews({ property: p }: { property: Property }) {
  return (
    <section className="section" id="reviews">
      <div className="rating-big">
        ★ {p.rating} · {plural(p.reviewCount, 'review')}
      </div>
      <div className="reviews">
        {p.reviews.map((r) => (
          <article key={r.name}>
            <div className="review-head">
              <span className="avatar" aria-hidden="true">
                {r.name.charAt(0)}
              </span>
              <div>
                <strong>{r.name}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {r.date}
                </div>
              </div>
            </div>
            <p>{r.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FAQ({ property: p }: { property: Property }) {
  return (
    <section className="section faq">
      <h2>Frequently asked questions</h2>
      {p.faqs.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}
