import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="container" style={{ padding: '64px 24px' }}>
        <h1>That stay isn&apos;t listed</h1>
        <p className="muted" style={{ margin: '8px 0 16px' }}>
          The link may be out of date.
        </p>
        <Link className="btn" href="/search">
          See all stays
        </Link>
      </main>
      <Footer />
    </>
  );
}
