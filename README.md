# W&K Reserve — direct booking site

Next.js (App Router) site for the W&K Reserve Poconos estates, deployed on
Vercel. **Hospitable is the system of record and takes every payment.** This
app never handles card data and has no payment code: it prices a stay with
Hospitable, then sends the guest to Hospitable's hosted checkout.

```bash
npm install
cp .env.example .env.local   # add HOSPITABLE_PAT
npm run dev                  # http://localhost:3000
npm run check                # typecheck + lint + tests
```

## Routes

| Route | What it does |
|---|---|
| `/` | Hero video, search bar, all estates, why book direct |
| `/search` | Where / dates / guests / amenity filters. With dates + guests, shows live availability and pre-tax totals from `/api/search` |
| `/stays/[slug]` | Property page. Prerendered for every entry in `PROPERTIES` |
| `POST /api/quote` | Creates a Hospitable quote, returns the price breakdown + `bookingUrl`. Rate limited |
| `GET /api/search` | Hospitable property search for a stay window |
| `GET /api/calendar` | A property's availability calendar, for the date picker |

## Booking flow

1. The guest picks dates and adults / children / infants / pets (pets only on
   pet-friendly properties) in our booking card on `/stays/[slug]`. Booked
   nights come from Hospitable's calendar (`/api/calendar`) and are disabled,
   as are check-outs that cross a booked night or break the minimum stay.
2. The card calls `POST /api/quote`. The server calls Hospitable
   `POST /v2/properties/{uuid}/quote` with `custom_site_id`
   (`SITE.hospitable.siteUuid`) and the `guests` breakdown, and returns
   nights, fees, taxes and total. This repeats as the stay changes.
3. With a price showing, the guest enters first name, last name, email and
   phone. Reserve stays disabled until all four are valid (`src/lib/booking/guest.ts`;
   phones are normalised to E.164, numbers without `+` are read as US).
4. **Reserve** creates one more quote, this time with `guest_details`, so
   availability is re-checked and Hospitable's checkout opens pre-filled. If
   that quote's total differs from the one shown, the card shows the new
   total and waits for a second click; otherwise it redirects to the quote's
   `booking_url` on `booking.hospitable.com`, where Hospitable takes payment
   and creates the reservation.

Contact details are only ever sent in that final request: never in the URL,
browser storage, logs or any response.

`SITE.bookingMode` in `src/data/site.ts` switches every property page between:

- `"native"` (default) — the flow above.
- `"widget"` — Hospitable's embedded Direct widget, the fallback. Each
  property needs `hospitable.propertyId` (the widget's `data-property-id`).

## Content

All copy and listing data is in two typed files:

- `src/data/site.ts` — `SITE`: brand, Hospitable site id, booking mode,
  attractions, why-book-direct.
- `src/data/properties.ts` — `PROPERTIES`: one entry per estate.
  `hospitable.uuid` is the Public API id used for quotes, search and calendar.

### Photos

Each property's photos live in `public/photos/<slug>/` and are listed, in
display order, in that property's `photos` in `src/data/properties.ts`:

```ts
photos: [
  { file: 'exterior-dusk.jpg', room: 'Exterior' },       // 1st: cover (cards, link previews) + big grid photo
  { file: 'great-room.jpg', room: 'Living room', alt: 'Great room with fireplace' },
  { file: 'pool.jpg', room: 'Pool' },
  { file: 'kitchen.jpg', room: 'Full kitchen' },
  { file: 'hot-tub.jpg', room: 'Hot tub' },              // 1st–5th: the stay page photo grid
  { file: 'primary-bedroom.jpg', room: 'Bedroom 1' },    // 6th onward: photo tour only
],
```

"Show all photos" opens a photo tour like Airbnb's: the rooms are listed at
the top (each with its first photo), and picking one scrolls to that room's
photos. Rooms appear in the order of their first photo in the list. A bedroom
whose `room` matches a name in `sleeping` (e.g. "Bedroom 1") also shows its
photo under "Where you'll sleep". Without rooms the tour is a plain gallery.

Alt text and room are optional; without alt text a photo is described as
"<name>, photo N". With fewer than five photos the grid switches to a layout
with no empty cells; with none it shows placeholders.

**Adding a folder of photos**

```bash
npm run photos -- clover-lodge ~/Downloads/clover-rd-photos
```

This writes `public/photos/clover-lodge/*.jpg`, rotated upright, at most 2560px
on the long edge, compressed, and with **all metadata stripped**, including
GPS coordinates that would otherwise reveal each property's location to anyone
downloading a photo. It then prints a `photos: [...]` list to paste in and
reorder. Export iPhone HEIC photos as JPEG first.

`next/image` resizes photos for each screen and serves WebP; only paths under
`/photos/` are accepted (`next.config.ts`). `npm run check` fails if a listed
photo is missing from its folder, so a typo can't ship a broken image.

Maps are still placeholders.

## Security

- `HOSPITABLE_PAT` has **write** access. It is read only in
  `src/lib/hospitable/client.ts`, which imports `server-only`, so the build
  fails if a client component ever imports it. Never give it a `NEXT_PUBLIC_` prefix.
- `.env.local` is git-ignored. On Vercel, set `HOSPITABLE_PAT` under
  Project → Settings → Environment Variables.
- The browser names properties by slug; the server maps slugs to Hospitable
  UUIDs, so the token can only touch properties listed in `PROPERTIES`.
- Inputs are validated (dates, ≤ 90 nights, occupancy) before Hospitable is called.
- A `booking_url` is only returned or followed if it is `https://booking.hospitable.com/…`.
- `/api/quote` allows 20 requests per minute per IP (search 60, calendar 120).
  The limiter is in memory, per server instance; for a hard global limit,
  back `src/lib/rate-limit.ts` with Upstash Redis / Vercel KV.

## Deploying on Vercel

Import the repo into Vercel (framework preset: Next.js, root directory left
as the repo root), add `HOSPITABLE_PAT` under Project → Settings →
Environment Variables, and deploy.
