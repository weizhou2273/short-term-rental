'use client';

import { useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { Button, ButtonLink } from '@/components/ui/Button';
import { site } from '@/lib/config/site';

/**
 * Last-resort boundary. `digest` is the only identifier the server exposes for
 * a production error, so it is shown to the guest — quoting it is what lets us
 * find the corresponding server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] unhandled error', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center">
      <Container size="narrow" className="py-24 text-center">
        <p className="eyebrow mb-6">Something broke</p>
        <h1 className="display text-[clamp(2rem,4.5vw,3rem)]">
          That did not work as intended
        </h1>
        <p className="mx-auto mt-6 max-w-md text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
          If you were part-way through a booking, nothing has been charged. Try again, or
          call us on{' '}
          <a href={site.phoneHref} className="underline underline-offset-4">
            {site.phone}
          </a>{' '}
          and we will take the booking over the phone.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
          <ButtonLink href="/" size="lg" variant="secondary">
            Back to the start
          </ButtonLink>
        </div>

        {error.digest ? (
          <p className="mt-10 text-xs text-[var(--color-ink-faint)]">
            Reference: <span className="tabular">{error.digest}</span>
          </p>
        ) : null}
      </Container>
    </div>
  );
}
