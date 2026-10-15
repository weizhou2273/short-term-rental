import { SITE } from './site';
import type { Property } from './types';

/**
 * Landing pages for the searches guests make ("vacation rentals near
 * Camelback", "Poconos rental with a hot tub", "pet-friendly Poconos"…),
 * at /poconos/[slug]. Each puts the homes that genuinely fit first, and says
 * why in that home's own words (its pool, court, pet policy…), then shows our
 * other homes, so the pages are useful, not copies of each other. A guide
 * with no matching home isn't built.
 *
 * Only facts we can stand behind: attraction blurbs stay general, and drive
 * times come from each home's own `neighborhood` line.
 */

export type GuideGroup = 'Near an attraction' | 'For your group' | 'By amenity' | 'By town';

export type Guide = {
  slug: string;
  group: GuideGroup;
  /** The page's H1 and the link text elsewhere. */
  title: string;
  /** Short link text (footer, chips). */
  label: string;
  /** Search result title; the site name is added after it. */
  metaTitle: string;
  /** Meta description, from the homes that match. */
  description: (homes: Property[]) => string;
  /** Opening paragraphs, from the homes that match. */
  intro: (homes: Property[]) => string[];
  matches: (p: Property) => boolean;
  /** Why this home fits, in the listing's own words. */
  note: (p: Property) => string | undefined;
  /** Shown on each home's card as "Near …". */
  nearName?: string;
  /** The same homes on the search page. */
  searchHref: string;
};

// ---------- helpers ----------

const guestRange = (homes: Property[]) => {
  const sleeps = homes.map((p) => p.guests);
  const [min, max] = [Math.min(...sleeps), Math.max(...sleeps)];
  return min === max ? `${max}` : `${min} to ${max}`;
};

const homeCount = (homes: Property[]) => (homes.length === 1 ? 'one home' : `${homes.length} homes`);

const towns = (homes: Property[]) => {
  const names = [...new Set(homes.map((p) => p.area))];
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};

/** The text of the home's detail sections whose title or text matches. */
const detail = (p: Property, pattern: RegExp, where: 'title' | 'any' = 'title') =>
  (p.details ?? [])
    .filter((d) => pattern.test(where === 'title' ? d.title : `${d.title} ${d.text}`))
    .map((d) => d.text)
    .join(' ') || undefined;

const faq = (p: Property, pattern: RegExp) => p.faqs.find((f) => pattern.test(f.q))?.a;

const EVERY_HOME = 'a private pool (open in summer), hot tub, sauna and movie room';

// ---------- near an attraction ----------

/** What each attraction is, kept general and verifiable. */
const ATTRACTION_COPY: Record<string, { slug: string; blurb: string; season: string }> = {
  camelback: {
    slug: 'near-camelback-mountain',
    blurb:
      'Camelback Mountain in Tannersville is a year-round resort: skiing and snowboarding in winter, the Aquatopia indoor waterpark all year, and the Camelbeach outdoor waterpark in summer.',
    season: 'Book early for ski weekends and school holidays, when the mountain and the waterparks are busiest.',
  },
  kalahari: {
    slug: 'near-kalahari-resort',
    blurb:
      'Kalahari Resorts in Pocono Manor is home to one of the largest indoor waterparks in the country, open all year, which makes it a favorite for family trips in any season.',
    season: 'A house nearby gives a big group room to spread out between waterpark days, with your own kitchen, hot tub and movie room.',
  },
  raceway: {
    slug: 'near-pocono-raceway',
    blurb:
      'Pocono Raceway in Long Pond, known as the “Tricky Triangle”, hosts NASCAR’s summer race weekend and other events through the year.',
    season: 'Race weekends fill up fast, so a house for the whole crew is worth booking well ahead.',
  },
  jackfrost: {
    slug: 'near-jack-frost-big-boulder',
    blurb: 'Jack Frost and Big Boulder are two ski areas a few minutes apart in the western Poconos, popular with families and terrain-park riders.',
    season: 'After a day on the slopes, come back to a hot tub, a sauna and a movie room.',
  },
  mountairy: {
    slug: 'near-mount-airy-casino',
    blurb: 'Mount Airy Casino Resort in Mount Pocono pairs a casino with a golf course and a spa.',
    season: 'Stay in a private house nearby instead of a hotel room, with space for the whole group.',
  },
  shawnee: {
    slug: 'near-shawnee-mountain',
    blurb: 'Shawnee Mountain is a family-friendly ski area near Shawnee on Delaware, with skiing, snowboarding and snow tubing in winter.',
    season: 'In summer the same area is close to hiking, river trips and the Delaware Water Gap.',
  },
  dwg: {
    slug: 'near-delaware-water-gap',
    blurb:
      'The Delaware Water Gap National Recreation Area has some of the best hiking in the region, including stretches of the Appalachian Trail, plus tubing, canoeing and kayaking on the Delaware River.',
    season: 'Spring through fall is the season for the river; fall foliage brings the hikers.',
  },
  bushkill: {
    slug: 'near-bushkill-falls',
    blurb: 'Bushkill Falls, often called the “Niagara of Pennsylvania”, is a series of waterfalls linked by hiking trails and bridges, open seasonally.',
    season: 'Pair the falls with a day at the Delaware Water Gap, both an easy drive away.',
  },
};

