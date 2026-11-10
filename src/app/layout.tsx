import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import { SITE } from '@/data/site';
import { SITE_URL } from '@/lib/seo';
import { MetaPixel } from '@/components/analytics/MetaPixel';
import { Metricool } from '@/components/analytics/Metricool';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { WelcomeOffer } from '@/components/offer/WelcomeOffer';
import { welcomeOffer } from '@/lib/offer/welcome';
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
  const offer = welcomeOffer();
  return (
    <html lang="en" className={`${jost.variable} ${cormorant.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        {/* Only the fact that a key is set reaches the page, never the key. */}
        {process.env.ANTHROPIC_API_KEY ? <ChatWidget /> : null}
        {/* Only when an offer is configured and email is set up; the code itself isn't in the page. */}
        {offer ? <WelcomeOffer percent={offer.percent} minNights={offer.minNights} /> : null}
        <MetaPixel />
        <Metricool />
      </body>
    </html>
  );
}
