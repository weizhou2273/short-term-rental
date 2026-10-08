import Link from 'next/link';
import { Suspense } from 'react';
import { SITE } from '@/data/site';
import { Monogram } from '@/components/brand/Monogram';
import { MiniSearch } from './MiniSearch';

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label={`${SITE.brand} home`}>
      <Monogram />
      <span className="logo-word">RESERVE</span>
    </Link>
  );
}

export function Header({ showMiniSearch = false }: { showMiniSearch?: boolean }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        {showMiniSearch ? (
          <Suspense fallback={null}>
            <MiniSearch />
          </Suspense>
        ) : null}
        <nav className="nav" aria-label="Main">
          <Link href="/search">All stays</Link>
          <a href={`mailto:${SITE.contactEmail}`}>Contact</a>
          <Link className="btn btn-solid" href="/search">
            Book direct
          </Link>
        </nav>
      </div>
    </header>
  );
}
