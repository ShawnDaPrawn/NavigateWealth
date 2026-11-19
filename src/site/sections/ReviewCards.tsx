/**
 * ReviewCards — client reviews a reader can trace to where they were posted.
 *
 * Same rules as the live site's PublishedReviews: every card names the
 * platform and date and links to the original, and with no reviews the
 * section renders nothing. The list and its rules are in
 * src/config/publishedReviews.ts.
 */
import { ExternalLink, Star } from 'lucide-react';
import type { PublishedReview } from '../../config/publishedReviews';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/home.css';

function formatPostedOn(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface ReviewCardsProps {
  index: string;
  reviews: readonly PublishedReview[];
}

export function ReviewCards({ index, reviews }: ReviewCardsProps) {
  if (reviews.length === 0) return null;
  return (
    <section className="nw-sec nw-sec--paper" aria-labelledby="nwrv-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Reviews"
          title="What Our Clients Say"
          lead="Reviews published by our clients on independent review platforms. Follow any link to read the original."
          titleId="nwrv-title"
        />
        <ul className="nwrv-grid">
          {reviews.map((review) => (
            <li key={review.url}>
              <figure className="nwrv-card">
                {review.rating ? (
                  <span
                    className="nwrv-stars"
                    role="img"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {Array.from({ length: review.rating }, (_, i) => (
                      <Star key={i} size={16} fill="currentColor" aria-hidden="true" />
                    ))}
                  </span>
                ) : null}
                <blockquote className="nwrv-quote">&ldquo;{review.quote}&rdquo;</blockquote>
                <figcaption className="nwrv-by">
                  {review.author} ·{' '}
                  <a href={review.url} target="_blank" rel="noopener noreferrer nofollow">
                    {review.platform} review, {formatPostedOn(review.postedOn)}
                    <ExternalLink size={13} strokeWidth={1.75} aria-hidden="true" />
                  </a>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
