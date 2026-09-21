import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compareIsoDates,
  dayOfWeek,
  formatStayRange,
  isIsoDate,
  nightsBetween,
  nightsInRange,
  startOfMonth,
} from '@/lib/util/date';

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-04-04')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects dates that do not exist', () => {
    // Date.parse would roll these over; the guard must not.
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('2025-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
  });

  it('rejects anything that is not a bare calendar date', () => {
    expect(isIsoDate('2026-4-4')).toBe(false);
    expect(isIsoDate('2026-04-04T10:00:00Z')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(20260404)).toBe(false);
  });
});

describe('nightsBetween', () => {
  it('counts nights, not days', () => {
    expect(nightsBetween('2026-04-04', '2026-04-07')).toBe(3);
  });

  it('is zero for a same-day range', () => {
    expect(nightsBetween('2026-04-04', '2026-04-04')).toBe(0);
  });

  it('is unaffected by daylight saving transitions', () => {
    // US DST begins 8 March 2026; a local-time implementation returns 6 or 8.
    expect(nightsBetween('2026-03-05', '2026-03-12')).toBe(7);
    // And ends 1 November 2026.
    expect(nightsBetween('2026-10-29', '2026-11-05')).toBe(7);
  });

  it('is negative when the range is inverted', () => {
    expect(nightsBetween('2026-04-07', '2026-04-04')).toBe(-3);
  });
});

describe('nightsInRange', () => {
  it('excludes the departure date, which is not slept in', () => {
    expect(nightsInRange('2026-04-04', '2026-04-07')).toEqual([
      '2026-04-04',
      '2026-04-05',
      '2026-04-06',
    ]);
  });

  it('returns nothing for an empty or inverted range', () => {
    expect(nightsInRange('2026-04-04', '2026-04-04')).toEqual([]);
    expect(nightsInRange('2026-04-07', '2026-04-04')).toEqual([]);
  });

  it('crosses month and year boundaries', () => {
    expect(nightsInRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ]);
  });
});

describe('addDays', () => {
  it('handles leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('goes backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('addMonths', () => {
  it('clamps rather than rolling over a short month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('crosses years', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('misc helpers', () => {
  it('reports the UTC weekday', () => {
    expect(dayOfWeek('2026-04-04')).toBe(6); // Saturday
  });

  it('finds the start of the month', () => {
    expect(startOfMonth('2026-04-17')).toBe('2026-04-01');
  });

  it('orders dates lexically, which matches chronologically for ISO', () => {
    expect(compareIsoDates('2026-04-04', '2026-04-07')).toBe(-1);
    expect(compareIsoDates('2026-04-07', '2026-04-04')).toBe(1);
    expect(compareIsoDates('2026-04-04', '2026-04-04')).toBe(0);
  });

  it('formats a stay range compactly when the month is shared', () => {
    expect(formatStayRange('2026-04-04', '2026-04-07')).toBe('Apr 4 – 7, 2026');
    expect(formatStayRange('2026-04-28', '2026-05-03')).toBe('Apr 28 – May 3, 2026');
    expect(formatStayRange('2026-12-30', '2027-01-02')).toBe(
      'December 30, 2026 – January 2, 2027',
    );
  });
});
