import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center pt-[72px]">
        <Container size="narrow" className="py-24 text-center">
          <p className="eyebrow mb-6">404</p>
          <h1 className="display text-[clamp(2rem,4.5vw,3rem)]">
            That page has gone walkabout
          </h1>
          <p className="mx-auto mt-6 max-w-md text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
            It may have moved, or it may never have existed. The three houses are all
            still where we left them.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/properties" size="lg">
              See the homes
            </ButtonLink>
            <ButtonLink href="/" size="lg" variant="secondary">
              Back to the start
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
