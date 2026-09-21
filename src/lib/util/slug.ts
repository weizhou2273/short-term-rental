/** URL-safe slug from a human name. Stable across runs so links do not churn. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Property slugs must be unique even when two homes share a name, so the
 * OwnerRez id is appended on collision rather than silently overwriting.
 */
export function uniqueSlug(base: string, id: number, taken: Set<string>): string {
  const slug = slugify(base) || `property-${id}`;
  if (!taken.has(slug)) {
    taken.add(slug);
    return slug;
  }
  const withId = `${slug}-${id}`;
  taken.add(withId);
  return withId;
}
