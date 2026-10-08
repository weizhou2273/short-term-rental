import Image from 'next/image';
import Link from 'next/link';
import type { Property } from '@/data/types';
import type { SearchResult } from '@/lib/booking/types';
import { specs, wholeDollars } from '@/lib/format';
import { coverPhoto } from '@/lib/photos';
import { Ph } from '@/components/ui/Ph';

type Props = {
  property: Property;
  /** Carried to the stay page so dates and guests are prefilled. */
  query?: string;
  nearName?: string;
  /** Live result for the searched dates, when there are any. */
  result?: SearchResult;
  onHover?: (id: string | null) => void;
};

/** Cards are 300–400px wide in a 1–3 column grid. */
const CARD_SIZES = '(max-width: 760px) 100vw, (max-width: 1240px) 50vw, 400px';

export function PropertyCard({ property: p, query = '', nearName, result, onHover }: Props) {
  const unavailable = result && !result.available;
  const cover = coverPhoto(p);
  return (
    <Link
      className={`card${unavailable ? ' unavailable' : ''}`}
      href={`/stays/${p.slug}${query}`}
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
      <div className="card-meta">{p.location}</div>
      {nearName ? <div className="card-near">Near {nearName}</div> : null}
      <div className="card-meta">{specs(p)}</div>
      {result ? (
        result.available ? (
          <div className="card-avail">
            {result.nightlyAverage !== null ? (
              <>
                <b>{wholeDollars(result.nightlyAverage, result.currency)}</b> / night avg
              </>
            ) : null}
            {result.totalWithoutTaxes !== null ? (
              <div className="muted">{wholeDollars(result.totalWithoutTaxes, result.currency)} total before taxes</div>
            ) : null}
          </div>
        ) : (
          <div className="card-avail">
            <span className="card-badge">Unavailable for your dates</span>
          </div>
        )
      ) : (
        <div className="card-price">
          From <b>${p.priceFrom}</b> / night
        </div>
      )}
    </Link>
  );
}