const attractionGuides: Guide[] = SITE.attractions.flatMap((a) => {
  const copy = ATTRACTION_COPY[a.id];
  if (!copy) return [];
  return [
    {
      slug: copy.slug,
      group: 'Near an attraction' as const,
      title: `Vacation rentals near ${a.name}`,
      label: `Near ${a.name}`,
      metaTitle: `Vacation Rentals Near ${a.name}, Poconos`,
      nearName: a.name,
      description: (homes) =>
        `Private vacation homes near ${a.name} for groups of ${guestRange(homes)}, each with ${EVERY_HOME}. Book direct with ${SITE.brand}, no service fee.`,
      intro: (homes) => [
        copy.blurb,
        `We have ${homeCount(homes)} in ${towns(homes)} within a short drive, sleeping ${guestRange(homes)} guests, each with ${EVERY_HOME}. ${copy.season}`,
      ],
      matches: (p) => p.nearby.includes(a.id),
      note: (p) => p.neighborhood,
      searchHref: `/search?where=${a.id}`,
    },
  ];
});

// ---------- groups, amenities, towns ----------

const SKI_AREAS = ['camelback', 'shawnee', 'jackfrost'];

const themedGuides: Guide[] = [
  {
    slug: 'large-group-rentals',
    group: 'For your group',
    title: 'Large group & family reunion rentals in the Poconos',
    label: 'Large groups (16+)',
    metaTitle: 'Large Group & Family Reunion Rentals in the Poconos',
    description: (homes) =>
      `Pocono Mountains houses that sleep ${guestRange(homes)}: room for family reunions, multi-family trips and milestone birthdays, with ${EVERY_HOME}. Book direct.`,
    intro: (homes) => [
      `Finding one house for the whole family is the hard part. These ${homeCount(homes)} sleep ${guestRange(homes)} guests, with big kitchens and dining tables, game rooms and movie rooms, so everyone can be together without being on top of each other.`,
      'They’re homes in quiet neighborhoods, so there are no parties or events, which is exactly what makes them good for reunions, multi-family getaways and birthdays with the people you love.',
    ],
    matches: (p) => p.guests >= 16,
    note: (p) => `Sleeps ${p.guests} in ${p.bedrooms} bedrooms (${p.beds} beds), with ${p.baths} baths.`,
    searchHref: '/search?amenities=big',
  },
  {
    slug: 'ski-rentals',
    group: 'For your group',
    title: 'Poconos ski rentals near Camelback, Shawnee and Jack Frost',
    label: 'Ski trips',
    metaTitle: 'Poconos Ski Rentals Near Camelback, Shawnee & Jack Frost',
    description: (homes) =>
      `Ski-trip houses in the Poconos for ${guestRange(homes)} guests, near Camelback, Shawnee Mountain or Jack Frost and Big Boulder, each with a hot tub and sauna for après-ski. Book direct.`,
    intro: (homes) => [
      'The Poconos are an easy drive from New York and Philadelphia, and Camelback Mountain, Shawnee Mountain, and Jack Frost and Big Boulder are all within reach of our homes.',
      `Each of our ${homeCount(homes)} has a hot tub and a sauna for after the slopes, plus a movie room and game room for the evenings, and room for ${guestRange(homes)} guests.`,
    ],
    matches: (p) => p.nearby.some((id) => SKI_AREAS.includes(id)),
    note: (p) => p.neighborhood,
    searchHref: '/search',
  },
  {
    slug: 'rentals-with-private-pool',
    group: 'By amenity',
    title: 'Poconos vacation rentals with a private pool',
    label: 'Private pool',
    metaTitle: 'Poconos Vacation Rentals with a Private Pool',
    description: (homes) =>
      `Pocono Mountains vacation homes with their own private pool, for groups of ${guestRange(homes)}. Pool sizes and season for each home, plus hot tub and sauna. Book direct.`,
    intro: (homes) => [
      `Every one of our ${homeCount(homes)} has its own private pool, so you never share it with other guests.`,
      'The pools are outdoors and seasonal: they open around late spring and close in September, depending on the weather. Each home’s pool, and when it’s open, is described below.',
    ],
    matches: (p) => Boolean(detail(p, /pool/i)),
    note: (p) => detail(p, /^pool$/i) ?? detail(p, /pool/i),
    searchHref: '/search',
  },
  {
    slug: 'rentals-with-hot-tub-and-sauna',
    group: 'By amenity',
    title: 'Poconos rentals with a hot tub and sauna',
    label: 'Hot tub & sauna',
    metaTitle: 'Poconos Rentals with a Hot Tub and Sauna',
    description: (homes) =>
      `Pocono Mountains vacation homes with a private hot tub and sauna, for groups of ${guestRange(homes)}, perfect after skiing or hiking. Each home’s setup described. Book direct.`,
    intro: (homes) => [
      `A hot tub after a day on the slopes or the trails is half the point of a Poconos trip. All ${homeCount(homes)} have a private hot tub and a sauna.`,
      'Hot tubs can take several hours to heat up, so check each home’s notes below and plan ahead.',
    ],
    matches: (p) => Boolean(detail(p, /hot tub|sauna|spa/i)),
    note: (p) => detail(p, /hot tub|sauna|spa/i),
    searchHref: '/search',
  },
  {
    slug: 'rentals-with-tennis-pickleball-court',
    group: 'By amenity',
    title: 'Poconos rentals with a tennis or pickleball court',
    label: 'Tennis & pickleball',
    metaTitle: 'Poconos Rentals with a Tennis or Pickleball Court',
    description: (homes) =>
      `Pocono Mountains vacation homes with a private tennis or pickleball court, for groups of ${guestRange(homes)}, plus a pool, hot tub and sauna. Book direct.`,
    intro: (homes) => [
      `Bring your rackets and paddles: these ${homeCount(homes)} have a private court on the property, so a game is never more than a few steps from the kitchen.`,
      `They also have ${EVERY_HOME}.`,
    ],
    matches: (p) => p.features.sportCourt,
    note: (p) => detail(p, /tennis|pickleball/i, 'any'),
    searchHref: '/search?amenities=court',
  },
  {
    slug: 'rentals-on-a-private-pond',
    group: 'By amenity',
    title: 'Poconos rentals on a private pond',
    label: 'Private pond',
    metaTitle: 'Waterfront Poconos Rentals on a Private Pond',
    description: (homes) =>
      `Waterfront Pocono Mountains vacation homes on a private pond, for groups of ${guestRange(homes)}, with a pool, hot tub and sauna. Book direct.`,
    intro: (homes) => [
      `For mornings by the water and s’mores by the fire: these ${homeCount(homes)} sit on their own private pond, with space to relax by the water away from the crowds.`,
      `They also have ${EVERY_HOME}.`,
    ],
    matches: (p) => p.features.waterfront,
    note: (p) => detail(p, /pond|stream/i, 'any') ?? p.description[0],
    searchHref: '/search?amenities=water',
  },
  {
    slug: 'pet-friendly-rentals',
    group: 'By amenity',
    title: 'Pet-friendly vacation rentals in the Poconos',
    label: 'Pet friendly',
    metaTitle: 'Pet-Friendly Vacation Rentals in the Poconos',
    description: (homes) =>
      `Dog-friendly Pocono Mountains vacation homes for groups of ${guestRange(homes)}, with yards to explore, plus a pool, hot tub and sauna. Pet fees for each home. Book direct.`,
    intro: (homes) => [
      `The whole family includes the dog. All ${homeCount(homes)} welcome pets, with room to roam outside and trails nearby.`,
      'Please tell us about your pets before you book. Each home’s pet fee is below.',
    ],
    matches: (p) => p.features.petFriendly,
    note: (p) => faq(p, /pet/i),
    searchHref: '/search?amenities=pets',
  },
];

