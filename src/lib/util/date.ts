/**
 * Stay dates are calendar dates, not instants. A guest checking in on the 4th
 * checks in on the 4th regardless of the server's timezone, so every date in
 * the booking path is carried as an ISO `YYYY-MM-DD` string and all arithmetic
 * is done in UTC. Constructing `new Date('2026-04-04')` parses as UTC midnight;
 * never use the local-time constructor for these.
 */

export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return false;
  // Rejects impossible dates that `Date.parse` would roll over (e.g. 2026-02-31).
  return toIsoDate(new Date(time)) === value;
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: IsoDate): Date {
  if (!isIsoDate(value)) throw new RangeError(`Not a calendar date: ${value}`);
  return new Date(`${value}T00:00:00Z`);
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * MS_PER_DAY));
}

/**
 * Nights between check-in and check-out. Hospitality counts nights, not days:
 * arriving the 4th and leaving the 7th is three nights.
 */
export function nightsBetween(from: IsoDate, to: IsoDate): number {
  const diff = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/** Every night occupied by a stay — check-out day excluded, as it is not slept in. */
export function nightsInRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const count = nightsBetween(from, to);
  if (count <= 0) return [];
  const out: IsoDate[] = [];
  for (let i = 0; i < count; i += 1) out.push(addDays(from, i));
  return out;
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return compareIsoDates(a, b) < 0;
}

export function isAfter(a: IsoDate, b: IsoDate): boolean {
  return compareIsoDates(a, b) > 0;
}

/** The weekday of a calendar date, 0 = Sunday, evaluated in UTC. */
export function dayOfWeek(value: IsoDate): number {
  return parseIsoDate(value).getUTCDay();
}

export function startOfMonth(value: IsoDate): IsoDate {
  return `${value.slice(0, 7)}-01`;
}

export function addMonths(value: IsoDate, months: number): IsoDate {
  const date = parseIsoDate(value);
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  // Clamp the day so 31 Jan + 1 month lands on 28/29 Feb rather than rolling into March.
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return toIsoDate(target);
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatLongDate(value: IsoDate): string {
  return LONG_DATE.format(parseIsoDate(value));
}

export function formatShortDate(value: IsoDate): string {
  return SHORT_DATE.format(parseIsoDate(value));
}

export function formatMonthLabel(value: IsoDate): string {
  return MONTH_LABEL.format(parseIsoDate(value));
}

/** "Apr 4 – 7, 2026" style range used across cards and the checkout summary. */
export function formatStayRange(from: IsoDate, to: IsoDate): string {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${SHORT_DATE.format(start)} – ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${SHORT_DATE.format(start)} – ${SHORT_DATE.format(end)}, ${end.getUTCFullYear()}`;
  }
  return `${formatLongDate(from)} – ${formatLongDate(to)}`;
}
