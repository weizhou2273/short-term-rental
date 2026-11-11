'use client';

import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { REVIEW_HISTORY } from '@/data/reviews';
import type { GuestReview } from '@/data/types';
import { plural } from '@/lib/format';

/** Reviews added to the list per "Show more". */
const STEP = 30;

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="review-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      <span className="review-stars-off">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * "Show N guest reviews": the home's 4- and 5-star reviews in a dialog,
 * newest first. The list (up to ~110 KB) loads when the guest points at or
 * opens the button, not with the page.
 */
export function ReviewHistory({ slug, rating, reviewCount }: { slug: string; rating: number; reviewCount: number }) {
  const history = REVIEW_HISTORY[slug];
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<GuestReview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(STEP);
  // Stable, so the dialog doesn't re-run its focus handling on every render.
  const close = useCallback(() => setOpen(false), []);

  if (!history) return null;

  const load = () => {
    if (reviews || loading) return;
    setLoading(true);
    setFailed(false);
    history
      .load()
      .then(setReviews, () => setFailed(true))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <button
        className="btn review-more"
        onPointerEnter={load}
        onFocus={load}
        onClick={() => {
          load();
          setLimit(STEP);
          setOpen(true);
        }}
      >
        Show {history.shown} guest reviews
      </button>
      <Modal title="Guest reviews" open={open} onClose={close}>
        <p className="review-note">
          {plural(history.shown, 'review')} rated 4 or 5 stars, newest first, going back to {history.since}. The ★ {rating} rating is the average of
          all {plural(reviewCount, 'review')}, including the few below 4 stars.
        </p>
        {reviews ? (
          <>
            <div className="review-list">
              {reviews.slice(0, limit).map((r, i) => (
                <article key={`${i}-${r.name}-${r.date}`}>
                  <div className="review-head">
                    <span className="avatar" aria-hidden="true">
                      {r.name.charAt(0)}
                    </span>
                    <div>
                      <strong>{r.name}</strong>
                      <div className="muted review-meta">
                        <Stars rating={r.rating} /> · {r.date}
                      </div>
                    </div>
                  </div>
                  <p className="review-text">{r.text}</p>
                </article>
              ))}
            </div>
            {reviews.length > limit ? (
              <button className="btn review-more" onClick={() => setLimit((n) => n + STEP)}>
                Show more reviews ({reviews.length - limit} left)
              </button>
            ) : null}
          </>
        ) : failed ? (
          <p className="muted">
            The reviews didn’t load.{' '}
            <button className="btn-link" onClick={load}>
              Try again
            </button>
          </p>
        ) : (
          <p className="muted" aria-live="polite">
            Loading reviews…
          </p>
        )}
      </Modal>
    </>
  );
}
