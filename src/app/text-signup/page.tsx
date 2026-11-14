import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TextSignupForm } from '@/components/legal/TextSignupForm';
import { SITE } from '@/data/site';

export const metadata: Metadata = {
  title: { absolute: `Text Sign-Up | ${SITE.brand}` },
  description: `Leave your name, email and phone number with ${SITE.brand}, and choose whether to get text messages about your Poconos stay.`,
  alternates: { canonical: '/text-signup' },
};

/**
 * /text-signup: the sign-in form (name, email, phone, the two optional
 * text-message boxes, Privacy and Terms links) in the page body, with no
 * pop-up, chat or timer, so carriers and their scanners can read the
 * opt-in at a plain address. It sends to the same place as the chat's form.
 */
export default function TextSignupPage() {
  return (
    <>
      <Header />
      <main id="main" className="container signup">
        <h1>Stay in touch</h1>
        <p className="signup-intro">
          Leave your details and the {SITE.brand} team will help you plan your Poconos stay. Text messages are optional.
        </p>
        <TextSignupForm />
      </main>
      <Footer />
    </>
  );
}
