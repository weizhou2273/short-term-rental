import type { CalendarDay } from './types';
import { addDays, nightsBetween } from '@/lib/dates';

/**
 * Date-picker rules derived from Hospitable's calendar. A day's status is
 * about the *night* that starts on it, so:
 *   - check-in on D needs night D free and D open for check-in;
 *   - check-out on D needs every night from check-in to D-1 free, D open for
 *     check-out (D itself may be someone else's arrival), and the stay to meet
 *     the check-in day's minimum.
 * Days not loaded yet are treated as possible; the quote is the final check.
 */

export type DayMap = Map<string, CalendarDay>;

export function toDayMap(days: CalendarDay[]): DayMap {
  return new Map(days.map((d) => [d.date, d]));
}

export function canCheckIn(date: string, map: DayMap, today: string): boolean {
  if (date < today) return false;
  const day = map.get(date);
  if (!day) return true;
  return day.available && !day.closedForCheckin;
}

export function canCheckOut(checkin: string, date: string, map: DayMap): boolean {
  const nights = nightsBetween(checkin, date);
  if (nights < 1) return false;

  const minStay = map.get(checkin)?.minStay ?? 1;
  if (nights < minStay) return false;

  for (let i = 0; i < nights; i++) {
    const night = map.get(addDays(checkin, i));
    if (night && !night.available) return false;
  }
  const out = map.get(date);
  return !out?.closedForCheckout;
}

/**
 * The first stay of `nights` nights — or the check-in day's minimum, if longer —
 * starting on or after `from` that the loaded calendar allows. Only stays whose
 * every night is loaded count, so an unknown day is never offered.
 */
export function firstOpenStay(days: CalendarDay[], from: string, nights = 2): { checkin: string; checkout: string; nights: number } | null {
  const map = toDayMap(days);
  for (const day of days) {
    if (day.date < from || !canCheckIn(day.date, map, from)) continue;
    const length = Math.max(nights, day.minStay ?? 1);
    const checkout = addDays(day.date, length);
    if (!map.has(addDays(checkout, -1))) break;
    if (canCheckOut(day.date, checkout, map)) return { checkin: day.date, checkout, nights: length };
  }
  return null;
}

/** Minimum nights required when arriving on `checkin`, if Hospitable set one. */
export function minStayFor(checkin: string, map: DayMap): number | null {
  const min = map.get(checkin)?.minStay;
  return min && min > 1 ? min : null;
}
