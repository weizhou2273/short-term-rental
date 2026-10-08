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

/** Minimum nights required when arriving on `checkin`, if Hospitable set one. */
export function minStayFor(checkin: string, map: DayMap): number | null {
  const min = map.get(checkin)?.minStay;
  return min && min > 1 ? min : null;
}
