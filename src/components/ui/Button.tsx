import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/util/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-all duration-200 ease-[var(--ease-out-quint)] disabled:pointer-events-none disabled:opacity-45';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-ink)] text-[var(--color-canvas)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-lift)] hover:shadow-[var(--shadow-float)]',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line-strong)] hover:border-[var(--color-ink)]',
  ghost:
    'text-[var(--color-ink)] border border-transparent hover:bg-[var(--color-canvas-sunk)]',
  quiet:
    'text-[var(--color-ink-muted)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:text-[var(--color-ink)] hover:decoration-[var(--color-accent)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[0.8125rem] rounded-[var(--radius-sm)]',
  md: 'h-11 px-6 text-sm rounded-[var(--radius-sm)]',
  lg: 'h-14 px-8 text-[0.9375rem] rounded-[var(--radius-sm)]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(base, variants[variant], variant === 'quiet' ? '' : sizes[size], extra);
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({ variant, size, className, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