const townGuide = (area: string, slug: string, blurb: string): Guide => ({
  slug,
  group: 'By town',
  title: `${area}, PA vacation rentals`,
  label: `${area}, PA`,
  metaTitle: `${area}, PA Vacation Rentals in the Poconos`,
  description: (homes) =>
    `Private vacation homes in ${area}, Pennsylvania, for groups of ${guestRange(homes)}, each with ${EVERY_HOME}. Book direct with ${SITE.brand}.`,
  intro: (homes) => [blurb, `We have ${homeCount(homes)} in ${area}, sleeping ${guestRange(homes)} guests, each with ${EVERY_HOME}.`],
  matches: (p) => p.area === area,
  note: (p) => p.neighborhood,
  searchHref: '/search',
});

const townGuides: Guide[] = [
  townGuide(
    'Long Pond',
    'long-pond-pa-vacation-rentals',
    'Long Pond sits in the heart of the Poconos, close to Camelback Mountain, Kalahari Resort, Pocono Raceway, and Jack Frost and Big Boulder, with lakes and community beaches nearby.',
  ),
  townGuide(
    'East Stroudsburg',
    'east-stroudsburg-pa-vacation-rentals',
    'East Stroudsburg is the gateway to the eastern Poconos, close to Shawnee Mountain, the Delaware Water Gap and Bushkill Falls.',
  ),
];

export const GUIDES: Guide[] = [...attractionGuides, ...themedGuides, ...townGuides];

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);

export const guidePath = (g: Guide) => `/poconos/${g.slug}`;

/** The listed homes a guide covers, in the site's order. */
export const guideHomes = (g: Guide, homes: readonly Property[]) => homes.filter(g.matches);

export const GUIDE_GROUPS: GuideGroup[] = ['Near an attraction', 'For your group', 'By amenity', 'By town'];
