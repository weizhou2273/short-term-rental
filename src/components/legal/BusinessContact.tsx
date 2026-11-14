import { SITE } from '@/data/site';

/** "W&K Reserve is a brand of Wiki Store LLC": the legal name behind the brand, as the footer, terms and privacy policy state it. */
export const BRAND_OF = `${SITE.brand} is a brand of ${SITE.legalName}`;

const PHONE_HREF = `tel:${SITE.contactPhone.replace(/[^\d+]/g, '')}`;
/** "+1 929-500-4160" as "(929) 500-4160". */
const PHONE_TEXT = SITE.contactPhone.replace(/^\+1 (\d{3})-/, '($1) ');

/**
 * The business's contact details for the "Contact us" sections of the terms
 * and privacy policy: legal name, mailing address (once SITE.mailingAddress
 * is filled in), email and phone. Carriers check that these are public.
 */
export function BusinessContact() {
  return (
    <address>
      {SITE.legalName}, doing business as {SITE.brand}
      {(SITE.mailingAddress ?? []).map((line) => (
        <span key={line}>
          <br />
          {line}
        </span>
      ))}
      <br />
      Email: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
      <br />
      Phone or text: <a href={PHONE_HREF}>{PHONE_TEXT}</a>
    </address>
  );
}
