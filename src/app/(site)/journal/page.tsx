import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getPosts } from '@/lib/wordpress/content';
import { pageMetadata } from '@/lib/config/metadata';
import { formatLongDate } from '@/lib/util/date';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Container } from '@/components/ui/Container';

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: 'Journal',
  description:
    'Field guides to the Hudson Valley and the Berkshires, plus notes on how we run the houses.',
  path: '/journal',
});

export default async function JournalPage() {
  const posts = await getPosts(24);
  const [lead, ...rest] = posts;

  return (
    <>
      <SiteHeader />

      <div className="pt-[72px]">
        <Container size="wide" className="py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">Journal</p>
            <h1 className="display text-[clamp(2.25rem,5vw,3.5rem)]">
              Notes from the valley
            </h1>
            <p className="mt-6 text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
              Where to walk, where to eat, when the light is best, and the occasional
              explanation of why we run things the way we do.
            </p>
          </div>

          {lead ? (
            <Link
              href={`/journal/${lead.slug}`}
              className="group mt-16 grid gap-8 lg:grid-cols-2 lg:items-center"
            >
              {lead.featuredImage ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-canvas-sunk)]">
                  <Image
                    src={lead.featuredImage.url}
                    alt={lead.featuredImage.alt || lead.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-[1.03]"
                  />
                </div>
              ) : null}
              <div>
                <p className="eyebrow">{lead.categories[0] ?? 'Notes'}</p>
                <h2 className="display mt-4 text-[clamp(1.75rem,3.5vw,2.5rem)] transition-opacity group-hover:opacity-75">
                  {lead.title}
                </h2>
                <p className="mt-5 text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
                  {lead.excerpt}
                </p>
                <p className="mt-6 text-xs text-[var(--color-ink-faint)]">
                  {formatLongDate(lead.date.slice(0, 10))} · {lead.readingMinutes} min read
                </p>
              </div>
            </Link>
          ) : null}

          {rest.length > 0 ? (
            <div className="rule mt-20 grid gap-x-8 gap-y-14 pt-16 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <Link key={post.id} href={`/journal/${post.slug}`} className="group block">
                  {post.featuredImage ? (
                    <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-canvas-sunk)]">
                      <Image
                        src={post.featuredImage.url}
                        alt={post.featuredImage.alt || post.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, 50vw"
                        className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-[1.03]"
                      />
                    </div>
                  ) : null}
                  <p className="eyebrow">{post.categories[0] ?? 'Notes'}</p>
                  <h3 className="display mt-3 text-xl transition-opacity group-hover:opacity-70">
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
          ) : null}
        </Container>
      </div>
    </>
  );
}
