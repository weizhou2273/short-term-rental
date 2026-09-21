import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { env } from '@/lib/config/env';
import { PAGES_TAG, POSTS_TAG, PROPERTY_CONTENT_TAG } from '@/lib/wordpress/content';
import { expireTag } from '@/lib/api/cache';

/**
 * On-demand revalidation for WordPress.
 *
 * Point a `save_post` hook here (or the WP Webhooks plugin) so an editor's
 * publish is live in seconds instead of waiting out the ISR window. Without
 * this, the CMS feels broken to the people who use it most.
 */
export const dynamic = 'force-dynamic';

function secretValid(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  // Hash both sides first so the comparison is length-independent and still
  // constant-time.
  const a = createHmac('sha256', expected).update(provided).digest();
  const b = createHmac('sha256', expected).update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = env().REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'Revalidation is not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const provided =
    request.headers.get('x-revalidate-secret') ?? url.searchParams.get('secret');

  if (!secretValid(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    slug?: string;
  };

  const type = (body.type ?? url.searchParams.get('type') ?? 'all').toLowerCase();
  const slug = body.slug ?? url.searchParams.get('slug') ?? null;

  const revalidated: string[] = [];

  if (type === 'post' || type === 'all') {
    expireTag(POSTS_TAG);
    revalidatePath('/journal');
    revalidated.push(POSTS_TAG);
    if (slug) {
      expireTag(`wp:post:${slug}`);
      revalidatePath(`/journal/${slug}`);
    }
  }

  if (type === 'page' || type === 'all') {
    expireTag(PAGES_TAG);
    revalidated.push(PAGES_TAG);
    if (slug) {
      expireTag(`wp:page:${slug}`);
      revalidatePath(`/${slug}`);
    }
  }

  if (type === 'property' || type === 'all') {
    expireTag(PROPERTY_CONTENT_TAG);
    revalidatePath('/properties', 'layout');
    revalidated.push(PROPERTY_CONTENT_TAG);
  }

  if (type === 'all') revalidatePath('/');

  return NextResponse.json({ revalidated, type, slug });
}
