import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PropertyCard } from '@/components/property/PropertyCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { GUIDES, getGuide, guideHomes, guidePath } from '@/data/guides';
import { PROPERTIES } from '@/data/properties';
import { getSuggestedStays } from '@/lib/hospitable/suggested';
import { coverPhoto } from '@/lib/photos';
import { guideJsonLd } from '@/lib/seo';

// Only guides that match at least one listed home exist; others 404.
export const dynamicParams = false;
// Card prices follow each home's next open stay, like the home page.
export const revalidate = 3600;

const builtGuides = () => GUIDES.filter((g) => guideHomes(g, PROPERTIES).length > 0);

export function generateStaticParams() {
  return builtGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  const homes = guideHomes(guide, PROPERTIES);
  const cover = homes[0] ? coverPhoto(homes[0]) : undefined;
  return {
    title: guide.metaTitle,
    description: guide.description(homes),
    alternates: { canonical: guidePath(guide) },
    ...(cover ? { openGraph: { images: [{ url: cover.src, alt: cover.alt }] } } : {}),
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  const homes = guide ? guideHomes(guide, PROPERTIES) : [];
  if (!guide || !homes.length) notFound();
  // The homes that fit come first; every other home follows, since they're all a short drive apart and sleep a big group.
  const otherHomes = PROPERTIES.filter((p) => !homes.includes(p));
  const suggested = await getSuggestedStays(PROPERTIES);
  const priced = Object.keys(suggested).length > 0;
  const others = builtGuides().filter((g) => g.slug !== guide.slug);

  return (
    <>
      <JsonLd data={guideJsonLd(guide.title, guidePath(guide))} />
      <Header />
      <main id="main" className="container guide">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/poconos">Poconos guides</Link>
        </nav>
        <section className="guide-head">
          <span className="eyebrow">{guide.group}</span>
          <h1>{guide.title}</h1>
          {guide.intro(homes).map((text) => (
            <p key={text}>{text}</p>
          ))}
          {priced ? <p className="muted grid-note">Prices are for the dates shown and include all fees, before taxes.</p> : null}
        </section>
        <div className="grid-cards">
          {homes.map((p) => {
            const note = guide.note(p);
            return (
              <div key={p.id} className="guide-home">
                <PropertyCard property={p} suggested={suggested[p.slug]} nearName={guide.nearName} />
                {note ? <p className="guide-note">{note}</p> : null}
              </div>
            );
          })}
        </div>
        {otherHomes.length ? (
          <section className="guide-others" aria-labelledby="guide-others-title">
            <h2 id="guide-others-title">More of our Poconos homes</h2>
            <p className="muted">All a short drive away, each with a private pool (open in summer), hot tub, sauna and room for a big group.</p>
            <div className="grid-cards">
              {otherHomes.map((p) => (
                <PropertyCard key={p.id} property={p} suggested={suggested[p.slug]} />
              ))}
            </div>
          </section>
        ) : null}
        <p className="guide-cta">
          <Link className="btn btn-solid" href={guide.searchHref}>
            Check dates and prices
          </Link>
        </p>
        <section className="section guide-more" aria-labelledby="guide-more-title">
          <h2 id="guide-more-title">More ways to find your Poconos stay</h2>
          <ul className="guide-links">
            {others.map((g) => (
              <li key={g.slug}>
                <Link href={guidePath(g)}>{g.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
