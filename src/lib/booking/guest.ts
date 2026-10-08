/**
 * Guest contact details and the guest-count breakdown, shared by the booking
 * card (to validate before Reserve) and /api/quote (to validate again before
 * anything reaches Hospitable). Plain functions rather than zod so the
 * browser bundle stays small.
 */

export type GuestDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type GuestDetailsErrors = Partial<Record<keyof GuestDetails, string>>;

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const MAX_INFANTS = 5;
export const MAX_PETS = 3;

export const PHONE_ERROR = 'Enter a valid phone number. Include the country code (e.g. +44) if it’s outside the US.';

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length <= EMAIL_MAX && EMAIL.test(v);
}

/**
 * Normalises a phone number to E.164 (`+15705551234`), or returns null.
 * Numbers without a `+` are read as US/Canada (10 digits, or 11 starting
 * with 1); anything else needs its country code.
 */
export function normalizePhone(value: string): string | null {
  const v = value.trim();
  if (!v || v.length > 32 || !/^\+?[\d\s().-]+$/.test(v)) return null;
  const digits = v.replace(/\D/g, '');

  if (v.startsWith('+')) {
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
    if (digits.startsWith('1')) return isNanp(digits.slice(1)) ? `+${digits}` : null;
    return `+${digits}`;
  }
  if (digits.length === 10 && isNanp(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1') && isNanp(digits.slice(1))) return `+${digits}`;
  return null;
}

/** US/Canada: 10 digits, area code and exchange can't start with 0 or 1. */
function isNanp(tenDigits: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(tenDigits);
}

export function validateGuestDetails(d: GuestDetails): GuestDetailsErrors {
  const errors: GuestDetailsErrors = {};
  if (!d.firstName.trim()) errors.firstName = 'Enter your first name.';
  else if (d.firstName.trim().length > NAME_MAX) errors.firstName = 'That name is too long.';
  if (!d.lastName.trim()) errors.lastName = 'Enter your last name.';
  else if (d.lastName.trim().length > NAME_MAX) errors.lastName = 'That name is too long.';
  if (!isValidEmail(d.email)) errors.email = 'Enter a valid email address.';
  if (!normalizePhone(d.phone)) errors.phone = PHONE_ERROR;
  return errors;
}
