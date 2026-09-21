import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug, getPosts } from '@/lib/wordpress/content';
import { pageMetadata } from '@/lib/config/metadata';
import { formatLongDate } from '@/lib/util/date';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Container } from '@/components/ui/Container';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const posts = await getPosts(50);
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    return pageMetadata({ title: 'Not found', description: '', path: `/journal/${slug}`, noIndex: true });
  }
  return pageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/journal/${post.slug}`,
    image: post.featuredImage?.url ?? null,
    type: 'article',
    publishedTime: post.date,
  });
}

export default async function JournalPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = (await getPosts(4)).filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <>
      <SiteHeader />

      <article className="pt-[72px]">
        <Container size="narrow" className="py-16 sm:py-20">
          <Link
            href="/journal"
            className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            ← Journal
          </Link>

          <p className="eyebrow mt-10">{post.categories[0] ?? 'Notes'}</p>
          <h1 className="display mt-4 text-[clamp(2rem,4.5vw,3rem)]">{post.title}</h1>
          <p className="mt-6 text-sm text-[var(--color-ink-faint)]">
            {post.author ? `${post.author.name} · ` : ''}
            {formatLongDate(post.date.slice(0, 10))} · {post.readingMinutes} min read
          </p>
        </Container>

        {post.featuredImage ? (
          <Container size="default">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-canvas-sunk)]">
              <Image
                src={post.featuredImage.url}
                alt={post.featuredImage.alt || post.title}
                fill
                priority
                sizes="(min-width: 1152px) 1100px, 100vw"
                className="object-cover"
              />
            </div>
          </Container>
        ) : null}

        <Container size="narrow" className="py-16">
          {/* Sanitised in `lib/wordpress/sanitize` before it ever reaches here. */}
          <div
            className="prose-editorial"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </Container>

        {related.length > 0 ? (
          <Container size="wide" className="rule py-16">
            <h2 className="display mb-10 text-2xl">More from the journal</h2>
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-3">
              {related.map((item) => (
                <Link key={item.id} href={`/journal/${item.slug}`} className="group block">
                  <h3 className="display text-lg transition-opacity group-hover:opacity-70">
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {item.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </Container>
        ) : null}
      </article>
    </>
  );
}
