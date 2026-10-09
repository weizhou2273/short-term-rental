import Image from 'next/image';
import Link from 'next/link';
import type { Property } from '@/data/types';
import type { SearchResult, SuggestedStay } from '@/lib/booking/types';
import { formatStayRange } from '@/lib/dates';
import { plural, specs, wholeDollars } from '@/lib/format';
import { coverPhoto } from '@/lib/photos';
import { Ph } from '@/components/ui/Ph';

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

export function PropertyCard({ property: p, query = '', nearName, result, nights, suggested, onHover }: Props) {
  const unavailable = result && !result.available;
  const cover = coverPhoto(p);
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
  return (
    <Link
      className={`card${unavailable ? ' unavailable' : ''}`}
      href={`/stays/${p.slug}${href}`}
      onMouseEnter={onHover ? () => onHover(p.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      {cover ? (
        <div className="card-photo">
          {/* The link is already named by the title below, so the photo is decorative here. */}
          <Image src={cover.src} alt="" fill sizes={CARD_SIZES} />
        </div>
      ) : (
        <Ph label="Photo" />
      )}
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
  );
}
