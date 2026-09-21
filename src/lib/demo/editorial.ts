import type { WpPage, WpPost, WpPropertyContent } from '@/lib/wordpress/types';

/**
 * Stand-in editorial content for when WordPress is not wired up yet. Mirrors
 * exactly what the CMS would return so the templates are exercised for real.
 */

/** Bundled placeholders — see the note in `demo/properties.ts`. */
const IMG = (name: string, alt: string) => ({
  url: `/demo/${name}.svg`,
  alt,
  width: 1600,
  height: 1067,
});

export const demoPosts: WpPost[] = [
  {
    id: 1,
    slug: 'a-field-guide-to-the-hudson-valley-in-autumn',
    title: 'A field guide to the Hudson Valley in autumn',
    excerpt:
      'Six weeks, roughly late September to early November, when the light goes long and gold and the whole valley turns. Where to walk, what to eat, and when to come.',
    content: `<p>The valley turns from the north down, which means Columbia County peaks a good ten days before Dutchess. If you want the colour at its absolute height, aim for the second week of October and stay through a weekday — the roads empty out on Monday morning.</p>
<h2>Where to walk</h2>
<p>Start with the Harlem Valley Rail Trail from Copake Falls. It is flat, it is quiet, and it runs through a cut in the hills where the maples close overhead. Twenty-six miles if you want them; four is plenty.</p>
<p>For something steeper, Alander Mountain gives you three states from the summit and takes about four hours round trip. Go early. The parking lot at the trailhead fills by nine on a good Saturday.</p>
<h2>Where to eat</h2>
<p>Book Gaskins in Germantown before you arrive — they hold a few walk-in seats at the bar but not many. The Corner in Tivoli does the best breakfast in the county and does not take reservations at all.</p>
<blockquote><p>If you only do one thing: drive Route 22 south from Hillsdale at about four in the afternoon, with the windows down.</p></blockquote>
<h2>When to come</h2>
<p>Late September is warm and green-gold. Mid-October is the postcard. Early November is bare, cold, and the best light of the year for photographs — and the rates are half what they were three weeks earlier.</p>`,
    date: '2025-09-12T09:00:00',
    modified: '2025-09-12T09:00:00',
    featuredImage: IMG('journal-autumn', 'Autumn colour across a valley'),
    author: { name: 'Marin Sayles', avatar: null },
    categories: ['Guides'],
    readingMinutes: 4,
  },
  {
    id: 2,
    slug: 'why-we-ask-you-to-book-direct',
    title: 'Why we ask you to book direct',
    excerpt:
      'It is not loyalty. It is arithmetic — and a better stay on both sides of the transaction.',
    content: `<p>When you book one of our houses on Airbnb, you pay a guest service fee of roughly 14%. We pay a host fee on top of that. Neither of those numbers buys you anything: not a better bed, not a faster reply, not an earlier check-in.</p>
<h2>What changes when you book here</h2>
<p>The fee disappears. On a four-night stay at Stone House No. 4 that is a little over five hundred dollars, which is the difference between a good dinner out and a very good one.</p>
<p>You also get us. Messages here come to a phone, not a queue. If you need a crib, a late departure, or a recommendation for somewhere open on a Tuesday in February, you ask a person who has actually stayed in the house.</p>
<h2>What does not change</h2>
<p>The same cancellation terms. The same cleaning standard. The same insurance. We run payments through the same processors the platforms use, and your card details never touch our servers.</p>`,
    date: '2025-07-30T09:00:00',
    modified: '2025-08-02T09:00:00',
    featuredImage: IMG('journal-room', 'A quiet room with morning light'),
    author: { name: 'Marin Sayles', avatar: null },
    categories: ['Notes'],
    readingMinutes: 3,
  },
  {
    id: 3,
    slug: 'the-case-for-the-three-night-minimum',
    title: 'The case for the three-night minimum',
    excerpt:
      'One night is a hotel. Two is a rush. Three is when a house stops being a rental and starts being somewhere you live for a while.',
    content: `<p>We used to take two-night bookings at every house. We stopped, and guest reviews went up, not down.</p>
<p>Here is what happens on a two-night stay: you arrive at six, you find the light switches, you cook badly in an unfamiliar kitchen, you sleep, you spend Saturday driving to the things you read about, you sleep again, and you leave at eleven on Sunday having never once sat still.</p>
<p>On the third morning something changes. You know where the good mug is. You stop driving. You read on the porch for two hours because there is time to. That is the thing we are actually selling, and it does not fit into forty-eight hours.</p>
<p>The Ridge Cabin still takes two nights midweek, because it is small and because sometimes you just need to disappear. Everything else is three.</p>`,
    date: '2025-05-18T09:00:00',
    modified: '2025-05-18T09:00:00',
    featuredImage: IMG('journal-table', 'A long table set for a slow morning'),
    author: { name: 'Marin Sayles', avatar: null },
    categories: ['Notes'],
    readingMinutes: 3,
  },
];

