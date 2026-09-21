import type { Property } from '@/lib/booking/types';
import { money } from '@/lib/util/money';

/**
 * Demo portfolio used whenever OwnerRez credentials are absent.
 *
 * This is what makes the repo runnable on a fresh clone: design work, Lighthouse
 * runs and CI all exercise the real components with realistic data. The moment
 * `OWNERREZ_USERNAME` / `OWNERREZ_ACCESS_TOKEN` are set, live data replaces it
 * and nothing here is read.
 */

/**
 * Placeholder artwork ships with the repo rather than being hotlinked from a
 * stock-photo CDN, so demo mode renders on a fresh clone with no network, no
 * API key and no third-party terms to honour. Replace these with real
 * photography, or let OwnerRez listing images take over once credentials exist.
 */
function image(name: string, alt: string) {
  return {
    url: `/demo/${name}.svg`,
    alt,
    width: 1600,
    height: 1067,
  };
}

const amenities = (...labels: string[]) =>
  labels.map((label) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label,
  }));

export const demoProperties: Property[] = [
  {
    id: 101,
    slug: 'the-glass-barn',
    name: 'The Glass Barn',
    headline: 'A cantilevered glass house above the Hudson Valley treeline',
    summary:
      'Two hundred acres of maple and birch, a wall of glass facing due west, and a wood-fired hot tub cut into the hillside. Sleeps six.',
    description: `<p>Built into the slope of a working orchard, The Glass Barn is a single 4,000-square-foot volume clad in charred cedar and glazed end to end. The western wall disappears entirely into a pocket, opening the living room onto a cantilevered deck that hangs eleven feet above the meadow.</p>
<p>The kitchen is a single slab of honed Belgian bluestone with a La Cornue range and a scullery behind. There is a record library, a wood-burning Rais stove, and an outdoor shower under the eaves. Wi-Fi is fast enough to work from; the nearest neighbour is a mile down the road.</p>
<p>Mornings are for the orchard. Evenings are for the hot tub, which is fed by a wood-fired stove and takes about two hours to come up to temperature — start it at four.</p>`,
    location: {
      locality: 'Ancram',
      region: 'NY',
      country: 'US',
      latitude: 42.0715,
      longitude: -73.6207,
    },
    capacity: { maxGuests: 6, bedrooms: 3, beds: 4, bathrooms: 2.5 },
    rules: {
      checkInTime: '4:00 PM',
      checkOutTime: '11:00 AM',
      minNights: 2,
      maxNights: 28,
      petsAllowed: true,
      smokingAllowed: false,
      eventsAllowed: false,
      quietHours: '10:00 PM – 8:00 AM',
    },
    amenities: amenities(
      'Wood-fired hot tub',
      'Fireplace',
      'Chef kitchen',
      'Fast Wi-Fi (900 Mbps)',
      'Workspace',
      'Outdoor shower',
      'Record library',
      'Washer & dryer',
      'Dog friendly',
      'Free parking',
      'Air conditioning',
      'Radiant floor heat',
    ),
    images: [
      image('glass-barn-living', 'Glass-walled living room at dusk'),
      image('glass-barn-kitchen', 'Kitchen with bluestone island'),
      image('glass-barn-bed', 'Primary bedroom facing the meadow'),
      image('glass-barn-bath', 'Bathroom with soaking tub'),
      image('glass-barn-room', 'Bedroom with linen bedding'),
      image('glass-barn-deck', 'Deck cantilevered over the hillside'),
    ],
    baseNightlyRate: money(78_000),
    currency: 'USD',
    active: true,
  },
  {
    id: 102,
    slug: 'stone-house-no-4',
    name: 'Stone House No. 4',
    headline: 'An 1840s fieldstone farmhouse, rebuilt with a very light hand',
    summary:
      'Original chestnut beams, lime-plastered walls, a kitchen garden and an eight-metre lap pool. Sleeps eight across four bedrooms.',
    description: `<p>The house was a ruin in 2016. What survived — the fieldstone shell, the chestnut frame, two fireplaces deep enough to stand in — was kept. Everything else is new and quiet: lime plaster, oiled oak floors, brass that has been left to go dark.</p>
<p>A glazed link connects the old house to a new kitchen wing that opens to the garden. There is an eight-metre lap pool, heated from May to October, a productive kitchen garden you are welcome to raid, and a barn with bicycles.</p>
<p>It sleeps eight comfortably and ten at a push. It is a house for long tables and slow mornings.</p>`,
    location: {
      locality: 'Millerton',
      region: 'NY',
      country: 'US',
      latitude: 41.9509,
      longitude: -73.5107,
    },
    capacity: { maxGuests: 8, bedrooms: 4, beds: 5, bathrooms: 3 },
    rules: {
      checkInTime: '4:00 PM',
      checkOutTime: '11:00 AM',
      minNights: 3,
      maxNights: 30,
      petsAllowed: true,
      smokingAllowed: false,
      eventsAllowed: true,
      quietHours: '11:00 PM – 8:00 AM',
    },
    amenities: amenities(
      'Heated lap pool',
      'Two fireplaces',
      'Kitchen garden',
      'Pizza oven',
      'Fast Wi-Fi (500 Mbps)',
      'Workspace',
      'Bicycles',
      'Washer & dryer',
      'Dog friendly',
      'Free parking',
      'Air conditioning',
      'Outdoor dining for twelve',
    ),
    images: [
      image('stone-house-front', 'Fieldstone farmhouse from the drive'),
      image('stone-house-living', 'Living room with chestnut beams'),
      image('stone-house-kitchen', 'Kitchen wing opening to the garden'),
      image('stone-house-bed', 'Bedroom under the eaves'),
      image('stone-house-pool', 'Lap pool at golden hour'),
      image('stone-house-bath', 'Bathroom with brass fittings'),
    ],
    baseNightlyRate: money(95_000),
    currency: 'USD',
    active: true,
  },
  {
    id: 103,
    slug: 'the-ridge-cabin',
    name: 'The Ridge Cabin',
    headline: 'A one-bedroom cabin on a ridge, with nothing else in sight',
    summary:
      'Off-grid but not uncomfortable: solar, a deep well, a Danish wood stove and a claw-foot tub on the deck. Sleeps two.',
    description: `<p>Forty minutes of dirt road from the nearest village, on a ridge at 1,900 feet. The cabin is 680 square feet of Douglas fir, with a south-facing wall of glass and a deck that runs its full length.</p>
<p>It runs on solar with a battery bank — enough for lights, the fridge, the pump and your laptop, not enough for a hair dryer. Water comes from a 300-foot well. Heat comes from a Morsø stove and a very good wool duvet.</p>
<p>There is no television and no cell signal. There is Starlink, if you need it, and a switch by the door to turn it off.</p>`,
    location: {
      locality: 'Windham',
      region: 'NY',
      country: 'US',
      latitude: 42.3103,
      longitude: -74.2415,
    },
    capacity: { maxGuests: 2, bedrooms: 1, beds: 1, bathrooms: 1 },
    rules: {
      checkInTime: '3:00 PM',
      checkOutTime: '10:00 AM',
      minNights: 2,
      maxNights: 14,
      petsAllowed: false,
      smokingAllowed: false,
      eventsAllowed: false,
      quietHours: null,
    },
    amenities: amenities(
      'Wood stove',
      'Claw-foot tub on the deck',
      'Solar powered',
      'Starlink internet',
      'Espresso setup',
      'Hiking from the door',
      'Free parking',
      'Fire pit',
    ),
    images: [
      image('ridge-cabin-dawn', 'Cabin on the ridge at first light'),
      image('ridge-cabin-stove', 'Interior with wood stove'),
      image('ridge-cabin-bed', 'Bed facing the glass wall'),
      image('ridge-cabin-deck', 'Deck with the valley beyond'),
    ],
    baseNightlyRate: money(42_000),
    currency: 'USD',
    active: true,
  },
];

export function demoPropertyBySlug(slug: string): Property | null {
  return demoProperties.find((property) => property.slug === slug) ?? null;
}

export function demoPropertyById(id: number): Property | null {
  return demoProperties.find((property) => property.id === id) ?? null;
}
