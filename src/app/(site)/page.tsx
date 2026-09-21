import Link from 'next/link';
import type { Metadata } from 'next';
import { getProperties } from '@/lib/ownerrez/properties';
import { getPosts } from '@/lib/wordpress/content';
import { site } from '@/lib/config/site';
import { pageMetadata } from '@/lib/config/metadata';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Hero } from '@/components/marketing/Hero';
import { DirectBookingBenefits } from '@/components/marketing/DirectBookingBenefits';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Section } from '@/components/ui/Section';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { formatLongDate } from '@/lib/util/date';

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    path: '/',
  });
}

export default async function HomePage() {
  // Both reads degrade to bundled content, so a CMS or PMS outage cannot take
  // the homepage down — it just serves slightly staler copy.
  const [properties, posts] = await Promise.all([getProperties(), getPosts(3)]);
  const hero = properties[0]?.images[0];

  return (
    <>
      <SiteHeader transparent />

      <Hero
        image={{
          url: hero?.url ?? '/demo/glass-barn-living.svg',
          alt: hero?.alt || 'A design-led house at dusk',
        }}
        eyebrow="Hudson Valley · Berkshires"
        title="Architectural retreats, booked direct."
        lede={site.description}
        primaryAction={{ href: '/properties', label: 'See the homes' }}
        secondaryAction={{ href: '/about', label: 'How we work' }}
      />

      <Section
        eyebrow="The portfolio"
        title="Three houses. No more than that."
        lede="We turn down more properties than we take on. Every home here is one we would stay in ourselves, and most weekends, do."
        action={
          <ButtonLink href="/properties" variant="secondary" size="md">
            All homes
          </ButtonLink>
        }
        size="wide"
      >
        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property, index) => (
            <PropertyCard key={property.id} property={property} priority={index === 0} />
          ))}
        </div>
      </Section>

      <DirectBookingBenefits />

      <section className="py-20 sm:py-28">
        <Container size="narrow" className="text-center">
          <p className="eyebrow mb-6">What guests say</p>
          <blockquote className="display text-[clamp(1.5rem,3.2vw,2.25rem)] leading-[1.28] text-[var(--color-ink)]">
            “We have stayed in a lot of places that photograph well. This is the first one
            that was actually better than the pictures — and the only one where someone
            texted back in four minutes on a Sunday.”
          </blockquote>
          <p className="mt-8 text-sm text-[var(--color-ink-faint)]">
            Elena R. · four nights at Stone House No. 4
          </p>
        </Container>
      </section>

      {posts.length > 0 ? (
        <Section
          eyebrow="Journal"
          title="Notes from the valley"
          lede="Where to walk, where to eat, and when the light is at its best."
          action={
            <ButtonLink href="/journal" variant="secondary" size="md">
              Read the journal
            </ButtonLink>
          }
          className="bg-[var(--color-canvas-sunk)]"
          size="wide"
        >
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/journal/${post.slug}`} className="group block">
                <p className="eyebrow">{post.categories[0] ?? 'Notes'}</p>
                <h3 className="display mt-3 text-xl text-[var(--color-ink)] transition-opacity group-hover:opacity-70">
                  {post.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {post.excerpt}
                </p>
                <p className="mt-4 text-xs text-[var(--color-ink-faint)]">
                  {formatLongDate(post.date.slice(0, 10))} · {post.readingMinutes} min read
                </p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <section className="border-t border-[var(--color-line)] py-20 sm:py-28">
        <Container size="narrow" className="text-center">
          <h2 className="display text-[clamp(1.875rem,4vw,2.75rem)]">
            Not sure which house?
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
            Tell us roughly when you want to come and who is coming, and we will tell you
            honestly which of the three fits — including if the answer is none of them.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/contact" size="lg">
              Ask us
            </ButtonLink>
            <ButtonLink href={site.phoneHref} size="lg" variant="secondary">
              {site.phone}
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
