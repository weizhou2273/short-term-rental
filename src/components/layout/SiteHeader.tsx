'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { site } from '@/lib/config/site';
import { cn } from '@/lib/util/cn';
import { ButtonLink } from '@/components/ui/Button';

/**
 * The header is transparent over a hero and solid once scrolled, which is only
 * safe on pages that actually open with a full-bleed image — otherwise white
 * text lands on a white page. Pages opt in via `transparent`.
 */
export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  // A fixed-position sheet over a scrollable body is a classic iOS trap.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const solid = !transparent || scrolled || menuOpen;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-[var(--ease-out-quint)]',
        solid
          ? 'border-b border-[var(--color-line)] bg-[var(--color-canvas)]/92 backdrop-blur-md'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[88rem] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className={cn(
            'display text-[1.375rem] tracking-tight transition-colors',
            solid ? 'text-[var(--color-ink)]' : 'text-white',
          )}
        >
          {site.name}
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-9 md:flex">
          {site.nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative text-[0.8125rem] font-medium tracking-wide transition-opacity hover:opacity-70',
                  solid ? 'text-[var(--color-ink)]' : 'text-white',
                  active && 'after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-current',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <ButtonLink
            href="/properties"
            size="sm"
            variant={solid ? 'primary' : 'secondary'}
            className={cn(!solid && 'border-white/40 bg-white/10 text-white backdrop-blur hover:border-white')}
          >
            Check availability
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className={cn(
            'flex h-10 w-10 items-center justify-center md:hidden',
            solid ? 'text-[var(--color-ink)]' : 'text-white',
          )}
        >
          <span className="relative block h-4 w-5">
            <span
              className={cn(
                'absolute left-0 block h-px w-full bg-current transition-all duration-300 ease-[var(--ease-out-quint)]',
                menuOpen ? 'top-1/2 rotate-45' : 'top-0.5',
              )}
            />
            <span
              className={cn(
                'absolute left-0 block h-px w-full bg-current transition-all duration-300 ease-[var(--ease-out-quint)]',
                menuOpen ? 'top-1/2 -rotate-45' : 'bottom-0.5',
              )}
            />
          </span>
        </button>
      </div>

      <div
        id="mobile-nav"
        hidden={!menuOpen}
        className="border-t border-[var(--color-line)] bg-[var(--color-canvas)] md:hidden"
      >
        <nav aria-label="Mobile" className="flex flex-col px-5 py-4">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="border-b border-[var(--color-line)] py-4 text-[0.9375rem] text-[var(--color-ink)] last:border-b-0"
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink
            href="/properties"
            size="md"
            className="mt-5"
            onClick={() => setMenuOpen(false)}
          >
            Check availability
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
