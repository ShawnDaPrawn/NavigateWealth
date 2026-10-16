/**
 * PublishedReviews — client reviews that a reader can trace to their source.
 *
 * Every card names the platform, the date the review was posted and links to
 * the original, so a visitor (or a directory reviewer) can check it. With no
 * reviews to show, the whole section renders nothing rather than an empty
 * shell. The data and its rules live in src/config/publishedReviews.ts.
 */
import { ExternalLink, Star } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { PUBLISHED_REVIEWS, type PublishedReview } from '@/config/publishedReviews';

function formatPostedOn(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PublishedReviewsProps {
  reviews?: readonly PublishedReview[];
}

export function PublishedReviews({ reviews = PUBLISHED_REVIEWS }: PublishedReviewsProps) {
  if (reviews.length === 0) return null;

  return (
    <section className="py-20 section-dark-gray" aria-labelledby="published-reviews-heading">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center mb-16">
          <h2 id="published-reviews-heading" className="text-white mb-4">
            What Our Clients Say
          </h2>
          <p className="text-gray-300 max-w-3xl mx-auto">
            Reviews published by our clients on independent review platforms. Follow any link to
            read the original.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {reviews.map((review) => (
            <Card key={review.url} className="border border-gray-600 bg-gray-800/50">
              <CardContent className="p-6 flex flex-col h-full">
                {review.rating && (
                  <div
                    className="flex items-center mb-4"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {Array.from({ length: review.rating }, (_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                )}
                <blockquote className="text-gray-300 mb-6 leading-relaxed flex-1">
                  &ldquo;{review.quote}&rdquo;
                </blockquote>
                <div>
                  <div className="text-white font-medium">{review.author}</div>
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-sm text-purple-300 hover:text-purple-200 hover:underline"
                  >
                    {review.platform} review · {formatPostedOn(review.postedOn)}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PublishedReviews;
