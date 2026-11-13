import Link from 'next/link';
import { SITE } from '@/data/site';

/**
 * The text-message consent shown directly beside every phone field on the
 * site (the chat's sign-in and the welcome offer). Phone carriers read this
 * wording when they verify the number we text from, so keep every sentence,
 * and keep it in step with the "Text messages" section of /terms. The links
 * open in a new tab so a half-filled form isn't lost.
 */
export function SmsConsent({ className }: { className?: string }) {
  return (
    <p className={className}>
      By giving your phone number, you agree to receive text messages from {SITE.brand} about your inquiry, quote, booking and offers. Message
      frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of booking. See
      our{' '}
      <Link href="/terms" target="_blank">
        Terms
      </Link>{' '}
      and{' '}
      <Link href="/privacy" target="_blank">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
