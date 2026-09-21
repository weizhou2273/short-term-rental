import type { ReactNode } from 'react';
import { cn } from '@/lib/util/cn';
import { Container } from './Container';

type SectionProps = {
  eyebrow?: string;
  title?: ReactNode;
  lede?: ReactNode;
  /** Right-aligned action, e.g. a "view all" link. */
  action?: ReactNode;
  size?: 'narrow' | 'default' | 'wide' | 'full';
  className?: string;
  headerClassName?: string;
  children: ReactNode;
};

export function Section({
  eyebrow,
  title,
  lede,
  action,
  size = 'default',
  className,
  headerClassName,
  children,
}: SectionProps) {
  const hasHeader = Boolean(eyebrow || title || lede || action);
  return (
    <section className={cn('py-20 sm:py-28', className)}>
      <Container size={size}>
        {hasHeader ? (
          <div
            className={cn(
              'mb-12 flex flex-col gap-6 sm:mb-16 sm:flex-row sm:items-end sm:justify-between',
              headerClassName,
            )}
          >
            <div className="max-w-2xl">
              {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
              {title ? (
                <h2 className="display text-[clamp(1.875rem,4vw,2.75rem)]">{title}</h2>
              ) : null}
              {lede ? (
                <p className="mt-5 text-[1.0625rem] leading-relaxed text-[var(--color-ink-muted)]">
                  {lede}
                </p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
