import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { site } from '@/lib/config/site';
import { siteUrl } from '@/lib/config/metadata';
import { OrganizationJsonLd } from '@/components/seo/JsonLd';
import './globals.css';

/**
 * Self-hosted via `next/font` so there is no render-blocking request to a font
 * CDN and no layout shift — both of which show up directly in Core Web Vitals,
 * which is what an independent site trades on against the OTAs.
 */
const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.legalName }],
  formatDetection: { telephone: true, address: false, email: false },
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: 'en_US',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#faf8f4',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-[var(--color-ink)] focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        {children}
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
