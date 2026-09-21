import { site } from '@/lib/config/site';
import { Section } from '@/components/ui/Section';

/**
 * The commercial argument of the whole site: why book here rather than on an
 * OTA. Copy lives in `site.directBookingBenefits` so it can be reworded without
 * touching the layout.
 */
export function DirectBookingBenefits() {
  return (
    <Section
      eyebrow="Book direct"
      title="The same house, for less, with someone to call"
      lede="Every one of these homes appears on the major platforms. This is the only place it is offered without their fee attached."
      className="bg-[var(--color-canvas-sunk)]"
    >
      <ol className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3">
        {site.directBookingBenefits.map((benefit, index) => (
          <li key={benefit.title} className="bg-[var(--color-canvas)] p-8">
            <p className="text-xs tabular text-[var(--color-ink-faint)]">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="display mt-5 text-xl text-[var(--color-ink)]">{benefit.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {benefit.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
