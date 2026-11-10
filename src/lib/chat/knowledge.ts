import { GUIDES, guideHomes, guidePath } from '@/data/guides';
import { PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';
import type { Property } from '@/data/types';
import { plural } from '@/lib/format';

/**
 * What the chat assistant knows: the same facts the pages show, rendered as
 * plain text from SITE, PROPERTIES and GUIDES, so editing a listing updates
 * the assistant too. Public facts only: no street address, coordinates,
 * Hospitable ids or review text.
 */

const attractionName = (id: string) => SITE.attractions.find((a) => a.id === id)?.name ?? id;

const baths = (n: number) => (Number.isInteger(n) ? plural(n, 'bath') : `${n} baths`);

export function propertyKnowledge(p: Property): string {
  const lines: string[] = [
    `## ${p.name}`,
    `Page: /stays/${p.slug}`,
    `${p.type} in ${p.location}. ${p.tagline}.`,
    `Sleeps up to ${p.guests} guests · ${plural(p.bedrooms, 'bedroom')} · ${plural(p.beds, 'bed')} · ${baths(p.baths)}.`,
    `Rating: ${p.rating.toFixed(2)} from ${p.reviewCount} Airbnb reviews.`,
  ];
  if (p.nearby.length) lines.push(`Near: ${p.nearby.map(attractionName).join(', ')}.`);
  if (p.neighborhood) lines.push(`Location: ${p.neighborhood} The exact address is sent after booking.`);
  lines.push('', 'About:', ...p.description);
  for (const d of p.details ?? []) lines.push(`- ${d.title}: ${d.text}`);
  lines.push('', 'Sleeping:', ...p.sleeping.map((s) => `- ${s.room}: ${s.beds}`));
  lines.push('', `Amenities: ${p.amenities.join(', ')}.`);
  lines.push(
    '',
    `Check-in ${p.rules.checkIn.toLowerCase()}; check-out ${p.rules.checkOut.toLowerCase()}.`,
    `House rules: ${p.rules.house.join('; ')}.`,
    `Cancellation: ${p.rules.cancellation}`,
  );
  if (p.faqs.length) lines.push('', 'FAQ:', ...p.faqs.map((f) => `- Q: ${f.q}\n  A: ${f.a}`));
  return lines.join('\n');
}

export function siteKnowledge(): string {
  const guides = GUIDES.filter((g) => guideHomes(g, PROPERTIES).length > 0).map((g) => `- ${g.title}: ${guidePath(g)}`);
  return [
    `# ${SITE.brand}`,
    `${SITE.tagline}. ${SITE.subline}`,
    `Website: https://${SITE.domain}. Phone and text: ${SITE.contactPhone}. Email: ${SITE.contactEmail}. Instagram: @${SITE.instagram}.`,
    `Every home has: ${SITE.everyEstate.join(', ')}.`,
    'Search every home by dates and group size: /search',
    '',
    'Guide pages:',
    ...guides,
    '',
    '# The homes',
    '',
    PROPERTIES.map(propertyKnowledge).join('\n\n'),
  ].join('\n');
}
