import type { Site } from './types';

export const SITE: Site = {
  brand: 'W&K Reserve',
  domain: 'wkreserve.com',
  tagline: 'Private estates in the Pocono Mountains',
  subline: 'Pools, saunas and room for everyone. Book direct for the best rate.',
  contactEmail: 'hello@wkreserve.com',
  // Hospitable Direct "New site" (self-hosted) — its styling applies to the checkout
  hospitable: {
    loaderSrc: 'https://cdn.hsptb.com/direct-booking-widget/widget-loader.prod.js',
    siteUuid: 'e617fd89-303f-4d0c-8777-4369493463ff',
    theme: 'multi',
  },
  // Booking UI on property pages:
  //   "native" = W&K booking card → Hospitable quote → redirect to Hospitable checkout
  //   "widget" = original embedded Hospitable widget (kept for fallback / revert)
  bookingMode: 'native',
  attractions: [
    { id: 'camelback', name: 'Camelback Mountain', kind: 'Skiing · Aquatopia waterpark' },
    { id: 'kalahari', name: 'Kalahari Resort', kind: 'Indoor waterpark' },
    { id: 'raceway', name: 'Pocono Raceway', kind: 'NASCAR & events' },
    { id: 'jackfrost', name: 'Jack Frost & Big Boulder', kind: 'Skiing' },
    { id: 'mountairy', name: 'Mount Airy Casino Resort', kind: 'Casino · golf' },
    { id: 'shawnee', name: 'Shawnee Mountain', kind: 'Skiing · tubing' },
    { id: 'dwg', name: 'Delaware Water Gap', kind: 'Hiking · river' },
    { id: 'bushkill', name: 'Bushkill Falls', kind: 'Waterfalls' },
  ],
  everyEstate: ['Hot tub', 'Sauna', 'Movie room', 'Game room', 'Fire pit'],
};
