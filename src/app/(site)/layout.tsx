import { SiteFooter } from '@/components/layout/SiteFooter';

/**
 * Shell for every public marketing page. The header is rendered per-page rather
 * than here, because pages that open with a full-bleed hero need the
 * transparent variant and the rest do not.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
