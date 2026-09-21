import type { ReactNode } from 'react';
import { cn } from '@/lib/util/cn';

type Tone = 'info' | 'warning' | 'critical';

const tones: Record<Tone, string> = {
  info: 'border-[var(--color-line-strong)] bg-[var(--color-canvas-sunk)] text-[var(--color-ink-muted)]',
  warning: 'border-[oklch(0.82_0.09_75)] bg-[oklch(0.97_0.035_75)] text-[oklch(0.42_0.08_60)]',
  critical:
    'border-[oklch(0.78_0.1_25)] bg-[var(--color-critical-soft)] text-[var(--color-critical)]',
};

export function Alert({
  tone = 'info',
  title,
  className,
  children,
}: {
  tone?: Tone;
  title?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={cn('rounded-[var(--radius-md)] border px-4 py-3.5 text-sm', tones[tone], className)}
    >
      {title ? <p className="font-medium text-current">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1 opacity-90')}>{children}</div> : null}
    </div>
  );
}
