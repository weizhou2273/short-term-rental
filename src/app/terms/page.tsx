import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BRAND_OF, BusinessContact } from '@/components/legal/BusinessContact';
import { SITE } from '@/data/site';

export const metadata: Metadata = {
  title: { absolute: `Terms & Conditions | ${SITE.brand}` },
  description: `The terms for using ${SITE.domain}, booking a ${SITE.brand} vacation home in the Poconos, our offers, and our text messages.`,
  alternates: { canonical: '/terms' },
};

const EFFECTIVE = 'November 14, 2026';
const PHONE_HREF = `tel:${SITE.contactPhone.replace(/[^\d+]/g, '')}`;
/** "+1 929-500-4160" as "(929) 500-4160". */
const PHONE_TEXT = SITE.contactPhone.replace(/^\+1 (\d{3})-/, '($1) ');

const Email = () => <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
const Phone = () => <a href={PHONE_HREF}>{PHONE_TEXT}</a>;

/**
 * /terms: the website's terms, including the text-message program that
 * phone carriers check when they verify the number we text from. The "Text
 * messages" section must keep: the program name with the legal name, the
 * kinds of messages, "frequency varies", "rates may apply", STOP and HELP,
 * the support contact, "not a condition of booking", the no-sharing sentence
 * and the link to /privacy. The two consent boxes under each phone field
 * (SmsConsentBoxes) say the same in short.
 */
export default function TermsPage() {
  const offer = SITE.welcomeOffer;
  return (
    <>
      <Header />
      <main id="main" className="container legal">
        <h1>Terms &amp; Conditions</h1>
        <p className="legal-meta">
          <strong>{SITE.brand}</strong> · Effective {EFFECTIVE}
        </p>
        <p>
          {SITE.brand} (“we”, “us”) rents vacation homes in the Pocono Mountains of Pennsylvania. {BRAND_OF}. These terms cover your use of{' '}
          {SITE.domain}, our offers and the messages we send you. By using the website you agree to them. If you have a question, email{' '}
          <Email /> or call or text <Phone />.
        </p>

        <h2>Using this website</h2>
        <ul>
          <li>
            We work to keep every home’s photos, description, amenities and rules accurate, but details can change. If something matters to
            your trip, ask us before you book.
          </li>
          <li>
            Prices and availability come live from our booking system and can change until your booking is confirmed. A price quote is not a
            reservation.
          </li>
          <li>Please use the website only to look at our homes, contact us and book a stay, and don’t interfere with how it works.</li>
        </ul>

        <h2>Booking a stay</h2>
        <ul>
          <li>
            Bookings and payments are made on the secure checkout of our booking provider, Hospitable, and its payment processor. We don’t
            take card details on {SITE.domain}.
          </li>
          <li>
            Each home’s page lists its house rules, check-in and check-out times, cancellation policy and, where it applies, the minimum age
            to book. They apply to your stay, together with any rental agreement you accept at checkout. If these terms and that agreement
            differ, the agreement applies.
          </li>
          <li>If you book one of our homes on Airbnb, Vrbo or Booking.com, that platform’s terms apply to the booking.</li>
        </ul>

        <h2>Offers and promo codes</h2>
        <p>
          {offer ? (
            <>
              Our welcome offer is {offer.percent}% off the nightly rate of your first stay
              {offer.minNights > 1 ? ` of ${offer.minNights} nights or more` : ''} booked directly on {SITE.domain}.{' '}
            </>
          ) : null}
          An offer’s own wording says what it covers. Codes apply to the nightly rate, not to cleaning fees or taxes, and work only for
          direct bookings on this website. We may change or end an offer at any time; a code already applied to a confirmed booking still
          counts.
        </p>

        <h2>Website chat</h2>
        <p>
          Our website chat is answered first by an automated assistant. It can make mistakes, so treat its answers as a guide: the price
          and availability shown at checkout, and what our team tells you, are what count. Our team may follow up on your chat by phone
          or email, and by text if you agreed to texts.
        </p>

        <h2 id="texts">Text messages</h2>
        <p>
          <strong>Program:</strong> {SITE.brand} texts, sent by {SITE.brand} ({SITE.legalName}).
        </p>
        <ul>
          <li>
            <strong>How you join:</strong> by ticking a text message box under the phone number field on a form on our website, such as
            the website chat or an offer sign-up, or by texting us first. The boxes are optional and start unticked, and there is one for
            each kind of message.
          </li>
          <li>
            <strong>What we send:</strong> non-marketing texts are replies to your questions, the quotes and offer codes you asked for,
            and details about your inquiry, booking and stay. Marketing texts are occasional offers and open dates.
          </li>
          <li>
            <strong>How often:</strong> message frequency varies with your conversation and booking.
          </li>
          <li>
            <strong>Cost:</strong> message and data rates may apply, depending on your mobile plan.
          </li>
          <li>
            <strong>To stop:</strong> reply <strong>STOP</strong> to any text. We’ll confirm, and send no more texts unless you sign up
            again.
          </li>
          <li>
            <strong>For help:</strong> reply <strong>HELP</strong>, or contact support at <Email /> or <Phone />.
          </li>
          <li>
            <strong>Not required:</strong> agreeing to receive texts is not a condition of booking a stay or buying anything.
          </li>
          <li>
            <strong>Your privacy:</strong> we do not share mobile phone numbers or text messaging consent with third parties or affiliates
            for marketing or promotional purposes. See our <Link href="/privacy">Privacy Policy</Link>.
          </li>
          <li>Mobile carriers are not responsible for delayed or undelivered messages.</li>
        </ul>

        <h2>Our content</h2>
        <p>
          The photos, videos, text and design on this website belong to {SITE.brand} or are used with permission. Please don’t copy or reuse
          them without asking us first.
        </p>

        <h2>Other websites and services</h2>
        <p>
          Our website links to and relies on services run by others, such as our booking provider’s checkout, maps and social media. Their
          own terms and privacy policies apply when you use them.
        </p>

        <h2>Our responsibility</h2>
        <p>
          We provide this website as it is and can’t promise it will always be available or free of errors. As far as the law allows, we
          aren’t responsible for losses that come from using the website or relying on it, beyond what we owe you under your booking.
          Nothing in these terms takes away rights you have under the law.
        </p>

        <h2>Changes to these terms</h2>
        <p>If we change these terms, we’ll post the new version here with a new effective date.</p>

        <h2>Contact us</h2>
        <BusinessContact />
      </main>
      <Footer />
    </>
  );
}
