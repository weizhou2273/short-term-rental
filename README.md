# Aerie — direct booking site

A high-end direct-booking website for a small short-term rental portfolio.
**OwnerRez** is the property-management system of record (properties, calendars,
rates, quotes, reservations). **WordPress** runs headless as the CMS for
editorial copy. Payments go through **Stripe** or **OwnerRez-hosted checkout**,
behind one interface, selected by configuration.

Built with Next.js (App Router), TypeScript and Tailwind CSS v4.

```bash
npm install
npm run dev          # http://localhost:3000
```

**It runs with no credentials.** With nothing configured, the site serves a
bundled demo portfolio — three properties, a synthetic availability calendar, a
working quote engine and local placeholder artwork. Every component is exercised
for real, so design, testing and CI never wait on an OwnerRez account.

---

## Contents

- [How the pieces fit](#how-the-pieces-fit)
- [Project layout](#project-layout)
- [The booking flow](#the-booking-flow)
- [Connecting OwnerRez](#connecting-ownerrez)
- [Connecting WordPress](#connecting-wordpress)
- [Payments](#payments)
- [Going to production](#going-to-production)
- [Commands](#commands)

---

## How the pieces fit

```
                 ┌──────────────────────────────┐
   Guest ───────▶│  Next.js (this repo)         │
                 │  · marketing + property pages│
                 │  · booking + checkout        │
                 │  · API routes / webhooks     │
                 └───┬─────────────┬────────────┘
                     │             │
        properties,  │             │  pages, posts,
        calendars,   │             │  per-property copy
        quotes,      │             │
        reservations │             │
                     ▼             ▼
            ┌────────────────┐  ┌──────────────────┐
            │   OwnerRez     │  │ WordPress (REST) │
            │   (v2 API)     │  │  headless        │
            └───────┬────────┘  └──────────────────┘
                    │
                    │ webhook → expire calendar cache
                    ▼
            Airbnb / Vrbo / Booking.com
```

**Who owns what.** OwnerRez owns anything that can be wrong in a way that costs
money: availability, rates, fees, taxes, reservations. WordPress owns the words.
Where they overlap — a headline, a description — the CMS wins if an editor has
filled it in, and OwnerRez is the fallback. Neither is allowed to take the site
down: every read degrades to bundled content and logs the failure.

**Why the calendar cache is short.** The worst failure a direct-booking site has
is selling a night that an OTA already sold. Two things prevent it: a 60-second
default cache on availability, and an OwnerRez webhook that expires the cache
for a property the moment anything changes. Beyond that, the stay is re-validated
against the live calendar immediately before payment is taken.

---

## Project layout

```
src/
├─ app/
│  ├─ (site)/               Public pages (header/footer shell)
│  │  ├─ page.tsx           Home
│  │  ├─ properties/        Index (URL-driven filters) + detail
│  │  ├─ book/[slug]/       Checkout, and the redirect return handler
│  │  ├─ booking/           Confirmation, for every outcome
│  │  ├─ journal/           WordPress posts
│  │  └─ [slug]/            WordPress pages (/about, /terms, …)
│  └─ api/
│     ├─ quote/             Price a stay (server-authoritative)
│     ├─ booking/           Start checkout → payment intent
│     ├─ booking/confirm/   Verify payment → create reservation
│     ├─ inquiry/           Contact form → OwnerRez inquiry
│     ├─ revalidate/        WordPress publish hook
│     └─ webhooks/          Stripe + OwnerRez
├─ lib/
│  ├─ ownerrez/             Client, schemas, mappers, services
│  ├─ wordpress/            Client, content services, HTML sanitiser
│  ├─ payments/             Provider interface + Stripe/OwnerRez adapters
│  ├─ booking/              Domain types, pricing, validation, draft tokens
│  ├─ config/               Environment, site brand, metadata
│  └─ util/                 Calendar dates, money, slugs
├─ components/              UI primitives, layout, property, booking, marketing
└─ hooks/                   useQuote

wordpress/
└─ aerie-headless-bridge/   Companion WordPress plugin (see below)
```

---

## The booking flow

The sequence is deliberate. Nothing the browser says about price or availability
is trusted, and a guest is never shown a payment field for a price that might
already be stale.

1. **Browse.** The property page is statically prerendered with ISR. The booking
   panel is a client component that reads dates from the URL, so a shared link
   like `?arrival=…&departure=…` prefills without giving up prerendering.

2. **Price.** Choosing dates calls `POST /api/quote`. The server validates the
   stay against house rules and the live calendar, then asks OwnerRez to price
   it. If OwnerRez is unreachable, a local engine returns an `estimated` quote
   so the guest still sees a number — flagged as such, and never chargeable.

3. **Start checkout.** `POST /api/booking` re-validates and **re-quotes from
   scratch**. The authoritative figures are signed into a short-lived
   [booking draft](#the-draft-token) and a payment intent is created. No
   reservation exists yet.

4. **Pay.** Stripe's Payment Element collects the card in an iframe served by
   Stripe — card data never reaches this origin, keeping PCI scope at SAQ A.
   OwnerRez-hosted checkout redirects instead.

5. **Confirm.** Two independent paths create the reservation, because either can
   arrive first:
   - the browser reporting success (`POST /api/booking/confirm`), and
   - the payment webhook, which is what saves a guest who closes the tab.

   Both verify the payment directly with the provider, check it covers the
   quoted amount, and are idempotent on the booking reference.

### The draft token

Checkout spans two requests, and the second must not be able to change what the
first agreed to. Rather than add a database for a few seconds of state, the
stay — property, dates, guests, total, amount due — is serialised, HMAC-signed
with `BOOKING_SIGNING_SECRET` and handed to the client. Tampering invalidates
the signature; the token expires in 45 minutes; and it is worthless without a
verified payment beside it, so exposing it to the browser is safe.

For Stripe the token also rides in the PaymentIntent's metadata (chunked, since
Stripe caps a metadata value at 500 characters), which is how the webhook can
create a reservation with no server-side session to consult.

---

## Connecting OwnerRez

1. In OwnerRez, go to **Settings → API → Access Tokens** and create a Personal
   Access Token.
2. Set `OWNERREZ_USERNAME` (the account login email) and `OWNERREZ_ACCESS_TOKEN`.
3. Restart. The demo portfolio disappears and live properties take its place.

### Webhook

Add a webhook in OwnerRez pointing at:

```
POST https://your-site.com/api/webhooks/ownerrez
```

Set `OWNERREZ_WEBHOOK_SECRET` to the same shared secret. The endpoint verifies
the signature in constant time and expires the cache tags for the affected
property. Without the secret it still works but logs a warning on every
delivery — acceptable while wiring up, not in production.

### A note on endpoint paths

The OwnerRez v2 API evolves and some routes differ per account tier. The
integration is built to absorb that:

- every response is parsed with a **tolerant schema** (unknown fields pass
  through, a malformed row is skipped rather than failing the whole response);
- a single bad listing cannot blank the homepage;
- every read falls back to demo content and logs the real error.

If a call 404s against your account, the path to change is in
`src/lib/ownerrez/` — one file per concern (`properties`, `availability`,
`quotes`, `bookings`), each a thin wrapper over `client.ts`. Verify paths
against the current OwnerRez API reference for your account before launch;
`quotes` and `payments/hosted` in particular vary by plan.

---

## Connecting WordPress

WordPress runs headless. It is never the public front end — a second set of URLs
would split SEO — so its own theme is irrelevant.

1. Set `WORDPRESS_API_URL` to the site origin (e.g. `https://cms.example.com`),
   **not** the `/wp-json` path.
2. Install the bundled plugin: copy `wordpress/aerie-headless-bridge/` into
   `wp-content/plugins/` and activate it.
3. Add to `wp-config.php`:

   ```php
   define('AERIE_FRONTEND_URL',     'https://your-site.com');
   define('AERIE_REVALIDATE_URL',   'https://your-site.com/api/revalidate');
   define('AERIE_REVALIDATE_SECRET', 'same value as REVALIDATE_SECRET');
   ```

### What the plugin does

- Registers a `property` post type carrying editorial copy for a home that
  already exists in OwnerRez. The link between the two systems is one field:
  the **OwnerRez property ID**.
- Exposes that and the other fields (headline, highlights, neighbourhood copy,
  SEO title/description) over REST, shaped as `acf.*` so sites that do run
  Advanced Custom Fields and sites that run only this plugin both work.
- Pings `/api/revalidate` on publish, update and unpublish, so an editor's change
  is live in seconds instead of waiting out the cache window.
- Repoints WordPress's View/Preview links at the Next.js site.

Posts (`/journal`) and pages (`/about`, `/terms`, and anything else published
later) work with stock WordPress and no plugin at all.

### HTML safety

All CMS HTML passes through `src/lib/wordpress/sanitize.ts` before reaching
`dangerouslySetInnerHTML`. Editors are trusted people, but "trusted" is not a
security control — a compromised account or a plugin that injects markup would
otherwise become stored XSS on the page that takes card details. The allowlist
is narrow, `javascript:` and `data:` URLs are blocked, and external links get
`rel="noopener noreferrer"`.

---

## Payments

One interface, two adapters (`src/lib/payments/`):

| | Stripe | OwnerRez hosted |
|---|---|---|
| Guest experience | Stays on the site | Redirected to OwnerRez |
| PCI scope | SAQ A (iframe) | None — nothing touches us |
| Branding | Fully styled to match | OwnerRez's page |
| Needs | Stripe account | Nothing beyond OwnerRez |

`PAYMENT_PROVIDER=auto` (the default) prefers Stripe when it is fully configured
and falls back to OwnerRez, so a half-finished Stripe setup degrades to a working
checkout rather than a broken one. With neither configured, checkout collects the
booking as a **request** and says so plainly — nothing is charged.

### Stripe webhook, locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Put the printed signing secret in `STRIPE_WEBHOOK_SECRET`. The endpoint verifies
the signature against the raw body and returns 500 on a handler failure so
Stripe retries — which is exactly what you want for a guest who has paid but is
not yet booked.

---

## Going to production

**Required before taking real money:**

- [ ] `BOOKING_SIGNING_SECRET` set (`openssl rand -base64 48`). The app refuses
      to sign drafts without it in production.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real https origin — payment return URLs
      and canonical tags depend on it.
- [ ] `STRIPE_WEBHOOK_SECRET` and `OWNERREZ_WEBHOOK_SECRET` set.
- [ ] Verify the OwnerRez endpoint paths against your account (see above).
- [ ] Replace the demo content: `src/lib/config/site.ts` for brand, and real
      photography in place of `public/demo/`.

### Two things that need a shared store before you scale out

Both are in-process by design, correct on a single instance, and documented at
their definitions:

1. **`src/lib/booking/idempotency.ts`** — stops one booking reference producing
   two reservations when the browser confirm and the webhook race. Across
   multiple instances each holds its own map, so the race returns. Replace
   `claim`/`settle`/`release` with an atomic set-if-absent: Redis
   `SET key NX PX`, or a unique index on the reference in a database.

2. **`src/lib/api/rate-limit.ts`** — a fixed-window limiter, enough to stop one
   client hammering the quote endpoint. It is not a defence against a
   distributed attacker. Put Upstash, Redis or the platform's WAF in front.

### Caching

- Property and editorial content: `CONTENT_REVALIDATE_SECONDS` (default 300).
- Availability: `AVAILABILITY_REVALIDATE_SECONDS` (default 60), plus webhook
  invalidation. Quotes and all mutations are never cached.

### Headers

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options` and a restrictive `Permissions-Policy`. A Content-Security
-Policy is deliberately **not** included: Stripe's Elements iframe needs specific
`frame-src`/`script-src` entries, and a CSP that is wrong is worse than none.
Add one once the deployed asset origins are known.

---

## Commands

```bash
npm run dev         # development server
npm run build       # production build
npm start           # serve the production build
npm test            # vitest (100 tests)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run check       # typecheck + lint + test
```

### What the tests cover

Deliberately weighted to the things that cost money or trust when wrong:

- **Dates** — night counting, DST transitions, leap days, month-end clamping.
  Calendar dates are carried as `YYYY-MM-DD` and computed in UTC throughout, so
  a guest arriving on the 4th arrives on the 4th in every timezone.
- **Money** — integer minor units everywhere, no floating-point dollars, and a
  hard error on mixing currencies.
- **Pricing** — line items sum exactly to the total; deposits stay out of it;
  discount and payment-schedule boundaries.
- **Stay validation** — minimums, occupancy, pets, and the rule that matters
  most: a range may not straddle a booked night, while the departure night
  itself is not occupied.
- **Draft tokens** — tampered payloads, tampered signatures, expiry, and the
  idempotency guard.
- **OwnerRez mapping** — tolerant parsing, span-to-night expansion, charge
  classification.

---

## Licence

MIT.
