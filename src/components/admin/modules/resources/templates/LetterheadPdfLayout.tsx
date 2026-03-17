/**
 * LetterheadPdfLayout.tsx
 *
 * Professional company letterhead template for Navigate Wealth.
 * Used for one-off correspondence, client letters, and official communications.
 *
 * Design:
 *   - Elegant top-right company block with logo, address, and contact details
 *   - Left-aligned date, recipient address, and reference/subject line
 *   - Body content rendered via the block system
 *   - Compliance footer with FSP and registration info
 *
 * Extends BASE_PDF_CSS with additional letter-specific styles.
 */

import React, { ReactNode } from 'react';
import { BASE_PDF_CSS } from './BasePdfLayout';

// ============================================================================
// LETTER-SPECIFIC CSS (layered on top of BASE_PDF_CSS)
// ============================================================================

export const LETTER_CSS = `
    ${BASE_PDF_CSS}

    /* ====== LETTERHEAD OVERRIDES ====== */

    .letter-page {
      width: var(--a4-w);
      height: var(--a4-h);
      background: #ffffff;
      border: 1px solid rgba(229,231,235,0.9);
      box-shadow: 0 10px 30px rgba(15,23,42,0.10);
      overflow: hidden;
      position: relative;
      page-break-after: always;
      break-after: page;
    }

    .letter-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .letter-content {
      padding: var(--margin-top) var(--margin-right) var(--margin-bottom-with-footer) var(--margin-left);
      height: 100%;
      position: relative;
      font-size: 10px;
      line-height: 1.6;
      color: var(--text);
    }

    .letter-content.subsequent-page {
      padding-top: 15mm;
    }

    /* === Company Letterhead Block (top of page 1) === */
    .letterhead-block {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 5mm;
      margin-bottom: 6mm;
      border-bottom: 2px solid var(--nw-purple);
    }

    .letterhead-brand {
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
    }

    .letterhead-logo {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.4px;
      line-height: 1;
      color: var(--text);
    }

    .letterhead-logo .lh-accent {
      color: var(--nw-purple);
    }

    .letterhead-tagline {
      font-size: 9px;
      color: var(--muted);
      letter-spacing: 0.3px;
    }

    .letterhead-fsp {
      font-size: 8px;
      color: var(--muted);
      margin-top: 1mm;
    }

    .letterhead-contact {
      text-align: right;
      font-size: 8.5px;
      line-height: 1.55;
      color: #4b5563;
    }

    .letterhead-contact strong {
      color: var(--text);
      font-weight: 600;
    }

    /* === Subsequent Page Header === */
    .letter-continuation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 3mm;
      margin-bottom: 5mm;
      border-bottom: 1px solid var(--border);
      font-size: 8.5px;
      color: var(--muted);
    }

    .letter-continuation-header .cont-brand {
      font-weight: 700;
      color: #374151;
      letter-spacing: 0.15px;
    }

    .letter-continuation-header .cont-brand .cont-accent {
      color: var(--nw-purple);
    }

    /* === Date Line === */
    .letter-date {
      font-size: 10px;
      color: var(--text);
      margin-bottom: 6mm;
    }

    /* === Recipient Block === */
    .letter-recipient {
      font-size: 10px;
      line-height: 1.6;
      color: var(--text);
      margin-bottom: 5mm;
    }

    .letter-recipient .recipient-label {
      font-size: 8px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 1mm;
    }

    /* === Reference / Subject Line === */
    .letter-subject {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 5mm;
      padding-bottom: 2mm;
      border-bottom: 1px solid var(--border);
    }

    .letter-subject .subject-label {
      font-weight: 600;
      color: var(--muted);
      margin-right: 3mm;
    }

    /* === Letter Body === */
    .letter-body {
      font-size: 10px;
      line-height: 1.65;
      color: var(--text);
    }

    .letter-body p {
      margin-bottom: 2.5mm;
    }

    /* === Closing Block === */
    .letter-closing {
      margin-top: 8mm;
      font-size: 10px;
      line-height: 1.6;
    }

    .letter-closing .closing-regards {
      margin-bottom: 4mm;
    }

    .closing-signatories {
      display: flex;
      gap: 12mm;
      flex-wrap: wrap;
    }

    .closing-signatory {
      min-width: 45mm;
    }

    .closing-signature-line {
      width: 50mm;
      border-bottom: 1px solid #374151;
      margin-top: 14mm;
      margin-bottom: 2mm;
    }

    .letter-closing .closing-name {
      font-weight: 700;
      color: var(--text);
    }

    .letter-closing .closing-title {
      font-size: 9px;
      color: var(--muted);
    }

    /* === Letter Footer (compliance) === */
    .letter-footer {
      position: absolute;
      bottom: var(--margin-bottom);
      left: var(--margin-left);
      right: var(--margin-right);
      height: var(--footer-height);
      border-top: 1px solid var(--border);
      padding-top: 3mm;
      font-size: 7.5px;
      line-height: 1.4;
      color: #9ca3af;
    }

    .letter-footer .footer-company {
      font-weight: 600;
      color: #6b7280;
    }

    .letter-footer-cols {
      display: flex;
      gap: 6mm;
      align-items: flex-start;
    }

    .letter-footer-cols .lf-col {
      flex: 1;
    }

    .letter-footer .lf-page {
      width: 18mm;
      font-weight: 700;
      color: #6b7280;
      white-space: nowrap;
      text-align: right;
    }

    /* Print overrides for letter pages */
    @media print {
      .letter-page {
        box-shadow: none;
        border: none;
        width: 210mm;
        height: 297mm;
        page-break-after: always;
        margin: 0;
        padding: 0;
        overflow: visible;
      }

      .letter-page:last-child {
        page-break-after: auto;
      }

      .letter-content {
        height: 297mm;
      }

      .letterhead-block {
        display: flex;
      }

      .letter-footer {
        position: absolute;
        display: block;
      }
    }
`;

