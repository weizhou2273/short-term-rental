import { describe, expect, it } from 'vitest';
import { mapAvailability, mapProperty, mapQuote } from '@/lib/ownerrez/mapper';
import { orAvailabilitySpanSchema, orListingSchema, orPropertySchema, orQuoteSchema, parseMany } from '@/lib/ownerrez/schema';
import { chunkToken, unchunkToken } from '@/lib/payments/metadata';
import { slugify, uniqueSlug } from '@/lib/util/slug';

describe('OwnerRez schemas', () => {
  it('tolerates unknown fields added upstream', () => {
    const result = orPropertySchema.safeParse({
      id: 1,
      name: 'A house',
      some_new_field_ownerrez_added: true,
    });
    expect(result.success).toBe(true);
  });

  it('trims a timestamp down to a calendar date', () => {
    const result = orAvailabilitySpanSchema.safeParse({
      start_date: '2026-07-01T00:00:00Z',
      end_date: '2026-07-03',
      is_available: false,
    });
    expect(result.success && result.data.start_date).toBe('2026-07-01');
  });

  it('skips malformed rows instead of discarding the whole response', () => {
    const rows = [
      { id: 1, name: 'Good' },
      { id: 'not-a-number', name: 'Bad' },
      { id: 3, name: 'Also good' },
    ];
    expect(parseMany(orPropertySchema, rows, 'property')).toHaveLength(2);
  });
});

describe('mapProperty', () => {
  const raw = orPropertySchema.parse({
    id: 42,
    name: 'Stone House',
    active: true,
    address: { city: 'Millerton', state: 'NY', country: 'US' },
    max_guests: 8,
    bedrooms: 4,
    bathrooms: 3,
    currency_code: 'usd',
    check_in: '4:00 PM',
  });

  it('maps the core record', () => {
    const property = mapProperty(raw, null, 'stone-house');
    expect(property.id).toBe(42);
    expect(property.currency).toBe('USD');
    expect(property.location.locality).toBe('Millerton');
    expect(property.capacity.maxGuests).toBe(8);
    expect(property.rules.checkInTime).toBe('4:00 PM');
  });

  it('falls back sensibly when the listing is missing', () => {
    const property = mapProperty(raw, null, 'stone-house');
    expect(property.headline).toBe('Stone House');
    expect(property.images).toEqual([]);
    expect(property.amenities).toEqual([]);
  });

  it('prefers listing content and orders images by sort order', () => {
    const listing = orListingSchema.parse({
      property_id: 42,
      headline: 'An 1840s farmhouse',
      short_description: '<p>Original beams &amp; lime plaster.</p>',
      images: [
        { url: 'https://cdn/b.jpg', sort_order: 2, caption: 'Second' },
        { large_url: 'https://cdn/a-large.jpg', url: 'https://cdn/a.jpg', sort_order: 1 },
        { caption: 'No url at all', sort_order: 0 },
      ],
      amenities: ['Pool', { name: 'Fireplace' }, 'Pool'],
      max_guests: 10,
    });

    const property = mapProperty(raw, listing, 'stone-house');
    expect(property.headline).toBe('An 1840s farmhouse');
    // Markup stripped and entities decoded for the card summary.
    expect(property.summary).toBe('Original beams & lime plaster.');
    // Sorted, url-less image dropped, large variant preferred.
    expect(property.images.map((image) => image.url)).toEqual([
      'https://cdn/a-large.jpg',
      'https://cdn/b.jpg',
    ]);
    // Deduplicated, and object-shaped amenities understood.
    expect(property.amenities.map((a) => a.label)).toEqual(['Pool', 'Fireplace']);
    // Listing capacity wins over the property record.
    expect(property.capacity.maxGuests).toBe(10);
  });
});

