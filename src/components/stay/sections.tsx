import type { Property } from '@/data/types';
import { plural, specs } from '@/lib/format';
import { Ph } from '@/components/ui/Ph';

/** Static content sections of a stay page, in page order. */

export function PropertyHeader({ property: p }: { property: Property }) {
  return (
    <section className="p-head">
      <span className="eyebrow">A W&amp;K Reserve estate</span>
      <h1>{p.name}</h1>
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

export function Highlights({ property: p }: { property: Property }) {
  return (
    <section className="section">
      <div className="highlights">
        {p.highlights.map((h) => (
          <div className="highlight" key={h.title}>
            <Ph />
            <div>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
            </div>
          </div>
        ))}
      </div>
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
    </section>
  );
}

export function SleepingArrangements({ property: p }: { property: Property }) {
  return (
    <section className="section">
      <h2>Where you&apos;ll sleep</h2>
      <div className="rooms">
        {p.sleeping.map((r) => (
          <div className="room" key={r.room}>
            <Ph />
            <h3>{r.room}</h3>
            <p className="muted">{r.beds}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LocationMap({ property: p }: { property: Property }) {
  return (
    <section className="section" id="location">
      <h2>Where you&apos;ll be</h2>
      <Ph label="Map placeholder: approximate location" className="loc-map" />
      <p>
        <strong>{p.location}</strong>
      </p>
      <p className="muted">Exact address is shared after booking. Placeholder neighborhood notes and drive times.</p>
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
              <Ph className="avatar" />
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
