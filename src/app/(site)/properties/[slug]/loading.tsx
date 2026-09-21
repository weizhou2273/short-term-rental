import { Container } from '@/components/ui/Container';

/**
 * Skeleton matched to the real property layout so the page does not jump when
 * the data arrives — a mismatched skeleton is worse than none.
 */
export default function PropertyLoading() {
  return (
    <div className="pt-[72px]">
      <Container size="wide" className="pt-12 sm:pt-16">
        <div className="mb-8 space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--color-canvas-sunk)]" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-[var(--color-canvas-sunk)]" />
        </div>
        <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
          <div className="aspect-[4/3] animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-canvas-sunk)] sm:col-span-2 sm:row-span-2 sm:aspect-auto" />
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="hidden aspect-[4/3] animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-canvas-sunk)] sm:block"
            />
          ))}
        </div>
      </Container>

      <Container size="wide" className="py-14 sm:py-20">
        <div className="grid gap-x-16 gap-y-14 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-canvas-sunk)]" />
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="h-4 animate-pulse rounded bg-[var(--color-canvas-sunk)]"
                style={{ width: `${90 - index * 8}%` }}
              />
            ))}
          </div>
          <div className="h-[28rem] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-canvas-sunk)]" />
        </div>
      </Container>
    </div>
  );
}