describe('mapAvailability', () => {
  it('expands spans to nights, covering the inclusive end date', () => {
    const spans = parseMany(
      orAvailabilitySpanSchema,
      [{ start_date: '2026-07-02', end_date: '2026-07-03', is_available: false, type: 'Booked' }],
      'span',
    );
    const calendar = mapAvailability(1, '2026-07-01', '2026-07-05', spans);
    const status = Object.fromEntries(calendar.nights.map((n) => [n.date, n.status]));

    expect(status['2026-07-01']).toBe('available');
    expect(status['2026-07-02']).toBe('booked');
    expect(status['2026-07-03']).toBe('booked');
    expect(status['2026-07-04']).toBe('available');
  });

  it('lets a later span win on overlap', () => {
    const spans = parseMany(
      orAvailabilitySpanSchema,
      [
        { start_date: '2026-07-01', end_date: '2026-07-04', is_available: true, amount: 500 },
        { start_date: '2026-07-02', end_date: '2026-07-02', is_available: false },
      ],
      'span',
    );
    const calendar = mapAvailability(1, '2026-07-01', '2026-07-05', spans);
    expect(calendar.nights.find((n) => n.date === '2026-07-02')!.status).toBe('blocked');
    expect(calendar.nights.find((n) => n.date === '2026-07-01')!.rate!.amount).toBe(50_000);
  });

  it('marks unavailable nights as not checkin-able', () => {
    const spans = parseMany(
      orAvailabilitySpanSchema,
      [{ start: '2026-07-02', end: '2026-07-02', available: false }],
      'span',
    );
    const calendar = mapAvailability(1, '2026-07-01', '2026-07-04', spans);
    expect(calendar.nights.find((n) => n.date === '2026-07-02')!.canCheckIn).toBe(false);
  });

  it('ignores a span with no usable bounds', () => {
    const calendar = mapAvailability(1, '2026-07-01', '2026-07-04', [
      { is_available: false } as never,
    ]);
    expect(calendar.nights.every((night) => night.status === 'available')).toBe(true);
  });
});

describe('mapQuote', () => {
  const request = {
    propertyId: 1,
    arrival: '2026-07-01',
    departure: '2026-07-04',
    guests: { adults: 2, children: 0, infants: 0, pets: 0 },
  };

  it('classifies charges and pulls the deposit out of the total', () => {
    const raw = orQuoteSchema.parse({
      id: 555,
      currency_code: 'USD',
      total_amount: 2_400,
      security_deposit: 1_000,
      charges: [
        { amount: 2_000, type: 'Rent', description: 'Rent', position: 1 },
        { amount: 200, type: 'Fee', description: 'Cleaning', position: 2 },
        { amount: -100, type: 'Discount', description: 'Weekly', position: 3 },
        { amount: 300, type: 'Tax', description: 'Lodging tax', position: 4 },
        { amount: 1_000, type: 'SecurityDeposit', description: 'Hold', position: 5 },
      ],
    });

    const quote = mapQuote(raw, request);

    expect(quote.lines.map((line) => line.kind)).toEqual([
      'accommodation',
      'fee',
      'discount',
      'tax',
    ]);
    expect(quote.securityDeposit!.amount).toBe(100_000);
    expect(quote.total.amount).toBe(240_000);
    expect(quote.subtotal.amount).toBe(190_000); // rent less the discount
    expect(quote.externalQuoteId).toBe('555');
    expect(quote.estimated).toBe(false);
    expect(quote.nights).toBe(3);
  });

  it('treats an untyped negative charge as a discount', () => {
    const raw = orQuoteSchema.parse({
      charges: [{ amount: -50, description: 'Goodwill' }],
    });
    expect(mapQuote(raw, request).lines[0]!.kind).toBe('discount');
  });

  it('sums the lines when no total is supplied', () => {
    const raw = orQuoteSchema.parse({
      charges: [
        { amount: 100, type: 'Rent' },
        { amount: 25, type: 'Fee' },
      ],
    });
    expect(mapQuote(raw, request).total.amount).toBe(12_500);
  });
});

describe('slugs', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Stone House No. 4')).toBe('stone-house-no-4');
    expect(slugify('Aerie & Oak')).toBe('aerie-and-oak');
    expect(slugify('Café Résidence')).toBe('cafe-residence');
  });

  it('disambiguates a collision with the property id', () => {
    const taken = new Set<string>();
    expect(uniqueSlug('The Barn', 1, taken)).toBe('the-barn');
    expect(uniqueSlug('The Barn', 2, taken)).toBe('the-barn-2');
  });

  it('falls back when a name yields nothing usable', () => {
    expect(uniqueSlug('!!!', 7, new Set())).toBe('property-7');
  });
});

describe('payment metadata chunking', () => {
  it('round-trips a token longer than one Stripe metadata value', () => {
    const token = 'x'.repeat(1_400);
    const chunks = chunkToken('draft', token);
    expect(Object.keys(chunks).length).toBeGreaterThan(2);
    expect(Object.values(chunks).every((value) => value.length <= 500)).toBe(true);
    expect(unchunkToken('draft', chunks)).toBe(token);
  });

  it('returns null when metadata carries no token', () => {
    expect(unchunkToken('draft', {})).toBeNull();
    expect(unchunkToken('draft', null)).toBeNull();
  });

  it('refuses a truncated token rather than returning half of one', () => {
    const chunks = chunkToken('draft', 'y'.repeat(1_000));
    delete chunks.draft_1;
    expect(unchunkToken('draft', chunks)).toBeNull();
  });

  it('rejects a token beyond the metadata budget', () => {
    expect(() => chunkToken('draft', 'z'.repeat(10_000))).toThrow(RangeError);
  });
});
