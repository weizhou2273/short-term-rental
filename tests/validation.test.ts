import { describe, expect, it } from 'vitest';
import { validateStay, bookingRequestSchema, inquirySchema, stayRequestSchema } from '@/lib/booking/validation';
import type { AvailabilityCalendar, Property } from '@/lib/booking/types';
import { demoProperties } from '@/lib/demo/properties';
import { addDays, nightsInRange, today } from '@/lib/util/date';

const property = demoProperties[0]!; // 6 guests, 2-night min, pets allowed
const base = addDays(today(), 30);
const guests = { adults: 2, children: 0, infants: 0, pets: 0 };

function calendarWith(overrides: Record<string, 'available' | 'booked'> = {}): AvailabilityCalendar {
  const from = today();
  const to = addDays(from, 120);
  return {
    propertyId: property.id,
    from,
    to,
    nights: nightsInRange(from, to).map((date) => {
      const status = overrides[date] ?? 'available';
      return {
        date,
        status,
        rate: null,
        minNights: null,
        canCheckIn: status === 'available',
        canCheckOut: status === 'available',
      };
    }),
  };
}

describe('validateStay', () => {
  it('accepts a clean stay', () => {
    const issues = validateStay({
      property,
      arrival: base,
      departure: addDays(base, 3),
      guests,
      calendar: calendarWith(),
    });
    expect(issues).toEqual([]);
  });

  it('rejects arrival in the past', () => {
    const issues = validateStay({
      property,
      arrival: addDays(today(), -1),
      departure: addDays(today(), 3),
      guests,
    });
    expect(issues.some((issue) => issue.field === 'arrival')).toBe(true);
  });

  it('rejects a departure on or before arrival', () => {
    expect(
      validateStay({ property, arrival: base, departure: base, guests }),
    ).toHaveLength(1);
    expect(
      validateStay({ property, arrival: base, departure: addDays(base, -1), guests }),
    ).toHaveLength(1);
  });

  it('enforces the property minimum', () => {
    const issues = validateStay({
      property,
      arrival: base,
      departure: addDays(base, 1),
      guests,
    });
    expect(issues[0]!.message).toContain('2-night minimum');
  });

  it('lets the calendar raise the minimum above the property default', () => {
    const calendar = calendarWith();
    for (const night of calendar.nights) {
      if (night.date === base) night.minNights = 5;
    }
    const issues = validateStay({
      property,
      arrival: base,
      departure: addDays(base, 3),
      guests,
      calendar,
    });
    expect(issues[0]!.message).toContain('5-night minimum');
  });

  it('enforces the maximum stay', () => {
    const issues = validateStay({
      property,
      arrival: base,
      departure: addDays(base, 40), // cap is 28
      guests,
    });
    expect(issues.some((issue) => issue.message.includes('capped at 28'))).toBe(true);
  });

  it('enforces occupancy, counting adults and children but not infants', () => {
    expect(
      validateStay({
        property,
        arrival: base,
        departure: addDays(base, 3),
        guests: { adults: 4, children: 2, infants: 3, pets: 0 },
      }),
    ).toEqual([]);

    const over = validateStay({
      property,
      arrival: base,
      departure: addDays(base, 3),
      guests: { adults: 5, children: 2, infants: 0, pets: 0 },
    });
    expect(over.some((issue) => issue.field === 'guests')).toBe(true);
  });

  it('rejects pets where the house does not take them', () => {
    const noPets: Property = {
      ...property,
      rules: { ...property.rules, petsAllowed: false },
    };
    const issues = validateStay({
      property: noPets,
      arrival: base,
      departure: addDays(base, 3),
      guests: { ...guests, pets: 1 },
    });
    expect(issues.some((issue) => issue.message.includes('cannot take pets'))).toBe(true);
  });

  it('rejects a range that straddles a booked night', () => {
    const calendar = calendarWith({ [addDays(base, 1)]: 'booked' });
    const issues = validateStay({
      property,
      arrival: base,
      departure: addDays(base, 3),
      guests,
      calendar,
    });
    expect(issues.some((issue) => issue.message.includes('already taken'))).toBe(true);
  });

  it('ignores the departure night, which is not slept in', () => {
    // Arriving on the 30th and leaving on the 33rd does not occupy the 33rd.
    const calendar = calendarWith({ [addDays(base, 3)]: 'booked' });
    const issues = validateStay({
      property,
      arrival: base,
      departure: addDays(base, 3),
      guests,
      calendar,
    });
    expect(issues.some((issue) => issue.message.includes('already taken'))).toBe(false);
  });

  it('treats nights outside the fetched window as unknown, not unavailable', () => {
    const calendar = calendarWith();
    const far = addDays(today(), 200); // beyond the 120-day calendar
    const issues = validateStay({
      property,
      arrival: far,
      departure: addDays(far, 3),
      guests,
      calendar,
    });
    expect(issues).toEqual([]);
  });
});

describe('request schemas', () => {
  it('rejects an inverted stay request', () => {
    const result = stayRequestSchema.safeParse({
      propertyId: 101,
      arrival: addDays(base, 3),
      departure: base,
      guests,
    });
    expect(result.success).toBe(false);
  });

  it('defaults the guest count when omitted', () => {
    const result = stayRequestSchema.safeParse({
      propertyId: 101,
      arrival: base,
      departure: addDays(base, 2),
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.guests.adults).toBe(2);
  });

  it('requires the terms checkbox on a booking', () => {
    const payload = {
      propertySlug: 'the-glass-barn',
      arrival: base,
      departure: addDays(base, 3),
      guests,
      guest: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '+1 555 0100',
      },
      acceptedTerms: false,
    };
    expect(bookingRequestSchema.safeParse(payload).success).toBe(false);
    expect(
      bookingRequestSchema.safeParse({ ...payload, acceptedTerms: true }).success,
    ).toBe(true);
  });

  it('normalises the guest email to lower case', () => {
    const result = bookingRequestSchema.safeParse({
      propertySlug: 'the-glass-barn',
      arrival: base,
      departure: addDays(base, 3),
      guests,
      guest: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: '  Ada@Example.COM ',
        phone: '+1 555 0100',
      },
      acceptedTerms: true,
    });
    expect(result.success && result.data.guest.email).toBe('ada@example.com');
  });

  it('accepts international phone formats', () => {
    for (const phone of ['+44 20 7946 0958', '(555) 014-2200', '+1.555.014.2200']) {
      const result = bookingRequestSchema.safeParse({
        propertySlug: 'x',
        arrival: base,
        departure: addDays(base, 3),
        guests,
        guest: { firstName: 'A', lastName: 'B', email: 'a@b.com', phone },
        acceptedTerms: true,
      });
      expect(result.success, phone).toBe(true);
    }
  });

  it('accepts an empty honeypot but keeps a filled one visible to the handler', () => {
    const payload = {
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Is the road passable in February?',
    };
    expect(inquirySchema.safeParse(payload).success).toBe(true);
    expect(inquirySchema.safeParse({ ...payload, company: 'spam' }).success).toBe(false);
  });
});
