import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import { SITE } from '@/data/site';
import { SITE_URL } from '@/lib/seo';
import './globals.css';

const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jost', display: 'swap' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE.brand} — Pocono Mountains Vacation Rentals`, template: `%s · ${SITE.brand}` },
  description:
    'Book direct with W&K Reserve: private Pocono Mountains vacation homes for 12 to 22 guests, each with a pool, hot tub, sauna and movie room, near Camelback, Kalahari and Shawnee Mountain. No service fee.',
  applicationName: SITE.brand,
  openGraph: { siteName: SITE.brand, type: 'website', images: ['/media/hero-end.jpg'] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1F3A2E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jost.variable} ${cormorant.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
