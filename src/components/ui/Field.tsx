'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/util/cn';

const controlBase =
  'w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3.5 text-[0.9375rem] text-[var(--color-ink)] transition-colors duration-200 placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50';

type FieldShellProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

/**
 * Wraps a control with its label, hint and error, wiring `aria-describedby` and
 * `aria-invalid` correctly. Doing this once here is what keeps the checkout
 * accessible as fields are added.
 */
export function FieldShell({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[0.8125rem] font-medium text-[var(--color-ink)]">
        {label}
        {required ? <span className="ml-1 text-[var(--color-critical)]">*</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-[var(--color-ink-faint)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[var(--color-critical)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={rest.required}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            controlBase,
            'h-11',
            invalid ? 'border-[var(--color-critical)]' : 'border-[var(--color-line-strong)]',
            className,
          )}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextAreaField({
  label,
  error,
  hint,
  className,
  ...rest
}: TextAreaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={rest.required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            controlBase,
            'min-h-28 py-3 leading-relaxed',
            invalid ? 'border-[var(--color-critical)]' : 'border-[var(--color-line-strong)]',
            className,
          )}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
