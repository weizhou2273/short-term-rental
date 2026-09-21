import type { Metadata } from 'next';
import { site } from '@/lib/config/site';
import { pageMetadata } from '@/lib/config/metadata';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Container } from '@/components/ui/Container';
import { InquiryForm } from '@/components/marketing/InquiryForm';

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description:
    'Ask us anything about the houses, the area or your dates. A person reads every message.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <SiteHeader />

      <div className="pt-[72px]">
        <Container size="default" className="py-16 sm:py-24">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="eyebrow mb-4">Contact</p>
              <h1 className="display text-[clamp(2.25rem,5vw,3.25rem)]">
                Ask us anything
              </h1>
              <p className="mt-6 text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
                Whether a house suits a particular group, whether the road is passable in
                February, whether we can get a crib in — ask. We would rather tell you
                honestly that a house is wrong for you than have you arrive and find out.
              </p>

              <dl className="rule mt-12 space-y-6 pt-10 text-sm">
                <div>
                  <dt className="eyebrow mb-2">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${site.email}`}
                      className="text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                    >
                      {site.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow mb-2">Phone</dt>
                  <dd>
                    <a href={site.phoneHref} className="tabular text-[var(--color-ink)]">
                      {site.phone}
                    </a>
                    <span className="mt-1 block text-xs text-[var(--color-ink-faint)]">
                      9am–8pm Eastern. During a stay, any hour.
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow mb-2">Where we are</dt>
                  <dd className="text-[var(--color-ink-muted)]">
                    {site.address.locality}, {site.address.region}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8">
              <InquiryForm />
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
