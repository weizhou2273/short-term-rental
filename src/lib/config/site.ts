/**
 * Brand-level content. Everything here is safe to edit without touching code —
 * it is the single place a new operator rebrands the site.
 */
export const site = {
  name: 'Aerie & Oak',
  tagline: 'Architectural retreats, booked direct.',
  description:
    'A small, deliberately curated portfolio of design-led homes. Book direct for the best rate, the full house, and a real person on the other end of the phone.',
  legalName: 'Aerie & Oak Collection LLC',
  email: 'stay@aerieandoak.com',
  phone: '+1 (555) 014-2200',
  phoneHref: 'tel:+15550142200',
  address: {
    locality: 'Hudson',
    region: 'NY',
    country: 'US',
  },
  social: {
    instagram: 'https://instagram.com',
    pinterest: 'https://pinterest.com',
  },
  /** Reasons to book here rather than through an OTA. */
  directBookingBenefits: [
    {
      title: 'No booking fees',
      body: 'Airbnb and Vrbo add 14–20% at checkout. Booking here removes it entirely.',
    },
    {
      title: 'Direct line to the owner',
      body: 'No call-centre scripts. Message us and a person who knows the house answers.',
    },
    {
      title: 'Flexible, human terms',
      body: 'Early check-in, late departure and mid-stay housekeeping arranged on request.',
    },
  ],
  nav: [
    { href: '/properties', label: 'The Homes' },
    { href: '/journal', label: 'Journal' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ],
} as const;

export type Site = typeof site;
