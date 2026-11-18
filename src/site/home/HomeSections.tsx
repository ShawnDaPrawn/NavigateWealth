/**
 * The static sections of the Navigator home page, top to bottom: the
 * audience paths, the services grid, "Why us?", the partner logos and (when
 * there are any) published client reviews. Copy and links come from the live
 * page's data (homePageData.tsx) and the site navigation.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ExternalLink, Star } from 'lucide-react';
import { services, providers, whyNavigate } from '../../components/pages/homePageData';
import { solutionItems } from '../../components/layout/navigationData';
import { PUBLISHED_REVIEWS, type PublishedReview } from '../../config/publishedReviews';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { pad2 } from '../sections/format';
import { CardLink } from './HomeParts';
import { NwLogo } from '../components/NwLogo';
import { PartnersDialog } from './PartnersDialog';
import { formatPostedOn, saSpelling } from './homeContent';

/** "Tailored guidance for wherever you are." — individuals, businesses, advisers. */
export function PathsSection() {
  return (
    <section className="nwhm-paths" aria-labelledby="nwhm-paths-title">
      <div className="nw-wrap">
        <div className="nwhm-head-row">
          <SectionHead
            kicker="Solutions"
            title="Tailored guidance for wherever you are."
            titleId="nwhm-paths-title"
            className="nwhm-paths-head"
          />
          <Link className="nwhm-textlink" to="/services">
            View all services
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <ul className="nwhm-paths-grid">
          {solutionItems.map((item) => (
            <li key={item.path}>
              <Link className="nwhm-path" to={item.path}>
                <span className="nwhm-path-i" aria-hidden="true">
                  <item.icon size={24} strokeWidth={1.75} />
                </span>
                <span className="nwhm-path-txt">
                  <span className="nwhm-path-t">{item.label}</span>
                  <span className="nwhm-path-d">{item.description}</span>
                </span>
                <span className="nwhm-path-go" aria-hidden="true">
                  <ArrowRight size={17} strokeWidth={1.75} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ServicesGrid({ index }: { index: string }) {
  return (
    <section id="services" className="nw-sec nw-sec--white" aria-labelledby="nwhm-svc-title">
      <div className="nw-wrap">
        <div className="nwhm-head-row">
          <SectionHead
            index={index}
            kicker="Services"
            title="Our Services"
            titleId="nwhm-svc-title"
            lead="Comprehensive financial solutions designed to protect and grow your wealth at every stage of life."
          />
          <Link className="nwhm-textlink" to="/services">
            View all services
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <ul className="nwhm-svc">
          {services.map((service, i) => (
            <li key={service.link} className="nwhm-card">
              <div className="nwhm-card-media">
                <NwImage
                  src={service.image}
                  imageKey={service.imageKey}
                  alt={service.title}
                  sizes="(max-width: 640px) 104px, (max-width: 900px) 50vw, (max-width: 1320px) 25vw, 320px"
                  width={400}
                  height={300}
                />
                <span className="nwhm-card-no nw-mono" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
              </div>
              <div className="nwhm-card-body">
                <h3 className="nwhm-card-t">
                  <CardLink to={service.link}>{service.title}</CardLink>
                </h3>
                <p className="nwhm-card-d">{saSpelling(service.description)}</p>
                <span className="nwhm-card-cta" aria-hidden="true">
                  Learn More
                  <ArrowRight size={15} strokeWidth={1.75} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function WhyUsSection({ index }: { index: string }) {
  return (
    <section className="nw-sec nwhm-why" aria-labelledby="nwhm-why-title">
      <div className="nw-grid-bg nwhm-fade-c" aria-hidden="true" />
      <div className="nw-wrap nwhm-rel">
        <SectionHead
          index={index}
          kicker="Why us?"
          title="Why us?"
          titleId="nwhm-why-title"
          center
          dark
        />
        <div className="nwhm-why-track">
          <ol className="nwhm-why-list">
            {whyNavigate.map((item, i) => (
              <li key={item.title}>
                <span className="nwhm-why-i" aria-hidden="true">
                  <item.icon size={26} strokeWidth={1.75} />
                </span>
                <span className="nwhm-why-n nw-mono" aria-hidden="true">
                  Waypoint {pad2(i + 1)}
                </span>
                <h3 className="nwhm-why-t">{item.title}</h3>
                <p className="nwhm-why-d">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function PartnersSection({ index }: { index: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section id="partners" className="nw-sec nw-sec--paper" aria-labelledby="nwhm-partners-title">
      <div className="nw-wrap">
        <div className="nwhm-head-row">
          <SectionHead
            index={index}
            kicker="Partners"
            title="Trusted Partners"
            titleId="nwhm-partners-title"
            lead="Navigate Wealth works with established South African product providers, so you can compare quality solutions side by side."
          />
          <PartnersDialog open={open} onOpenChange={setOpen}>
            <button type="button" className="nw-outline">
              View All Partners
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </PartnersDialog>
        </div>
        <ul className="nwhm-logos">
          {providers.map((provider) => (
            <li key={provider.name}>
              <NwLogo src={provider.logo} alt={`${provider.name} logo`} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Client reviews a reader can trace: each names its platform and date and
 * links to the original. With none published (src/config/publishedReviews.ts),
 * the section renders nothing, as the live page's PublishedReviews does.
 */
export function ReviewsSection({
  index,
  reviews = PUBLISHED_REVIEWS,
}: {
  index: string;
  reviews?: readonly PublishedReview[];
}) {
  if (reviews.length === 0) return null;
  return (
    <section className="nw-sec nw-sec--white" aria-labelledby="nwhm-reviews-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Reviews"
          title="What Our Clients Say"
          titleId="nwhm-reviews-title"
          lead="Reviews published by our clients on independent review platforms. Follow any link to read the original."
        />
        <ul className="nwhm-reviews">
          {reviews.map((review) => (
            <li key={review.url} className="nwhm-review">
              {review.rating ? (
                <span
                  className="nwhm-stars"
                  role="img"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {Array.from({ length: review.rating }, (_, i) => (
                    <Star key={i} size={16} strokeWidth={1.75} aria-hidden="true" />
                  ))}
                </span>
              ) : null}
              <blockquote>&ldquo;{review.quote}&rdquo;</blockquote>
              <p className="nwhm-review-by">{review.author}</p>
              <a href={review.url} target="_blank" rel="noopener noreferrer nofollow">
                {review.platform} review · {formatPostedOn(review.postedOn)}
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
