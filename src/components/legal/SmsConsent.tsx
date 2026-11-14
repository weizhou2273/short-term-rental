import Link from 'next/link';
import { SITE } from '@/data/site';
import type { SmsConsent } from '@/lib/chat/shared';

/**
 * The two text-message consent boxes shown directly under every phone field
 * (the chat's sign-in, the welcome offer and /text-signup). Phone carriers,
 * and the scanners that pre-check a site for them, read this, so:
 *   - both boxes start unticked and neither is needed to send the form;
 *   - marketing and non-marketing texts are agreed to separately;
 *   - each sentence names the business with its legal name first, as on the
 *     carrier registration, says frequency varies and rates may apply, and
 *     gives HELP and STOP;
 *   - the Privacy Policy and Terms links sit directly below.
 *
 * Keep the markup this plain, because scanners read it literally: each
 * checkbox has an id, and its sentence is the text of a <label for> with
 * nothing nested inside. No fieldset, legend or span. Keep the wording word
 * for word, and in step with "Text messages" on /terms. The links open in a
 * new tab so a half-filled form isn't lost.
 */

const sender = `${SITE.legalName} (${SITE.brand})`;
const tail = 'Message frequency varies. Message & data rates may apply. Reply HELP for help or STOP to opt out.';

export const SMS_CONSENT_TEXT = {
  nonMarketing: `I consent to receive non-marketing text messages from ${sender} about my inquiry, quote and booking. ${tail}`,
  marketing: `I consent to receive marketing and promotional text messages from ${sender}, including offers and open dates. ${tail}`,
};

export function SmsConsentBoxes({
  idPrefix,
  value,
  onChange,
  className = '',
}: {
  /** Makes the checkbox ids unique when more than one form is on the page: "chat", "offer", "signup". */
  idPrefix: string;
  value: SmsConsent;
  onChange: (next: SmsConsent) => void;
  className?: string;
}) {
  const nonMarketingId = `${idPrefix}-sms-non-marketing`;
  const marketingId = `${idPrefix}-sms-marketing`;
  return (
    <div className={`sms-consent ${className}`.trim()}>
      <div className="sms-box">
        <input
          type="checkbox"
          id={nonMarketingId}
          name="smsNonMarketing"
          checked={value.smsNonMarketing}
          onChange={(e) => onChange({ ...value, smsNonMarketing: e.target.checked })}
        />
        <label htmlFor={nonMarketingId}>{SMS_CONSENT_TEXT.nonMarketing}</label>
      </div>
      <div className="sms-box">
        <input
          type="checkbox"
          id={marketingId}
          name="smsMarketing"
          checked={value.smsMarketing}
          onChange={(e) => onChange({ ...value, smsMarketing: e.target.checked })}
        />
        <label htmlFor={marketingId}>{SMS_CONSENT_TEXT.marketing}</label>
      </div>
      <p className="sms-links">
        <Link href="/privacy" target="_blank">
          Privacy Policy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" target="_blank">
          Terms
        </Link>
      </p>
    </div>
  );
}
