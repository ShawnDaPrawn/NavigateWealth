/**
 * NewsletterIssuePrevious — the issue before this one, read online.
 *
 * Found in the archive the Resources page reads (the public newsletter route),
 * so it is always a published issue with a real address. The miniature cover
 * is drawn, not a picture of the PDF, and says nothing the link does not.
 */
import { Link } from 'react-router';
import {
  formatIssueMonth,
  type PublicNewsletter,
} from '../../components/pages/resources/newsletterArchive';
import { NewsletterIssueIcon } from './NewsletterIssueIcons';
import { NewsletterIssueHeadline } from './NewsletterIssueMasthead';

export function NewsletterIssuePrevious({ newsletter }: { newsletter: PublicNewsletter }) {
  const issue = formatIssueMonth(newsletter.issueMonth);
  return (
    <Link className="nwni-prev" to={`/resources/newsletter/${newsletter.slug}`}>
      <span className="nwni-prev-cover" aria-hidden="true">
        <span className="nwni-prev-frame" />
      </span>
      <span className="nwni-prev-body">
        <span className="nwni-label nwni-prev-label">
          Previous issue{issue ? ` · ${issue}` : ''}
        </span>
        <span className="nw-h nwni-prev-t">
          <NewsletterIssueHeadline title={newsletter.title} />
        </span>
        <span className="nwni-prev-more">
          Read online <NewsletterIssueIcon name="arrowRight" size={15} />
        </span>
      </span>
    </Link>
  );
}
