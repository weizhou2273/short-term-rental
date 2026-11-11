import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SITE } from '@/data/site';

export const metadata: Metadata = {
  title: { absolute: `Privacy Policy | ${SITE.brand}` },
  description: `What personal information ${SITE.brand} collects on ${SITE.domain}, in its forms and chat, and at its Poconos vacation homes, how it’s used, and your choices.`,
  alternates: { canonical: '/privacy' },
};

const EFFECTIVE = 'November 11, 2026';
const PHONE_HREF = `tel:${SITE.contactPhone.replace(/[^\d+]/g, '')}`;
/** "+1 929-500-4160" as "(929) 500-4160". */
const PHONE_TEXT = SITE.contactPhone.replace(/^\+1 (\d{3})-/, '($1) ');

const Email = () => <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
const Phone = () => <a href={PHONE_HREF}>{PHONE_TEXT}</a>;

/**
 * /privacy: the privacy policy. It describes what the site really does, so
 * keep it in step with the code: the trackers in src/components/analytics,
 * what the chat and the welcome offer store and send, the map's tiles, and
 * what the booking webhook sends to Meta. Meta's lead forms link here.
 */
export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="main" className="container legal">
        <h1>Privacy Policy</h1>
        <p className="legal-meta">
          <strong>{SITE.brand}</strong> · Effective {EFFECTIVE}
        </p>
        <p>
          {SITE.brand} (“we”, “us”) rents vacation homes in the Pocono Mountains of Pennsylvania. This policy explains what personal
          information we collect when you visit {SITE.domain}, contact us, fill in one of our forms, or stay at one of our homes, and how we
          use it. If you have a question, email <Email /> or call or text <Phone />.
        </p>

        <h2>What we collect</h2>
        <h3>Information you give us</h3>
        <ul>
          <li>
            <strong>Offers and sign-ups:</strong> your name, email address and phone number when you claim an offer (such as 5% off a direct
            booking) on our website or through a Facebook or Instagram form.
          </li>
          <li>
            <strong>Chat and messages:</strong> your name, phone number, email address and anything you write to us through the website
            chat, email, text, phone or a booking platform.
          </li>
          <li>
            <strong>Quotes and bookings:</strong> your stay dates, number of guests and pets, the details needed to make your reservation,
            and anything you tell us about your stay. Payment details go directly to our booking provider and its payment processor; we
            don’t see or store full card numbers.
          </li>
        </ul>
        <h3>Information collected automatically</h3>
        <ul>
          <li>
            <strong>Cookies and similar tools:</strong> we use the Meta Pixel and Meta Conversions API, Google Analytics and Metricool to
            understand how people use our website and to measure and improve our ads. These tools may record the pages you visit, the dates
            you search, the buttons you tap, your device and browser type, your approximate location, and an identifier for your browser.
          </li>
          <li>
            <strong>Browser storage:</strong> our website saves a few small items in your browser, such as an offer code you’ve claimed and
            the contact details and messages from your website chat, so it can apply the code when you check prices and you don’t have to
            start the chat over.
          </li>
          <li>
            <strong>Maps:</strong> the area map on each home’s page loads its map images from OpenStreetMap, which receives your IP address
            to do so.
          </li>
          <li>
            <strong>Server logs:</strong> our hosting provider keeps standard records such as IP address and the time of each request.
          </li>
        </ul>
        <h3>Information from others</h3>
        <ul>
          <li>
            <strong>Facebook and Instagram:</strong> when you submit one of our forms there, Meta sends us the answers you submit, some of
            which Meta may prefill from your profile.
          </li>
          <li>
            <strong>Booking platforms:</strong> if you book through Airbnb, Vrbo or Booking.com, that platform shares the details we need to
            host your stay. Its own privacy policy also applies.
          </li>
        </ul>
        <h3>At our homes</h3>
        <p>
          Some of our homes have exterior security cameras, for example at the front door or the backyard. Each home’s listing says where
          they are. There are never cameras inside our homes.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To answer your questions and send the price quote, offer code or other information you asked for.</li>
          <li>To make and manage your reservation, prepare the home and look after you during your stay.</li>
          <li>
            To send you open dates, seasonal offers and other news by email or text, when you’ve agreed to hear from us. You can stop at any
            time.
          </li>
          <li>
            To run, measure and improve our ads on Facebook, Instagram and Google, including showing ads to people who have visited our
            website.
          </li>
          <li>To keep our homes, guests and neighbors safe, prevent fraud, and meet our legal and tax obligations.</li>
        </ul>

        <h2>Texts and calls</h2>
        <p>
          If you give us your phone number and agree to hear from us, we may call or text you about your quote, your booking, and our offers
          and open dates. How often depends on your conversation with us. Message and data rates may apply. Reply <strong>STOP</strong> to
          stop texts or <strong>HELP</strong> for help, or contact us at <Email />.
        </p>
        <p>We do not sell or share your mobile number, or your agreement to receive texts, with anyone else for their own marketing.</p>

        <h2>Who we share it with</h2>
        <p>We don’t sell your personal information for money. We share it only as follows:</p>
        <ul>
          <li>
            <strong>Service providers</strong> that help us run our business. They include our booking and property management system
            (Hospitable) and its payment processor, our email providers (Google Workspace and Resend), our website host (Vercel), the
            service that runs our website chat assistant, the map shown on our website (OpenStreetMap), our social media and analytics tools
            (Meta, Google and Metricool), and any phone or text messaging service we use. They may use the information only to provide their
            services to us.
          </li>
          <li>
            <strong>Advertising partners:</strong> Meta and Google receive information from our website tools as described above. We also
            share a protected (hashed) version of contact details with Meta to measure which ads led to direct bookings, and may use it to
            show our ads to past guests and similar people, or to stop showing them ads. Under some state laws this can count as “sharing”
            for targeted advertising; see Your choices below.
          </li>
          <li>
            <strong>The people who care for our homes,</strong> such as cleaners and maintenance staff, but only what they need for your
            stay, such as your dates and number of guests.
          </li>
          <li>
            <strong>Booking platforms,</strong> when you book through them.
          </li>
          <li>
            <strong>When required:</strong> to comply with the law, respond to valid legal requests, protect anyone’s safety or property, or
            as part of a sale or transfer of our business.
          </li>
        </ul>

        <h2>Website chat</h2>
        <p>
          Our website chat is answered first by an automated assistant. Your messages are processed by the company that provides that
          assistant so it can reply. We keep a copy of each conversation, and our team may follow up by phone, text or email.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep booking records for as long as we need them for your stay and for tax, accounting and legal purposes, usually up to seven
          years. We keep marketing contacts until you unsubscribe or ask us to delete them. Chat and form records are kept for up to two
          years unless they become part of a booking.
        </p>

        <h2>How we protect it</h2>
        <p>
          We use reputable providers and limit access to the people who need it. No system is perfectly secure, so please don’t send
          sensitive information such as card numbers by chat, email or text.
        </p>

        <h2 id="your-choices">Your choices</h2>
        <ul>
          <li>
            <strong>Emails:</strong> reply “unsubscribe” to any marketing email, or use its unsubscribe link if it has one.
          </li>
          <li>
            <strong>Texts:</strong> reply STOP.
          </li>
          <li>
            <strong>Ads and cookies:</strong> you can block or delete cookies in your browser settings. You can also change your ad settings
            with Meta (Facebook and Instagram settings &gt; Ad preferences) and Google (
            <a href="https://myadcenter.google.com" target="_blank" rel="noopener noreferrer">
              myadcenter.google.com
            </a>
            ), and opt out of Google Analytics with Google’s browser add-on.
          </li>
          <li>
            <strong>Your information:</strong> you can ask to see, correct or delete the personal information we hold about you, or ask us
            not to use it for targeted advertising. Email <Email /> and we’ll respond within 45 days. We may need to confirm who you are
            first, and we may keep records we’re required to keep by law. We won’t treat you differently for making a request.
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          Our website and offers are meant for adults. You must be an adult to book a stay, and at least 25 at the homes that list that
          rule on their page. We don’t knowingly collect personal information from children under 13; if you think we have, contact us and
          we’ll delete it.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we change this policy, we’ll post the new version here with a new effective date. If the changes are significant, we’ll let you
          know by email or on our website.
        </p>

        <h2>Contact us</h2>
        <address>
          {SITE.brand}
          <br />
          Email: <Email />
          <br />
          Phone or text: <Phone />
        </address>
      </main>
      <Footer />
    </>
  );
}
