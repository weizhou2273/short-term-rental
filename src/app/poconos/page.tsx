import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { GUIDE_GROUPS, GUIDES, guideHomes, guidePath } from '@/data/guides';
import { PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';

export const metadata: Metadata = {
  title: 'Pocono Mountains Vacation Rental Guides',
  description: `Find the right Poconos vacation rental: homes near Camelback, Kalahari and Shawnee Mountain, large group houses, ski trips, private pools, hot tubs, pet-friendly stays and more, from ${SITE.brand}.`,
  alternates: { canonical: '/poconos' },
};

/** /poconos: every guide, grouped, so guests (and search engines) can find each one. */
export default function GuidesPage() {
  const built = GUIDES.filter((g) => guideHomes(g, PROPERTIES).length > 0);
  return (
    <>
      <Header />
      <main id="main" className="container guide">
        <section className="guide-head">
          <span className="eyebrow">Poconos guides</span>
          <h1>Find your Pocono Mountains vacation rental</h1>
          <p>
            Whether you’re coming to ski, to splash at the waterparks, or to get the whole family under one roof, start here. Each guide lists
            the {SITE.brand} homes that fit and why.
          </p>
        </section>
        {GUIDE_GROUPS.map((group) => {
          const guides = built.filter((g) => g.group === group);
          return guides.length ? (
            <section key={group} className="section guide-group">
              <h2>{group}</h2>
              <ul className="guide-index">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <Link href={guidePath(g)}>{g.title}</Link>
                    <p className="muted">{g.description(guideHomes(g, PROPERTIES))}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null;
        })}
      </main>
      <Footer />
    </>
  );
}
