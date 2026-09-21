import Link from 'next/link';
import type { Metadata } from 'next';
import { site } from '@/lib/config/site';
import { pageMetadata } from '@/lib/config/metadata';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Container } from '@/components/ui/Container';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Booking confirmation',
  description: '',
  path: '/booking/confirmation',
  noIndex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Every checkout outcome lands here, including the unhappy ones. A guest whose
 * card was charged must never see an error page — they see what happened, their
 * reference, and how to reach a person.
 */
const COPY: Record<
  string,
  { heading: string; body: string; tone: 'ok' | 'pending' | 'problem' }
> = {
  confirmed: {
    heading: 'You are booked.',
    body: 'A confirmation with directions, the door code and everything else you need is on its way to your inbox. It usually lands within a minute.',
    tone: 'ok',
  },
  request: {
    heading: 'Request received.',
    body: 'We have your dates and details. We will confirm availability and send an invoice within a few hours — nothing has been charged.',
    tone: 'pending',
  },
  processing: {
    heading: 'Your payment is clearing.',
    body: 'Some payment methods take a little longer to settle. We will email your confirmation as soon as it completes — there is nothing more for you to do.',
    tone: 'pending',
  },
  needs_attention: {
    heading: 'Almost there.',
    body: 'Your payment went through but we could not finish the reservation automatically. We have been alerted and will confirm by email shortly. Please do not pay again.',
    tone: 'problem',
  },
  failed: {
    heading: 'That payment did not go through.',
    body: 'No money has been taken. You can try again with a different card, or get in touch and we will hold the dates while we sort it out.',
    tone: 'problem',
  },
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const reference = first(query.reference) ?? null;
  const mode = first(query.mode);
  const status = mode === 'request' ? 'request' : (first(query.status) ?? 'confirmed');
  const copy = COPY[status] ?? COPY.confirmed!;

  return (
    <>
      <SiteHeader />

      <div className="pt-[72px]">
        <Container size="narrow" className="py-24 sm:py-32">
          <div className="text-center">
            {copy.tone === 'ok' ? (
              <div
                aria-hidden="true"
                className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-soft)]"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m5 12.5 4.5 4.5L19 7"
                    stroke="var(--color-accent)"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : null}

            <h1 className="display text-[clamp(2rem,4.5vw,3rem)]">{copy.heading}</h1>
            <p className="mx-auto mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
              {copy.body}
            </p>

            {reference ? (
              <div className="mx-auto mt-10 inline-block rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-5">
                <p className="eyebrow">Your reference</p>
                <p className="mt-2 text-2xl tabular tracking-wide text-[var(--color-ink)]">
                  {reference}
                </p>
              </div>
            ) : null}

            {copy.tone === 'problem' ? (
              <Alert tone={status === 'failed' ? 'warning' : 'critical'} className="mt-10 text-left">
                Quote reference {reference ?? 'unknown'} when you get in touch —{' '}
                <a href={`mailto:${site.email}`} className="underline underline-offset-2">
                  {site.email}
                </a>{' '}
                or{' '}
                <a href={site.phoneHref} className="underline underline-offset-2">
                  {site.phone}
                </a>
                .
              </Alert>
            ) : null}

            <div className="mt-12 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/journal" size="lg" variant="secondary">
                Read the valley guide
              </ButtonLink>
              <ButtonLink href="/properties" size="lg" variant="ghost">
                Back to the homes
              </ButtonLink>
            </div>

            <p className="mt-12 text-xs leading-relaxed text-[var(--color-ink-faint)]">
              Questions before you arrive? Email{' '}
              <Link href="/contact" className="underline underline-offset-2">
                us
              </Link>{' '}
              any time — a person reads every message.
            </p>
          </div>
        </Container>
      </div>
    </>
  );
}
