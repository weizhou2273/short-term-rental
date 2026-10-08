import type { Property } from './types';

/**
 * One entry per property. Swap placeholder values for real content; the
 * layout never changes. `hospitable.uuid` is the Public API id used for
 * quotes, search and the availability calendar.
 *
 * `hidden: true` keeps an entry's data here but takes it off the site
 * entirely (pages, cards, search, map, footer, and the quote/calendar APIs).
 * Delete the flag to bring it back.
 */
const ALL_PROPERTIES: Property[] = [
  {
    id: 'property-1',
    slug: 'shawnee-estate', // Hospitable: 148 Frutchey Dr
    name: 'The Shawnee Estate',
    tagline: '8 bedrooms · tennis court, pool, pond & stream',
    location: 'East Stroudsburg, PA',
    area: 'East Stroudsburg',
    type: 'Entire villa',
    guests: 16,
    bedrooms: 8,
    beds: 13,
    baths: 4.5,
    priceFrom: 450,
    rating: 4.95,
    reviewCount: 48,
    nearby: ['shawnee', 'dwg', 'bushkill'],
    features: { privatePool: true, sportCourt: true, waterfront: true, petFriendly: false },
    mapPos: { x: 32, y: 40 },
    coords: { lat: null, lng: null },
    // Files in public/photos/<slug>/, in display order. First 5 = photo grid.
    photos: [],
    highlights: [
      { title: 'Highlight one', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight two', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight three', text: 'Short supporting line about this highlight.' },
    ],
    description: [
      "Placeholder description paragraph one. Describe the house, the setting, and who it's ideal for.",
      'Placeholder paragraph two. Describe the main living spaces, the kitchen, and outdoor areas.',
      'Placeholder paragraph three. Nearby attractions and drive times.',
    ],
    sleeping: [
      { room: 'Bedroom 1', beds: '1 king bed' },
      { room: 'Bedroom 2', beds: '1 queen bed' },
      { room: 'Bedroom 3', beds: '1 queen bed' },
      { room: 'Bedroom 4', beds: '2 twin beds' },
      { room: 'Bedroom 5', beds: '2 bunk beds' },
    ],
    amenities: ['Hot tub', 'Wifi', 'Free parking', 'Kitchen', 'Washer', 'Dryer', 'Fireplace', 'Game room', 'BBQ grill', 'Air conditioning', 'Workspace', 'EV charger', 'Crib', 'Smart TV', 'Coffee maker', 'Fire pit'],
    rules: {
      checkIn: 'After 4:00 PM',
      checkOut: 'Before 11:00 AM',
      house: ['No parties or events', 'No smoking', 'Quiet hours 10 PM – 8 AM', 'Pets: placeholder'],
      safety: ['Smoke alarm', 'Carbon monoxide alarm', 'Exterior cameras (placeholder)'],
      cancellation: 'Placeholder cancellation policy summary.',
    },
    reviews: [
      { name: 'Guest A', date: 'Month 2026', text: 'Placeholder review text. Two or three sentences about the stay.' },
      { name: 'Guest B', date: 'Month 2026', text: 'Placeholder review text. Two or three sentences about the stay.' },
      { name: 'Guest C', date: 'Month 2026', text: 'Placeholder review text. Two or three sentences about the stay.' },
      { name: 'Guest D', date: 'Month 2026', text: 'Placeholder review text. Two or three sentences about the stay.' },
    ],
    faqs: [
      { q: 'Placeholder question about parking?', a: 'Placeholder answer.' },
      { q: 'Placeholder question about the hot tub?', a: 'Placeholder answer.' },
      { q: 'Placeholder question about early check-in?', a: 'Placeholder answer.' },
      { q: 'Is the road accessible in winter?', a: 'Placeholder answer.' },
    ],
    hospitable: { propertyId: '2051780', uuid: '99450f10-e011-41ec-93fa-9f221cd295ab' },
  },
  {
    id: 'property-2',
    slug: 'clover-lodge', // Hospitable: 1680 Clover Rd
    name: 'Clover Lodge',
    tagline: 'Forest cabin · pool, sauna, sun room cinema',
    location: 'Long Pond, PA',
    area: 'Long Pond',
    type: 'Entire cabin',
    guests: 12,
    bedrooms: 3,
    beds: 13,
    baths: 2.5,
    priceFrom: 380,
    rating: 4.92,
    reviewCount: 36,
    nearby: ['camelback', 'kalahari', 'raceway', 'jackfrost', 'mountairy'],
    features: { privatePool: true, sportCourt: false, waterfront: false, petFriendly: true },
    mapPos: { x: 58, y: 28 },
    coords: { lat: null, lng: null },
    // Files in public/photos/<slug>/, in display order. First 5 = photo grid
    // (the owner's c1–c5 picks in the Drive folder).
    photos: [
      { file: '01-backyard-01-c1.jpg', alt: 'The house at dusk with the pool, hot tub and fire pit lit up' },
      { file: '02-sun-room-01-c2.jpg', alt: 'Sun room cinema with a projector screen and leather lounge chairs' },
      { file: '04-game-room-01-c3.jpg', alt: 'Game room with a sauna, foosball table and movie screen' },
      { file: '03-hot-tub-01-c4.jpg', alt: 'Hot tub on the fenced patio, surrounded by trees' },
      { file: '05-pool-01-c5.jpg', alt: 'Above-ground pool in the backyard' },
      { file: '01-backyard-02.jpg', alt: 'Fire pit with Adirondack chairs and a hammock at night' },
      { file: '01-backyard-03.jpg', alt: 'Fire pit seating and hammock in the backyard' },
      { file: '01-backyard-04.jpg', alt: 'Patio with a grill, hot tub and outdoor lounge set' },
      { file: '01-backyard-05.jpg', alt: 'Backyard with the pool and fire pit, house behind' },
      { file: '02-sun-room-02.jpg', alt: 'Sun room lounge chairs looking out to the yard' },
      { file: '02-sun-room-03.jpg', alt: 'Movie night in the sun room cinema' },
      { file: '04-game-room-02.jpg', alt: 'Theater room with a large screen and sofas' },
      { file: '06-living-room-01.jpg', alt: 'Living room with a pool table, fireplace and sofa' },
      { file: '06-living-room-02.jpg', alt: 'Pool table in front of the stone fireplace' },
      { file: '06-living-room-03.jpg', alt: 'Pool table at the foot of the stairs' },
      { file: '06-living-room-04.jpg', alt: 'Living room with a sectional sofa and TV' },
      { file: '06-living-room-05.jpg', alt: 'Leather sofas around the stone fireplace' },
      { file: '06-living-room-06.jpg', alt: 'Living room seating facing the fireplace and TV' },
      { file: '06-living-room-07.jpg', alt: 'Sectional sofa and coffee table in the living room' },
      { file: '07-dinning-room-03.jpg', alt: 'Dining table beside the kitchen' },
      { file: '07-dinning-room-04.jpg', alt: 'Dining area open to the kitchen and living room' },
      { file: '08-kitchen-01.jpg', alt: 'Kitchen with an island and stainless steel appliances' },
      { file: '08-kitchen-02.jpg', alt: 'Kitchen island with bar stools' },
      { file: '08-kitchen-03.jpg', alt: 'Kitchen island looking toward the dining table' },
      { file: '09-bedroom-01.jpg', alt: 'Bedroom with two beds and a sitting area' },
      { file: '09-bedroom-02.jpg', alt: 'Two beds side by side under a patterned wall' },
      { file: '09-bedroom-03.jpg', alt: 'Bedroom with patterned wallpaper' },
      { file: '09-bedroom-04.jpg', alt: 'Bedroom with a wall-mounted TV' },
      { file: '10-bedroom-01.jpg', alt: 'Bedroom with an upholstered bed and bench' },
      { file: '10-bedroom-02.jpg', alt: 'Bedroom with a yellow accent wall' },
      { file: '10-bedroom-03.jpg', alt: 'Bunk room with two bunk beds' },
      { file: '11-half-bathroom-01.jpg', alt: 'Half bathroom with a round mirror' },
      { file: '12-bathroom-01.jpg', alt: 'Bathroom with a dark green accent wall' },
      { file: '13-bathroom-01.jpg', alt: 'Bathroom with a tub-shower and gold fixtures' },
      { file: '13-bathroom-02.jpg', alt: 'Bathroom with a tub-shower' },
      { file: '14-exterior-02.jpg', alt: 'Front of the house at dusk' },
    ],
    highlights: [
      { title: 'Highlight one', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight two', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight three', text: 'Short supporting line about this highlight.' },
    ],
    description: ['Placeholder description paragraph one.', 'Placeholder paragraph two.'],
    sleeping: [
      { room: 'Bedroom 1', beds: '1 king bed' },
      { room: 'Bedroom 2', beds: '1 queen bed' },
      { room: 'Bedroom 3', beds: '2 twin beds' },
      { room: 'Bedroom 4', beds: '1 queen bed' },
    ],
    amenities: ['Hot tub', 'Wifi', 'Free parking', 'Kitchen', 'Washer', 'Dryer', 'Fireplace', 'BBQ grill', 'Air conditioning', 'Smart TV', 'Fire pit', 'Board games'],
    rules: {
      checkIn: 'After 4:00 PM',
      checkOut: 'Before 11:00 AM',
      house: ['No parties or events', 'No smoking', 'Quiet hours 10 PM – 8 AM'],
      safety: ['Smoke alarm', 'Carbon monoxide alarm'],
      cancellation: 'Placeholder cancellation policy summary.',
    },
    reviews: [
      { name: 'Guest A', date: 'Month 2026', text: 'Placeholder review text.' },
      { name: 'Guest B', date: 'Month 2026', text: 'Placeholder review text.' },
    ],
    faqs: [
      { q: 'Placeholder question one?', a: 'Placeholder answer.' },
      { q: 'Placeholder question two?', a: 'Placeholder answer.' },
    ],
    hospitable: { propertyId: '411552', uuid: 'd37d9860-e7e2-4fa4-a582-633d918acddb' },
  },
  {
    id: 'property-3',
    slug: 'minsi-pond', // Hospitable: 539 Minsi Trl W
    name: 'Minsi Pond',
    tagline: '6 bedrooms · private pond, sauna, single-level living',
    location: 'Long Pond, PA',
    area: 'Long Pond',
    type: 'Entire villa',
    guests: 16,
    bedrooms: 6,
    beds: 14,
    baths: 3,
    priceFrom: 295,
    rating: 4.89,
    reviewCount: 61,
    nearby: ['camelback', 'kalahari', 'raceway', 'jackfrost', 'mountairy'],
    features: { privatePool: true, sportCourt: false, waterfront: true, petFriendly: true },
    mapPos: { x: 42, y: 62 },
    coords: { lat: null, lng: null },
    // Files in public/photos/<slug>/, in display order. First 5 = photo grid.
    photos: [],
    highlights: [
      { title: 'Highlight one', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight two', text: 'Short supporting line about this highlight.' },
    ],
    description: ['Placeholder description paragraph one.', 'Placeholder paragraph two.'],
    sleeping: [
      { room: 'Bedroom 1', beds: '1 king bed' },
      { room: 'Bedroom 2', beds: '1 queen bed' },
      { room: 'Bedroom 3', beds: '2 twin beds' },
    ],
    amenities: ['Hot tub', 'Wifi', 'Free parking', 'Kitchen', 'Washer', 'Dryer', 'Fireplace', 'Air conditioning', 'Smart TV', 'Coffee maker'],
    rules: {
      checkIn: 'After 4:00 PM',
      checkOut: 'Before 11:00 AM',
      house: ['No parties or events', 'No smoking'],
      safety: ['Smoke alarm', 'Carbon monoxide alarm'],
      cancellation: 'Placeholder cancellation policy summary.',
    },
    reviews: [
      { name: 'Guest A', date: 'Month 2026', text: 'Placeholder review text.' },
      { name: 'Guest B', date: 'Month 2026', text: 'Placeholder review text.' },
      { name: 'Guest C', date: 'Month 2026', text: 'Placeholder review text.' },
    ],
    faqs: [{ q: 'Placeholder question one?', a: 'Placeholder answer.' }],
    hospitable: { propertyId: '527920', uuid: '138daf11-dee3-4a83-ba5b-fffbd35ef571' },
  },
  {
    id: 'property-4',
    // Hospitable: 60 Turkey Ridge Rd. Two Hospitable listings exist for this house; this is
    // the one with the reservations (c62be835…, widget 1396650), not c010e823… / 2517111.
    slug: 'the-ridge',
    name: 'The Ridge',
    tagline: '7 bedrooms, sleeps 20 · pool, pickleball, private theater',
    location: 'East Stroudsburg, PA',
    area: 'East Stroudsburg',
    type: 'Entire villa',
    guests: 20,
    bedrooms: 7,
    beds: 11,
    baths: 4.5,
    priceFrom: 245,
    rating: 4.97,
    reviewCount: 29,
    nearby: ['shawnee', 'dwg', 'bushkill'],
    features: { privatePool: true, sportCourt: true, waterfront: false, petFriendly: true },
    mapPos: { x: 22, y: 72 },
    coords: { lat: null, lng: null },
    // Files in public/photos/<slug>/, in display order. First 5 = photo grid.
    photos: [],
    highlights: [
      { title: 'Highlight one', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight two', text: 'Short supporting line about this highlight.' },
    ],
    description: ['Placeholder description paragraph one.', 'Placeholder paragraph two.'],
    sleeping: [
      { room: 'Bedroom 1', beds: '1 queen bed' },
      { room: 'Bedroom 2', beds: '1 queen bed' },
      { room: 'Bedroom 3', beds: '1 full bed' },
    ],
    amenities: ['Wifi', 'Free parking', 'Kitchen', 'Washer', 'Dryer', 'Fire pit', 'Air conditioning', 'Smart TV', 'Workspace'],
    rules: {
      checkIn: 'After 4:00 PM',
      checkOut: 'Before 11:00 AM',
      house: ['No parties or events', 'No smoking'],
      safety: ['Smoke alarm', 'Carbon monoxide alarm'],
      cancellation: 'Placeholder cancellation policy summary.',
    },
    reviews: [
      { name: 'Guest A', date: 'Month 2026', text: 'Placeholder review text.' },
      { name: 'Guest B', date: 'Month 2026', text: 'Placeholder review text.' },
    ],
    faqs: [{ q: 'Placeholder question one?', a: 'Placeholder answer.' }],
    hospitable: { propertyId: '1396650', uuid: 'c62be835-a698-4e96-90ec-1630519f3ced' },
  },
  {
    id: 'property-5',
    slug: 'property-5', // Hospitable: 5136 Goose Pond Rd (no widget code yet)
    // Off the site for now. Remove this line to list it again.
    hidden: true,
    name: 'Goose Pond Lodge',
    tagline: '4 bedrooms · hot tub, theater room, lake access',
    location: 'Coolbaugh Township, PA',
    area: 'Coolbaugh Township',
    type: 'Entire cabin',
    guests: 12,
    bedrooms: 4,
    beds: 7,
    baths: 3.5,
    priceFrom: 520,
    rating: 4.9,
    reviewCount: 22,
    nearby: ['camelback', 'kalahari', 'raceway', 'jackfrost', 'mountairy'],
    features: { privatePool: false, sportCourt: false, waterfront: false, petFriendly: true },
    mapPos: { x: 72, y: 55 },
    coords: { lat: null, lng: null },
    // Files in public/photos/<slug>/, in display order. First 5 = photo grid.
    photos: [],
    highlights: [
      { title: 'Highlight one', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight two', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight three', text: 'Short supporting line about this highlight.' },
    ],
    description: ['Placeholder description paragraph one.', 'Placeholder paragraph two.', 'Placeholder paragraph three.'],
    sleeping: [
      { room: 'Bedroom 1', beds: '1 king bed' },
      { room: 'Bedroom 2', beds: '1 king bed' },
      { room: 'Bedroom 3', beds: '1 queen bed' },
      { room: 'Bedroom 4', beds: '1 queen bed' },
      { room: 'Bedroom 5', beds: '2 twin beds' },
      { room: 'Bedroom 6', beds: '2 bunk beds' },
    ],
    amenities: ['Hot tub', 'Wifi', 'Free parking', 'Kitchen', 'Washer', 'Dryer', 'Fireplace', 'Game room', 'Theater room', 'BBQ grill', 'Air conditioning', 'EV charger', 'Crib', 'High chair', 'Smart TV', 'Lake access'],
    rules: {
      checkIn: 'After 4:00 PM',
      checkOut: 'Before 11:00 AM',
      house: ['No parties or events', 'No smoking', 'Quiet hours 10 PM – 8 AM'],
      safety: ['Smoke alarm', 'Carbon monoxide alarm'],
      cancellation: 'Placeholder cancellation policy summary.',
    },
    reviews: [
      { name: 'Guest A', date: 'Month 2026', text: 'Placeholder review text.' },
      { name: 'Guest B', date: 'Month 2026', text: 'Placeholder review text.' },
    ],
    faqs: [
      { q: 'Placeholder question one?', a: 'Placeholder answer.' },
      { q: 'Placeholder question two?', a: 'Placeholder answer.' },
    ],
    hospitable: { propertyId: null, uuid: 'ec6850bc-7165-4811-add6-939a39bf4cc5' },
  },
  {
    id: 'property-6',
    slug: 'the-clearview', // Hospitable: 731 Clearview Dr
    name: 'The Clearview',
    tagline: '4 bedrooms · private pool, movie room, hot tub & sauna',
    location: 'Long Pond, PA',
    area: 'Long Pond',
    type: 'Entire home',
    guests: 12,
    bedrooms: 4,
    beds: 7,
    baths: 3.5,
    priceFrom: 300,
    rating: 4.9,
    reviewCount: 20,
    nearby: ['camelback', 'kalahari', 'raceway', 'jackfrost', 'mountairy'],
    features: { privatePool: true, sportCourt: false, waterfront: false, petFriendly: true },
    mapPos: { x: 82, y: 30 },
    coords: { lat: null, lng: null },
    // Files in public/photos/<slug>/, in display order. First 5 = photo grid.
    photos: [],
    highlights: [
      { title: 'Highlight one', text: 'Short supporting line about this highlight.' },
      { title: 'Highlight two', text: 'Short supporting line about this highlight.' },
    ],
    description: ['Placeholder description paragraph one.', 'Placeholder paragraph two.'],
    sleeping: [
      { room: 'Bedroom 1', beds: '1 king bed' },
      { room: 'Bedroom 2', beds: '1 queen bed' },
      { room: 'Bedroom 3', beds: '2 twin beds' },
    ],
    amenities: ['Hot tub', 'Wifi', 'Free parking', 'Kitchen', 'Washer', 'Dryer', 'Fireplace', 'Air conditioning', 'Smart TV', 'Fire pit'],
    rules: {
      checkIn: 'After 4:00 PM',
      checkOut: 'Before 11:00 AM',
      house: ['No parties or events', 'No smoking'],
      safety: ['Smoke alarm', 'Carbon monoxide alarm'],
      cancellation: 'Placeholder cancellation policy summary.',
    },
    reviews: [
      { name: 'Guest A', date: 'Month 2026', text: 'Placeholder review text.' },
      { name: 'Guest B', date: 'Month 2026', text: 'Placeholder review text.' },
    ],
    faqs: [{ q: 'Placeholder question one?', a: 'Placeholder answer.' }],
    hospitable: { propertyId: '635012', uuid: '056aa587-1c2f-43aa-9438-3e8eab46c25a' },
  },
];

/** Properties shown on the site. Everything reads from this list. */
export const PROPERTIES: Property[] = ALL_PROPERTIES.filter((p) => !p.hidden);

/** Every entry, including hidden ones — only for data checks. */
export const ALL_PROPERTY_ENTRIES: readonly Property[] = ALL_PROPERTIES;

export function getPropertyBySlug(slug: string): Property | undefined {
  return PROPERTIES.find((p) => p.slug === slug);
}

export function getPropertyByUuid(uuid: string): Property | undefined {
  return PROPERTIES.find((p) => p.hospitable.uuid === uuid);
}
