import type { Quote } from '@/lib/booking/types';
import { formatLongDate } from '@/lib/util/date';
import { formatMoney } from '@/lib/util/money';
import { cn } from '@/lib/util/cn';

/**
 * The itemised receipt. Shown identically on the property page and at checkout
 * so the number never changes shape between "what it costs" and "what you pay".
 */
export function QuoteSummary({
  quote,
  className,
  showSchedule = true,
}: {
  quote: Quote;
  className?: string;
  showSchedule?: boolean;
}) {
  return (
    <div className={cn('text-sm', className)}>
      <dl className="space-y-3">
        {quote.lines.map((line, index) => (
          <div key={`${line.kind}-${line.label}-${index}`} className="flex items-baseline justify-between gap-6">
            <dt className="text-[var(--color-ink-muted)]">
              {line.label}
              {line.detail ? (
                <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">
                  {line.detail}
                </span>
              ) : null}
            </dt>
            <dd
              className={cn(
                'shrink-0 tabular',
                line.kind === 'discount'
                  ? 'text-[var(--color-positive)]'
                  : 'text-[var(--color-ink)]',
              )}
            >
              {formatMoney(line.amount)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="rule mt-4 flex items-baseline justify-between pt-4">
        <p className="font-medium text-[var(--color-ink)]">Total</p>
        <p className="text-lg font-medium tabular text-[var(--color-ink)]">
          {formatMoney(quote.total)}
        </p>
      </div>

      {quote.securityDeposit && quote.securityDeposit.amount > 0 ? (
        <p className="mt-2 flex items-baseline justify-between text-xs text-[var(--color-ink-faint)]">
          <span>Refundable damage hold</span>
          <span className="tabular">{formatMoney(quote.securityDeposit)}</span>
        </p>
      ) : null}

      {showSchedule && quote.schedule.balance && quote.schedule.balanceDueDate ? (
        <div className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-canvas-sunk)] p-3.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
          <p className="flex items-baseline justify-between">
            <span className="font-medium text-[var(--color-ink)]">Due today</span>
            <span className="tabular font-medium text-[var(--color-ink)]">
              {formatMoney(quote.schedule.dueNow)}
            </span>
          </p>
          <p className="mt-1.5 flex items-baseline justify-between">
            <span>Balance on {formatLongDate(quote.schedule.balanceDueDate)}</span>
            <span className="tabular">{formatMoney(quote.schedule.balance)}</span>
          </p>
        </div>
      ) : null}

      {quote.estimated ? (
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          Estimated. Final pricing is confirmed at checkout.
        </p>
      ) : null}
    </div>
  );
}