// ============================================================================
// LETTER METADATA
// ============================================================================

/** Individual signatory on a letter */
export interface Signatory {
  name?: string;
  title?: string;
}

/** Individual recipient on a letter */
export interface Recipient {
  name?: string;
  title?: string;
  company?: string;
  address?: string;
}

export interface LetterMeta {
  /** @deprecated Use recipients[] instead — single recipient name */
  recipientName?: string;
  /** @deprecated Use recipients[] instead */
  recipientTitle?: string;
  /** @deprecated Use recipients[] instead */
  recipientCompany?: string;
  /** @deprecated Use recipients[] instead */
  recipientAddress?: string;
  /** Multiple recipients (preferred over single-recipient fields) */
  recipients?: Recipient[];
  /** Letter subject/reference */
  subject?: string;
  /** Reference number */
  reference?: string;
  /** Letter date (defaults to today) */
  date?: string;
  /** Closing salutation, e.g. "Yours faithfully" */
  closing?: string;
  /** Multiple signatories (preferred) */
  signatories?: Signatory[];
  /** @deprecated Use signatories[] instead */
  signatoryName?: string;
  /** @deprecated Use signatories[] instead */
  signatoryTitle?: string;
  /** Body font size in px (default: 10) */
  fontSize?: number;
  /** Body line height multiplier (default: 1.65) */
  lineHeight?: number;
}

/**
 * Resolve recipients from LetterMeta — supports the new `recipients[]`
 * array as well as the legacy singular fields.
 */
export function resolveRecipients(meta: LetterMeta): Recipient[] {
  if (meta.recipients && meta.recipients.length > 0) {
    return meta.recipients;
  }
  // Backward compat: build a single-entry array from legacy fields
  if (meta.recipientName || meta.recipientTitle || meta.recipientCompany || meta.recipientAddress) {
    return [{
      name: meta.recipientName,
      title: meta.recipientTitle,
      company: meta.recipientCompany,
      address: meta.recipientAddress,
    }];
  }
  return [];
}

/**
 * Resolve signatories from LetterMeta — supports the new `signatories[]`
 * array as well as the legacy singular `signatoryName/signatoryTitle` fields.
 */
export function resolveSignatories(meta: LetterMeta): Signatory[] {
  if (meta.signatories && meta.signatories.length > 0) {
    return meta.signatories;
  }
  // Backward compat: build a single-entry array from legacy fields
  if (meta.signatoryName || meta.signatoryTitle) {
    return [{
      name: meta.signatoryName,
      title: meta.signatoryTitle,
    }];
  }
  return [];
}

// ============================================================================
// LETTER PAGE COMPONENT
// ============================================================================

interface LetterPageProps {
  children: ReactNode;
  pageNum: number;
  totalPages: number;
  isFirstPage?: boolean;
  isLastPage?: boolean;
  meta?: LetterMeta;
}

