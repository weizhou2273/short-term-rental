import Link from 'next/link';
import { site } from '@/lib/config/site';
import { Container } from '@/components/ui/Container';

const columns = [
  {
    heading: 'Stay',
    links: [
      { href: '/properties', label: 'All homes' },
      { href: '/properties?guests=6', label: 'Sleeps six or more' },
      { href: '/properties?pets=1', label: 'Dog friendly' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/about', label: 'Who we are' },
      { href: '/journal', label: 'Journal' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Practical',
    links: [
      { href: '/terms', label: 'Rental terms' },
      { href: '/contact', label: 'Cancellations' },
      { href: '/contact', label: 'Accessibility' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-canvas-sunk)]">
      <Container size="wide" className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="max-w-sm">
            <p className="display text-[1.75rem]">{site.name}</p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {site.description}
            </p>
            <div className="mt-6 space-y-1 text-sm">
              <a
                href={`mailto:${site.email}`}
                className="block text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
              >
                {site.email}
              </a>
              <a href={site.phoneHref} className="block text-[var(--color-ink-muted)] tabular">
                {site.phone}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.heading}>
                <p className="eyebrow mb-4">{column.heading}</p>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={`${column.heading}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="rule mt-14 flex flex-col gap-3 pt-8 text-xs text-[var(--color-ink-faint)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
          </p>
          <p>
            Booked direct. Managed with OwnerRez.
          </p>
        </div>
      </Container>
    </footer>
  );
}