export const demoPages: WpPage[] = [
  {
    id: 10,
    slug: 'about',
    title: 'About',
    content: `<p>We look after three houses in the Hudson Valley. That is the whole portfolio, and it is deliberate — we have turned down more properties than we have taken on, because the only way to run houses this well is to run very few of them.</p>
<h2>How it works</h2>
<p>Each house is cleaned by the same two people every single turnover. They have keys, they know where things go, and they notice when a lamp stops working before you do. There is no rotating roster of contractors.</p>
<p>Linens are laundered off-site and replaced, not washed in the house between guests. Beds are Naturalmat; the towels are Turkish cotton and get retired long before they go thin.</p>
<h2>Who we are</h2>
<p>Marin ran restaurants for fifteen years before this, which explains the kitchens. Tobias is an architect, which explains everything else. We live twenty minutes from the furthest house.</p>
<h2>Getting in touch</h2>
<p>Email reaches us both. If something is wrong during a stay, call — we would much rather fix it at nine at night than read about it in a review.</p>`,
    excerpt: 'Three houses in the Hudson Valley, run by two people who live nearby.',
    featuredImage: IMG('about-interior', 'A living room in low afternoon light'),
    modified: '2025-08-01T09:00:00',
  },
  {
    id: 11,
    slug: 'terms',
    title: 'Rental terms',
    content: `<h2>Booking and payment</h2>
<p>A 50% deposit is taken at the time of booking. The balance falls due thirty days before arrival and is charged automatically to the card on file. Stays beginning within thirty days are charged in full at booking.</p>
<h2>Cancellation</h2>
<p>Cancel more than sixty days before arrival for a full refund of everything paid. Between sixty and thirty days, the deposit is retained and the balance is not charged. Inside thirty days, the stay is non-refundable — though if we re-book the dates, we refund you what we recover.</p>
<h2>Security deposit</h2>
<p>A refundable hold is placed against the card on file and released within seven days of departure, less the cost of any damage beyond ordinary wear.</p>
<h2>Occupancy</h2>
<p>The number of guests may not exceed the figure shown on the property page. Day visitors are welcome; overnight additions are not, unless agreed in writing.</p>
<h2>Events</h2>
<p>Stone House No. 4 accepts small gatherings by prior arrangement. The other houses do not host events of any kind.</p>
<h2>Pets</h2>
<p>Dogs are welcome at The Glass Barn and Stone House No. 4, up to two, for a fee per stay. They may not be left alone in the house. The Ridge Cabin cannot take pets.</p>`,
    excerpt: 'Deposits, cancellation, occupancy and house rules.',
    featuredImage: null,
    modified: '2025-08-01T09:00:00',
  },
];

export function demoPropertyContent(): Map<number, WpPropertyContent> {
  return new Map<number, WpPropertyContent>([
    [
      101,
      {
        propertyId: 101,
        headline: null,
        intro: null,
        body: null,
        highlights: [
          'Wood-fired hot tub cut into the hillside',
          'Two hundred private acres of orchard and woodland',
          '900 Mbps fibre and a proper desk',
          'Dogs welcome, up to two',
        ],
        neighbourhood: `<p>Ancram is quiet to the point of severity. Hudson is twenty-five minutes north for restaurants and the train; Great Barrington is thirty east for the Berkshires. The nearest real grocery is the Copake Agway, which also sells firewood.</p>`,
        seoTitle: null,
        seoDescription: null,
      },
    ],
    [
      102,
      {
        propertyId: 102,
        headline: null,
        intro: null,
        body: null,
        highlights: [
          'Eight-metre lap pool, heated May to October',
          'Kitchen garden you are welcome to raid',
          'Wood-fired pizza oven and outdoor dining for twelve',
          'Small gatherings by arrangement',
        ],
        neighbourhood: `<p>Millerton has a bookshop, a very good cheese counter and a bakery that sells out by ten. The Harlem Valley Rail Trail starts at the edge of the village. Wassaic station puts you on a train to Grand Central in just under two hours.</p>`,
        seoTitle: null,
        seoDescription: null,
      },
    ],
    [
      103,
      {
        propertyId: 103,
        headline: null,
        intro: null,
        body: null,
        highlights: [
          'No neighbours in any direction',
          'Claw-foot tub on the deck',
          'Starlink, with a switch to turn it off',
          'Trailhead at the door',
        ],
        neighbourhood: `<p>Windham is a ski town in winter and almost empty the rest of the year. The Escarpment Trail is fifteen minutes away. Bring groceries — the last shop of any size is in Cairo, forty minutes back down the mountain.</p>`,
        seoTitle: null,
        seoDescription: null,
      },
    ],
  ]);
}
