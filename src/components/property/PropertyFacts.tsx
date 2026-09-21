import type { Property } from '@/lib/booking/types';

export function PropertyFacts({ property }: { property: Property }) {
  const facts = [
    { label: 'Sleeps', value: String(property.capacity.maxGuests) },
    { label: 'Bedrooms', value: String(property.capacity.bedrooms) },
    { label: 'Beds', value: String(property.capacity.beds) },
    { label: 'Bathrooms', value: String(property.capacity.bathrooms) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="bg-[var(--color-surface)] px-4 py-5 text-center">
          <dt className="eyebrow">{fact.label}</dt>
          <dd className="mt-2 text-2xl tabular text-[var(--color-ink)]">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HouseRules({ property }: { property: Property }) {
  const rules = [
    { label: 'Check in', value: `From ${property.rules.checkInTime}` },
    { label: 'Check out', value: `By ${property.rules.checkOutTime}` },
    {
      label: 'Minimum stay',
      value: `${property.rules.minNights} night${property.rules.minNights === 1 ? '' : 's'}`,
    },
    { label: 'Pets', value: property.rules.petsAllowed ? 'Welcome, fee applies' : 'Not permitted' },
    { label: 'Events', value: property.rules.eventsAllowed ? 'By arrangement' : 'Not permitted' },
    { label: 'Smoking', value: property.rules.smokingAllowed ? 'Outdoors only' : 'Not permitted' },
    ...(property.rules.quietHours
      ? [{ label: 'Quiet hours', value: property.rules.quietHours }]
      : []),
  ];

  return (
    <dl className="divide-y divide-[var(--color-line)]">
      {rules.map((rule) => (
        <div key={rule.label} className="flex items-baseline justify-between gap-6 py-3.5">
          <dt className="text-sm text-[var(--color-ink-muted)]">{rule.label}</dt>
          <dd className="text-right text-sm text-[var(--color-ink)]">{rule.value}</dd>
        </div>
      ))}
    </dl>
  );
}
