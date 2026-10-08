import { SITE } from '@/data/site';

export function WhyBookDirect() {
  return (
    <section className="section" id="why">
      <span className="eyebrow">W&amp;K Reserve direct</span>
      <h2 style={{ marginBottom: 24 }}>Why book direct</h2>
      <div className="why">
        {SITE.whyBookDirect.map((w) => (
          <div className="why-item" key={w.title}>
            <h3>{w.title}</h3>
            <p>{w.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
