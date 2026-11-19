/**
 * The newsletter issue page's other states, which the board does not draw:
 * loading, and an issue that is not there. Both are the live page's states in
 * its words, set in the board's masthead style.
 *
 * "Not found" covers two cases, as on the live page: a slug with no published
 * issue (moved or withdrawn) and an issue that could not be fetched at all.
 */
import { Link } from 'react-router';
import { NewsletterIssueIcon } from './NewsletterIssueIcons';
import { ARCHIVE_PATH } from './NewsletterIssueModel';

export function NewsletterIssueLoading() {
  return (
    <div className="nwni-loading" role="status">
      <NewsletterIssueIcon name="spinner" size={20} className="nwni-spin" />
      Loading newsletter…
    </div>
  );
}

export function NewsletterIssueMissing({ failed }: { failed: boolean }) {
  return (
    <section className="nwni-mast nwni-missing" aria-labelledby="nwni-missing-title">
      <div className="nwni-mast-main">
        <p className="nwni-label nw-eyebrow nwni-eyebrow">Navigate Wealth newsletter</p>
        <h1 id="nwni-missing-title" className="nw-h nwni-h1">
          Newsletter not found
        </h1>
        <p className="nwni-lead">
          {failed
            ? 'We could not load this newsletter. Please try again shortly.'
            : 'This newsletter may have been moved or withdrawn.'}
        </p>
        <Link className="nw-btn nwni-btn nwni-missing-btn" to={ARCHIVE_PATH}>
          <NewsletterIssueIcon name="arrowLeft" />
          Back to all newsletters
        </Link>
      </div>
    </section>
  );
}
