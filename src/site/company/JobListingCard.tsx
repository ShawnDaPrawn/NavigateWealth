/**
 * One published role on the Careers page: a heading button that expands the
 * full listing. The details stay in the document (`hidden`) while collapsed.
 * `id` is the listing's id, so the shared link /careers#<id> lands on it.
 */
import { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  CircleCheck,
  Clock,
  Link2,
  MapPin,
} from 'lucide-react';
import { copyText } from './clipboard';
import { formatClosingDate, type JobListing } from './careersContent';
import '../styles/company.css';

interface JobListingCardProps {
  listing: JobListing;
  categoryTitle: string;
  expanded: boolean;
  onToggle: () => void;
  onApply: () => void;
}

export function JobListingCard({
  listing,
  categoryTitle,
  expanded,
  onToggle,
  onApply,
}: JobListingCardProps) {
  const [copied, setCopied] = useState(false);
  const detailId = `job-${listing.id}-details`;

  const share = async () => {
    const ok = await copyText(`${window.location.origin}/careers#${listing.id}`);
    setCopied(ok);
  };

  return (
    <article id={listing.id} className="nwco-job" data-open={expanded ? 'true' : undefined}>
      <h3 className="nwco-job-h">
        <button
          type="button"
          className="nwco-job-head"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={onToggle}
        >
          <span className="nwco-job-main">
            <span className="nwco-job-titlerow">
              <span className="nwco-job-title">{listing.title}</span>
              <span className="nwco-job-cat">{categoryTitle}</span>
            </span>
            <span className="nwco-job-meta">
              <span>
                <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                {listing.location}
              </span>
              <span>
                <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                {listing.type}
              </span>
              {listing.closingDate ? (
                <span>
                  <Calendar size={14} strokeWidth={1.75} aria-hidden="true" />
                  Closes {formatClosingDate(listing.closingDate)}
                </span>
              ) : null}
            </span>
          </span>
          <ChevronRight className="nwco-job-chev" size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </h3>
      <div id={detailId} className="nwco-job-body" hidden={!expanded}>
        {listing.description ? <p className="nwco-job-desc">{listing.description}</p> : null}
        {listing.requirements.length > 0 || listing.benefits.length > 0 ? (
          <div className="nwco-job-cols">
            {listing.requirements.length > 0 ? (
              <div>
                <h4>Requirements</h4>
                <ul>
                  {listing.requirements.map((req, i) => (
                    <li key={i}>
                      <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {listing.benefits.length > 0 ? (
              <div>
                <h4>What We Offer</h4>
                <ul className="nwco-job-offer">
                  {listing.benefits.map((benefit, i) => (
                    <li key={i}>
                      <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="nwco-job-actions">
          <button type="button" className="nw-btn" onClick={onApply}>
            Apply Now
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" className="nw-outline" onClick={share}>
            <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
            {copied ? 'Link copied' : 'Share Position'}
          </button>
          <span className="nw-sr-only" role="status">
            {copied ? 'Link to this position copied' : ''}
          </span>
        </div>
      </div>
    </article>
  );
}
