import Link from 'next/link';
import type { Property } from '@/data/types';
import type { SearchResult, SuggestedStay } from '@/lib/booking/types';
import { formatStayRange } from '@/lib/dates';
import { plural, specs, wholeDollars } from '@/lib/format';
import { propertyPhotos } from '@/lib/photos';
import { Ph } from '@/components/ui/Ph';
import { CardPhotos } from './CardPhotos';

type Props = {
  property: Property;
  /** Carried to the stay page so dates and guests are prefilled. */
  query?: string;
  nearName?: string;
  /** Live result for the searched dates, when there are any. */
  result?: SearchResult;
  /** Nights in the searched stay, to label the result's total. */
  nights?: number;
  /** Without searched dates: the property's next open stay and its price. */
  suggested?: SuggestedStay;
  onHover?: (id: string | null) => void;
};

/** Cards are 300–400px wide in a 1–3 column grid. */
const CARD_SIZES = '(max-width: 760px) 100vw, (max-width: 1240px) 50vw, 400px';
/** Photos a card can step through: the first few, which lead each property's curated order. */
const CARD_PHOTO_COUNT = 8;

export function PropertyCard({ property: p, query = '', nearName, result, nights, suggested, onHover }: Props) {
  const unavailable = result && !result.available;
  const photos = propertyPhotos(p).slice(0, CARD_PHOTO_COUNT);
  // Like Airbnb: a stay total ("$1,234 for 2 nights", all fees, before taxes),
  // for the searched dates or, without them, the property's next open stay.
  const price =
    result && nights
      ? result.available && result.totalWithoutTaxes !== null
        ? { total: result.totalWithoutTaxes, currency: result.currency, nights }
        : null
      : (suggested ?? null);
  // A suggested stay opens the property with those dates, so its quote matches the card.
  const href = !query && suggested ? `?checkin=${suggested.checkin}&checkout=${suggested.checkout}&adults=1` : query;
  const url = `/stays/${p.slug}${href}`;
  // Photos and details are two links to the same stay, so the photo arrows can sit between them.
  return (
    <div
      className={`card${unavailable ? ' unavailable' : ''}`}
      onMouseEnter={onHover ? () => onHover(p.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      {photos.length ? (
        <CardPhotos photos={photos} href={url} name={p.name} sizes={CARD_SIZES} />
      ) : (
        <Link href={url} tabIndex={-1} aria-hidden="true">
          <Ph label="Photo" />
        </Link>
      )}
      <Link className="card-body" href={url}>
        <div className="card-row">
          <span className="card-title">{p.name}</span>
          <span>★ {p.rating}</span>
        </div>
        <div className="card-tagline">{p.tagline}</div>
        <div className="card-meta">{p.location}</div>
        {nearName ? <div className="card-near">Near {nearName}</div> : null}
        <div className="card-meta">{specs(p)}</div>
        {unavailable ? (
          <div className="card-avail">
            <span className="card-badge">Unavailable for your dates</span>
          </div>
        ) : price ? (
          <div className="card-avail">
            {!result && suggested ? <div className="card-meta">{formatStayRange(suggested.checkin, suggested.checkout)}</div> : null}
            <b>{wholeDollars(price.total, price.currency)}</b> for {plural(price.nights, 'night')}
          </div>
        ) : null}
      </Link>
    </div>
  );
}
