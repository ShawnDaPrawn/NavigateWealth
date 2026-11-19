/**
 * NewsletterIssueMasthead — the way back to the archive, the issue's masthead
 * and, on a phone, the buttons that stand in for the reader.
 *
 * Everything shown is the published record: the issue month, the title (its
 * last part as the headline, the whole as the byline), the description, and
 * the PDF under its real file name and size. The links are the live page's:
 * "Download PDF" carries the file name as `download`, and "Read the
 * newsletter" opens the PDF in a new tab, where the phone's own viewer takes
 * over (phone browsers cannot page through an embedded PDF).
 */
import { Link } from 'react-router';
import {
  formatIssueMonth,
  type PublicNewsletter,
} from '../../components/pages/resources/newsletterArchive';
import { NewsletterIssueIcon } from './NewsletterIssueIcons';
import {
  ARCHIVE_PATH,
  fileLine,
  issueByline,
  issueHeadline,
  splitHeadline,
} from './NewsletterIssueModel';

/** A headline with the board's italic after the colon. */
export function NewsletterIssueHeadline({ title }: { title: string }) {
  const { lead, accent } = splitHeadline(issueHeadline(title));
  if (!accent) return <>{lead}</>;
  return (
    <>
      {lead} <span className="nwni-accent-l">{accent}</span>
    </>
  );
}

export function NewsletterIssueMasthead({ newsletter }: { newsletter: PublicNewsletter }) {
  const issue = formatIssueMonth(newsletter.issueMonth);
  const byline = issueByline(newsletter.title);
  const file = fileLine(newsletter);

  return (
    <>
      <div className="nwni-top">
        <Link className="nwni-back" to={ARCHIVE_PATH}>
          <NewsletterIssueIcon name="arrowLeft" />
          All newsletters
        </Link>
        {issue ? <span className="nwni-label nwni-issue">{issue}</span> : null}
      </div>

      <section className="nwni-mast" aria-labelledby="nwni-title">
        <div className="nwni-mast-main">
          <p className="nwni-label nw-eyebrow nwni-eyebrow">Navigate Wealth newsletter</p>
          <h1 id="nwni-title" className="nw-h nwni-h1">
            <NewsletterIssueHeadline title={newsletter.title} />
          </h1>
          {byline ? <p className="nwni-byline">{byline}</p> : null}
          {newsletter.description ? <p className="nwni-lead">{newsletter.description}</p> : null}
        </div>
        <div className="nwni-mast-side nwni-only-lg">
          <a className="nw-btn nwni-btn" href={newsletter.pdfUrl} download={newsletter.pdfFileName}>
            <NewsletterIssueIcon name="download" />
            Download PDF
          </a>
        </div>
      </section>

      <div className="nwni-phone nwni-only-sm">
        <a
          className="nw-btn nwni-phone-btn"
          href={newsletter.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <NewsletterIssueIcon name="bookOpen" size={18} />
          Read the newsletter
        </a>
        <a
          className="nw-outline nwni-phone-btn"
          href={newsletter.pdfUrl}
          download={newsletter.pdfFileName}
        >
          <NewsletterIssueIcon name="download" size={18} />
          Download PDF
        </a>
        {file ? <p className="nwni-phone-file">{file}</p> : null}
      </div>
    </>
  );
}
