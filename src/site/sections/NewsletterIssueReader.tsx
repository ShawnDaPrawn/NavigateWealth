/**
 * NewsletterIssueReader — the issue itself, in the browser's own PDF viewer.
 *
 * The live page's embed, kept: a plain <object> of the published PDF (no
 * scripted viewer, so no bundle), with the live fallback inside it for a
 * browser that has no PDF viewer. The board's toolbar sits above it. Its zoom
 * sets the page's width as the board does (540px at 100%, 70% to 150%), and
 * the embed asks the viewer to fit the page to that width with its own toolbar
 * hidden, so there is one set of controls rather than two.
 *
 * Phones never get it (CSS hides it below 640px, as the live page does), so a
 * phone does not fetch the PDF just to load the page; the masthead's buttons
 * open the file instead.
 */
import { useState } from 'react';
import type { PublicNewsletter } from '../../components/pages/resources/newsletterArchive';
import { NewsletterIssueIcon } from './NewsletterIssueIcons';
import { ZOOM, fileLine, pageWidth } from './NewsletterIssueModel';

/** Open parameters for the browser's viewer: fit to width, no second toolbar. */
const VIEWER_PARAMS = '#toolbar=0&navpanes=0&view=FitH';

export function NewsletterIssueReader({ newsletter }: { newsletter: PublicNewsletter }) {
  const [zoom, setZoom] = useState<number>(ZOOM.start);
  const file = fileLine(newsletter);
  const atMin = zoom <= ZOOM.min;
  const atMax = zoom >= ZOOM.max;

  return (
    <section className="nwni-reader nwni-only-lg" aria-label="Newsletter reader">
      <div className="nwni-bar">
        <span className="nw-mono nwni-file">{file}</span>
        <div className="nwni-tools">
          <button
            type="button"
            className="nwni-tool"
            aria-label="Zoom out"
            aria-disabled={atMin || undefined}
            onClick={() => setZoom((z) => Math.max(ZOOM.min, z - ZOOM.step))}
          >
            <NewsletterIssueIcon name="minus" />
          </button>
          <span className="nw-mono nwni-zoom" aria-live="polite">
            {zoom}%
          </span>
          <button
            type="button"
            className="nwni-tool"
            aria-label="Zoom in"
            aria-disabled={atMax || undefined}
            onClick={() => setZoom((z) => Math.min(ZOOM.max, z + ZOOM.step))}
          >
            <NewsletterIssueIcon name="plus" />
          </button>
          <span className="nwni-sep" aria-hidden="true" />
          <a
            className="nwni-tool"
            href={newsletter.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the PDF in a new tab"
          >
            <NewsletterIssueIcon name="externalLink" />
          </a>
          <a
            className="nwni-tool"
            href={newsletter.pdfUrl}
            download={newsletter.pdfFileName}
            aria-label="Download PDF"
          >
            <NewsletterIssueIcon name="download" />
          </a>
        </div>
      </div>
      <div className="nwni-stage">
        <div className="nwni-page" style={{ width: pageWidth(zoom) }}>
          <object
            className="nwni-pdf"
            data={`${newsletter.pdfUrl}${VIEWER_PARAMS}`}
            type="application/pdf"
            aria-label={`${newsletter.title} (PDF)`}
          >
            <div className="nwni-nopdf">
              <NewsletterIssueIcon name="fileText" size={32} />
              <p className="nwni-nopdf-p">Your browser cannot display the PDF here.</p>
              <a
                className="nw-ghost-dark nwni-nopdf-btn"
                href={newsletter.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the PDF in a new tab
              </a>
            </div>
          </object>
        </div>
      </div>
      <p className="nwni-caption">
        The issue opens here in the built-in PDF viewer. If your browser cannot display the PDF
        here, open it in a new tab.
      </p>
    </section>
  );
}
