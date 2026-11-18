/**
 * Client reviews a reader can trace to their source — the Navigator version of
 * the live PublishedReviews, reading the same src/config/publishedReviews.ts.
 * Every card names the platform and the date and links to the original. With
 * no published reviews it renders nothing, as the live section does.
 */
import { ExternalLink, Star } from 'lucide-react';
import { PUBLISHED_REVIEWS, type PublishedReview } from '@/config/publishedReviews';
import { SectionHead } from '../sections/SectionHead';
import '../styles/company.css';

interface CompanyReviewsProps {
  reviews?: readonly PublishedReview[];
}

function postedOn(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CompanyReviews({ reviews = PUBLISHED_REVIEWS }: CompanyReviewsProps) {
  if (reviews.length === 0) return null;
  return (
    <section className="nw-sec nw-sec--paper nwco-reviews" aria-labelledby="nwco-reviews-title">
      <div className="nw-wrap">
        <SectionHead
          center
          kicker="Client reviews"
          title="What Our Clients Say"
          titleId="nwco-reviews-title"
          lead="Reviews published by our clients on independent review platforms. Follow any link to read the original."
        />
        <ul className="nwco-review-grid">
          {reviews.map((review) => (
            <li key={review.url} className="nwco-review">
              {review.rating ? (
                <p className="nwco-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: review.rating }, (_, i) => (
                    <Star key={i} size={16} strokeWidth={1.75} aria-hidden="true" />
                  ))}
                </p>
              ) : null}
              <blockquote>&ldquo;{review.quote}&rdquo;</blockquote>
              <p className="nwco-review-by">{review.author}</p>
              <a href={review.url} target="_blank" rel="noopener noreferrer nofollow">
                {review.platform} review · {postedOn(review.postedOn)}
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