const formatLetterDate = (dateStr?: string): string => {
  if (dateStr) return dateStr;
  return new Date().toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const LetterPage = ({
  children,
  pageNum,
  totalPages,
  isFirstPage = false,
  isLastPage = false,
  meta = {},
}: LetterPageProps) => {
  const recipients = resolveRecipients(meta);
  const bodyFontSize = meta.fontSize || 10;
  const bodyLineHeight = meta.lineHeight || 1.65;

  return (
    <div className="letter-page">
      <div className={`letter-content ${!isFirstPage ? 'subsequent-page' : ''}`}>
        {/* ======= PAGE 1: Full Letterhead ======= */}
        {isFirstPage && (
          <div className="contents">
            {/* Company Letterhead */}
            <div className="letterhead-block">
              <div className="letterhead-brand">
                <div className="letterhead-logo">
                  Navigate <span className="lh-accent">Wealth</span>
                </div>
                <div className="letterhead-tagline">
                  Independent Financial Advisory Services
                </div>
                <div className="letterhead-fsp">
                  Authorised Financial Services Provider &mdash; FSP 54606
                </div>
              </div>

              <div className="letterhead-contact">
                <strong>Wealthfront (Pty) Ltd</strong>
                <br />
                t/a Navigate Wealth
                <br />
                Route 21 Corporate Park
                <br />
                25 Sovereign Drive, Milestone Place A
                <br />
                Centurion, 0178
                <br />
                <br />
                Tel: (012) 667 2505
                <br />
                Email: info@navigatewealth.co
              </div>
            </div>

            {/* Date */}
            <div className="letter-date">
              {formatLetterDate(meta.date)}
            </div>

            {/* Recipients */}
            {recipients.length > 0 && (
              <div className="letter-recipient">
                {recipients.map((recipient, idx) => (
                  <div key={idx} style={{ marginBottom: idx < recipients.length - 1 ? '3mm' : undefined }}>
                    {recipient.name && <div style={{ fontWeight: 600 }}>{recipient.name}</div>}
                    {recipient.title && <div>{recipient.title}</div>}
                    {recipient.company && <div>{recipient.company}</div>}
                    {recipient.address && (
                      <div style={{ whiteSpace: 'pre-line' }}>
                        {recipient.address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reference / Subject */}
            {(meta.subject || meta.reference) && (
              <div className="letter-subject">
                {meta.reference && (
                  <span>
                    <span className="subject-label">Ref:</span>
                    {meta.reference}
                    {meta.subject && <span style={{ margin: '0 3mm' }}>&nbsp;&mdash;&nbsp;</span>}
                  </span>
                )}
                {meta.subject && (
                  <span>
                    <span className="subject-label">RE:</span>
                    {meta.subject}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======= SUBSEQUENT PAGES: Minimal Header ======= */}
        {!isFirstPage && (
          <div className="letter-continuation-header">
            <span className="cont-brand">
              Navigate <span className="cont-accent">Wealth</span>
            </span>
            <span>
              {meta.reference ? `Ref: ${meta.reference}` : meta.subject || ''}
              {' '}&mdash;{' '}
              Page {pageNum} of {totalPages}
            </span>
          </div>
        )}

        {/* ======= BODY CONTENT ======= */}
        <main className="letter-body" style={{ fontSize: `${bodyFontSize}px`, lineHeight: bodyLineHeight }}>
          {children}
        </main>

        {/* ======= CLOSING / SIGNATORY (from meta) ======= */}
        {isLastPage && (() => {
          const signatories = resolveSignatories(meta);
          const hasClosing = meta.closing || signatories.length > 0;
          if (!hasClosing) return null;
          return (
            <div className="letter-closing">
              {meta.closing && (
                <div className="closing-regards">{meta.closing},</div>
              )}
              {signatories.length > 0 && (
                <div className="closing-signatories">
                  {signatories.map((signatory, index) => (
                    <div key={index} className="closing-signatory">
                      <div className="closing-signature-line" />
                      {signatory.name && (
                        <div className="closing-name">{signatory.name}</div>
                      )}
                      {signatory.title && (
                        <div className="closing-title">{signatory.title} &mdash; Navigate Wealth</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ======= FOOTER ======= */}
        <footer className="letter-footer">
          <div className="letter-footer-cols">
            <div className="lf-col">
              <span className="footer-company">Wealthfront (Pty) Ltd</span>
              {' '}trading as Navigate Wealth is an Authorised Financial Services Provider &ndash; FSP 54606.
              Registration Number: 2024/071953/07.
            </div>
            <div className="lf-col">
              Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
              Tel: (012) 667 2505 | Email: info@navigatewealth.co
            </div>
            <div className="lf-page">
              Page {pageNum}/{totalPages}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN LETTERHEAD LAYOUT
// ============================================================================

export interface LetterheadPdfLayoutProps {
  children?: ReactNode;
  pages?: ReactNode[];
  meta?: LetterMeta;
}

export const LetterheadPdfLayout = ({
  children,
  pages,
  meta = {},
}: LetterheadPdfLayoutProps) => {
  return (
    <div className="contents">
      <style dangerouslySetInnerHTML={{ __html: LETTER_CSS }} />
      <div className="pdf-preview-container">
        <div className="pdf-viewport">
          {pages && pages.length > 0 ? (
            pages.map((pageContent, index) => (
              <LetterPage
                key={index}
                pageNum={index + 1}
                totalPages={pages.length}
                isFirstPage={index === 0}
                isLastPage={index === pages.length - 1}
                meta={meta}
              >
                {pageContent}
              </LetterPage>
            ))
          ) : (
            <LetterPage
              pageNum={1}
              totalPages={1}
              isFirstPage={true}
              isLastPage={true}
              meta={meta}
            >
              {children}
            </LetterPage>
          )}
        </div>
      </div>
    </div>
  );
};