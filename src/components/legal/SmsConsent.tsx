import Link from 'next/link';
import { SITE } from '@/data/site';
import type { SmsConsent } from '@/lib/chat/shared';

/**
 * The two text-message consent boxes shown directly under every phone field
 * (the chat's sign-in and the welcome offer). Phone carriers read this when
 * they review the number we text from, so:
 *   - both boxes start unticked and neither is needed to send the form;
 *   - marketing and non-marketing texts are agreed to separately;
 *   - each line names the business, says frequency varies and rates may
 *     apply, and gives HELP and STOP;
 *   - the Privacy Policy and Terms links sit directly below.
 * Keep the wording word for word, and in step with "Text messages" on
 * /terms. The links open in a new tab so a half-filled form isn't lost.
 */

const sender = `${SITE.brand} (${SITE.legalName})`;
const tail = 'Message frequency varies. Message & data rates may apply. Reply HELP for help or STOP to opt out.';

export const SMS_CONSENT_TEXT = {
  nonMarketing: `I consent to receive non-marketing text messages from ${sender} about my inquiry, quote and booking. ${tail}`,
  marketing: `I consent to receive marketing and promotional text messages from ${sender}, including offers and open dates. ${tail}`,
};

export function SmsConsentBoxes({ value, onChange, className = '' }: { value: SmsConsent; onChange: (next: SmsConsent) => void; className?: string }) {
  return (
    <fieldset className={`sms-consent ${className}`.trim()}>
      <legend className="sr-only">Text messages (optional)</legend>
      <label className="sms-box">
        <input type="checkbox" checked={value.smsNonMarketing} onChange={(e) => onChange({ ...value, smsNonMarketing: e.target.checked })} />
        <span>{SMS_CONSENT_TEXT.nonMarketing}</span>
      </label>
      <label className="sms-box">
        <input type="checkbox" checked={value.smsMarketing} onChange={(e) => onChange({ ...value, smsMarketing: e.target.checked })} />
        <span>{SMS_CONSENT_TEXT.marketing}</span>
      </label>
      <p className="sms-links">
        <Link href="/privacy" target="_blank">
          Privacy Policy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" target="_blank">
          Terms
        </Link>
      </p>
    </fieldset>
  );
}
