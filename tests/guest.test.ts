import { describe, expect, it } from 'vitest';
import { isValidEmail, normalizePhone, validateGuestDetails } from '@/lib/booking/guest';

describe('normalizePhone', () => {
  it.each([
    ['(570) 555-0123', '+15705550123'],
    ['570.555.0123', '+15705550123'],
    ['1 570 555 0123', '+15705550123'],
    ['+1 570-555-0123', '+15705550123'],
    ['+44 20 7946 0958', '+442079460958'],
    ['  +61 2 9374 4000 ', '+61293744000'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    '',
    '555-0123', // too short
    '070 555 0123', // US area code can't start with 0
    '570 155 0123', // US exchange can't start with 1
    '+0 20 7946 0958',
    '+1234567890123456', // longer than E.164
    '44 20 7946 0958', // international without +
    'call me',
    '570-555-0123 ext 4',
    '+1 570 555 0123 +1',
  ])('rejects %j', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('isValidEmail', () => {
  it.each(['guest@example.com', 'first.last+stay@mail.co.uk', ' padded@example.org '])('accepts %j', (v) => {
    expect(isValidEmail(v)).toBe(true);
  });

  it.each(['', 'guest', 'guest@', 'guest@example', 'guest@example.c', 'two@@example.com', 'sp ace@example.com', `${'a'.repeat(250)}@example.com`])(
    'rejects %j',
    (v) => {
      expect(isValidEmail(v)).toBe(false);
    },
  );
});

describe('validateGuestDetails', () => {
  it('passes complete details', () => {
    expect(validateGuestDetails({ firstName: 'Kelsey', lastName: 'Yu', email: 'k@example.com', phone: '570 555 0123' })).toEqual({});
  });

  it('names each missing or invalid field', () => {
    const errors = validateGuestDetails({ firstName: ' ', lastName: '', email: 'nope', phone: '123' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'firstName', 'lastName', 'phone']);
  });
});
