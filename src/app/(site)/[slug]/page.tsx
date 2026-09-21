import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageBySlug } from '@/lib/wordpress/content';
import { pageMetadata } from '@/lib/config/metadata';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Container } from '@/components/ui/Container';

/**
 * Catch-all for editor-authored WordPress pages — `/about`, `/terms`,
 * `/accessibility` and anything else the team publishes later without a deploy.
 *
 * Static segments such as `/properties` and `/journal` take precedence in
 * Next's route resolution, so this never shadows a real route.
 */
export const revalidate = 300;

/** Pages known at build time; anything else renders on first request. */
export const dynamicParams = true;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return [{ slug: 'about' }, { slug: 'terms' }];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) {
    return pageMetadata({ title: 'Not found', description: '', path: `/${slug}`, noIndex: true });
  }
  return pageMetadata({
    title: page.title,
    description: page.excerpt,
    path: `/${page.slug}`,
    image: page.featuredImage?.url ?? null,
  });
}

export default async function CmsPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader />

      <div className="pt-[72px]">
        <Container size="narrow" className="py-16 sm:py-24">
          <h1 className="display text-[clamp(2.25rem,5vw,3.25rem)]">{page.title}</h1>
        </Container>

        {page.featuredImage ? (
          <Container size="default" className="mb-16">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-canvas-sunk)]">
              <Image
                src={page.featuredImage.url}
                alt={page.featuredImage.alt || page.title}
                fill
                priority
                sizes="(min-width: 1152px) 1100px, 100vw"
                className="object-cover"
              />
            </div>
          </Container>
        ) : null}

        <Container size="narrow" className="pb-24">
          <div
            className="prose-editorial"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </Container>
      </div>
    </>
  );
}
