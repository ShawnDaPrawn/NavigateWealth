import {
  normalizeLegalDocumentAnchors,
  sanitizeLegalDocumentHtml,
  type LegalDocumentTocItem,
} from '../../utils/legalHtml';
import type { LegalPdfConfig, LegalPdfDocumentData, LegalPdfTocItem } from './LegalDocumentPdf';

export const DEFAULT_LEGAL_PDF_CONFIG: LegalPdfConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
};

export const LEGAL_PDF_CONTENT_CSS = `
  .legal-pdf-body {
    color: #111827;
    font-size: 10px;
    line-height: 1.68;
  }

  .legal-pdf-block {
    margin: 0;
    display: flow-root;
  }

  .legal-pdf-block.allow-split {
    page-break-inside: auto;
    break-inside: auto;
  }

  .legal-pdf-body h1,
  .legal-pdf-body h2,
  .legal-pdf-body h3,
  .legal-pdf-body h4 {
    color: #111827;
    page-break-after: avoid;
    break-after: avoid;
  }

  .legal-pdf-body h1 {
    font-size: 15px !important;
    font-weight: 800 !important;
    margin: 0 0 3.6mm !important;
  }

  .legal-pdf-body h2 {
    font-size: 13px !important;
    font-weight: 800 !important;
    margin: 7mm 0 2.4mm !important;
    padding: 0 0 1.2mm !important;
    border-bottom: 1px solid #e5e7eb;
  }

  .legal-pdf-body h3 {
    font-size: 11px !important;
    font-weight: 700 !important;
    margin: 5.2mm 0 2mm !important;
  }

  .legal-pdf-body h4 {
    font-size: 10.2px !important;
    font-weight: 700 !important;
    margin: 4mm 0 1.6mm !important;
  }

  .legal-pdf-body p,
  .legal-pdf-body li,
  .legal-pdf-body blockquote {
    font-size: 10px;
    line-height: 1.68;
    orphans: 3;
    widows: 3;
  }

  .legal-pdf-body p {
    margin: 0 0 3mm;
  }

  .legal-pdf-body p.legal-pdf-paragraph-fragment {
    margin: 0;
  }

  .legal-pdf-body p.legal-pdf-paragraph-fragment.last-fragment {
    margin: 0 0 3mm;
  }

  .legal-pdf-body ul,
  .legal-pdf-body ol {
    margin: 0 0 3.5mm;
    padding-left: 5.2mm;
  }

  .legal-pdf-body li {
    margin-bottom: 1.5mm;
  }

  .legal-pdf-body table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin: 0;
  }

  .legal-pdf-body thead {
    display: table-header-group;
  }

  .legal-pdf-body th,
  .legal-pdf-body td {
    border: 1px solid #d1d5db;
    padding: 2.2mm 2.4mm;
    text-align: left;
    vertical-align: top;
  }

  .legal-pdf-body th {
    background: #f5f5f4;
    font-weight: 700;
    color: #1f2937;
  }

  .legal-pdf-table-wrap {
    overflow: hidden;
    border-radius: 4px;
    margin: 0 0 3.5mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .legal-pdf-body blockquote {
    margin: 0 0 3mm;
    padding: 3mm 4mm;
    background: #fafaf9;
    border-left: 3px solid #2563eb;
    color: #374151;
  }

  .legal-pdf-signatures,
  .legal-signatures {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5mm;
    margin-top: 4mm;
  }

  .legal-pdf-signature-line,
  .legal-signature-line {
    min-height: 16mm;
  }

  .legal-pdf-signature-line .line,
  .legal-signature-line .line {
    height: 11mm;
    border-bottom: 1px solid #6b7280;
    margin-bottom: 1.6mm;
  }

  .legal-pdf-signature-line span,
  .legal-signature-line span {
    display: block;
    font-size: 8.6px;
    font-weight: 600;
    color: #4b5563;
  }

  .legal-pdf-body a {
    color: #2563eb;
    text-decoration: none;
  }

  .legal-pdf-body strong {
    color: #111827;
    font-weight: 700;
  }

  .legal-pdf-body em {
    font-style: italic;
  }

  .legal-pdf-body u {
    text-decoration: underline;
  }

  .legal-pdf-body .legal-page-break,
  .legal-pdf-page-break {
    height: 0;
    border: 0;
    margin: 0;
    page-break-after: always;
    break-after: page;
  }
`;

function formatLongDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeLegalPdfToc(toc: LegalPdfTocItem[] | LegalDocumentTocItem[] | undefined) {
  return (toc || []).map((item) => ({
    id: item.id,
    title: item.title,
    level: item.level,
  }));
}

export function getNormalizedLegalPdfDocument(document: LegalPdfDocumentData) {
  const sanitizedHtml = sanitizeLegalDocumentHtml(document.html || '<p></p>');
  const preferredToc = normalizeLegalPdfToc(document.toc);
  const anchored = normalizeLegalDocumentAnchors(sanitizedHtml, preferredToc);

  return {
    html: anchored.html,
    toc: anchored.toc,
  };
}

export function buildLegalPagedPrintSource(document: LegalPdfDocumentData) {
  const pdfConfig = document.pdfConfig || DEFAULT_LEGAL_PDF_CONFIG;
  const normalized = getNormalizedLegalPdfDocument(document);
  const mastheadLabel = (document.sectionLabel || document.title || 'LEGAL DOCUMENT').toUpperCase();
  const issueDate = formatLongDate(document.updatedAt || document.effectiveDate);
  const footerText = 'Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider - FSP 54606. Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178. For inquiries, please contact us at Tel: (012) 667 2505.';

  const styles = `
    @page {
      size: ${pdfConfig.pageSize} ${pdfConfig.orientation};
      margin: 18mm 16mm 23mm 16mm;

      @top-left {
        content: string(legal-masthead-label);
        font-size: 8px;
        font-weight: 700;
        color: #1f2937;
        vertical-align: bottom;
      }

      @top-right {
        content: string(legal-masthead-meta);
        font-size: 7px;
        color: #4b5563;
        text-align: right;
        vertical-align: bottom;
      }

      @bottom-left {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 7px;
        font-weight: 600;
        color: #6b7280;
      }

      @bottom-center {
        content: "${footerText.replace(/"/g, '\\"')}";
        font-size: 6.5px;
        color: #6b7280;
      }
    }

    @page :first {
      margin-top: 12mm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      counter-reset: page 0;
    }

    ${LEGAL_PDF_CONTENT_CSS}

    .legal-paged-document {
      width: 100%;
    }

    .legal-paged-running-meta {
      position: running(legal-masthead-meta-box);
    }

    .legal-paged-string-source {
      height: 0;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      position: absolute;
    }

    .legal-paged-string-source.masthead-label {
      string-set: legal-masthead-label content(text);
    }

    .legal-paged-string-source.masthead-meta {
      string-set: legal-masthead-meta content(text);
    }

    .legal-paged-cover {
      margin: 10mm 0 7mm;
      page-break-after: avoid;
      break-after: avoid;
    }

    .legal-paged-top-masthead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 4mm;
      margin-bottom: 6mm;
    }

    .legal-paged-brand {
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
    }

    .legal-paged-brand-logo {
      font-size: 9mm;
      font-weight: 800;
      line-height: 1;
      color: #111827;
    }

    .legal-paged-brand-logo span {
      color: #7c3aed;
    }

    .legal-paged-brand-subline {
      font-size: 8px;
      color: #6b7280;
    }

    .legal-paged-doc-head {
      min-width: 64mm;
      text-align: right;
    }

    .legal-paged-doc-title {
      font-size: 16px;
      line-height: 1.2;
      font-weight: 800;
      margin: 0 0 2.4mm;
      color: #111827;
    }

    .legal-paged-doc-meta {
      display: inline-grid;
      grid-template-columns: auto auto;
      gap: 1mm 4mm;
      font-size: 8px;
      color: #6b7280;
    }

    .legal-paged-doc-meta strong {
      color: #374151;
      font-weight: 600;
    }

    .legal-paged-divider {
      border: 0;
      border-top: 2px solid #6b7280;
      margin: 0 0 6mm;
    }

    .legal-paged-body {
      width: 100%;
    }

    .legal-paged-body .legal-page-break {
      break-after: page;
      page-break-after: always;
    }

    .legal-paged-preview-root {
      background: #eef2ff;
      padding: 24px;
    }

    .legal-paged-preview-root .pagedjs_pages {
      display: flex;
      flex-direction: column;
      gap: 24px;
      align-items: center;
    }

    .legal-paged-preview-root .pagedjs_page {
      background: #ffffff;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
    }

    .legal-paged-preview-root .pagedjs_pagebox {
      box-shadow: none;
    }

    .legal-paged-preview-root .pagedjs_margin-top,
    .legal-paged-preview-root .pagedjs_margin-bottom {
      color: #4b5563;
    }
  `;

  const markup = `
    <div class="legal-paged-document">
      <div class="legal-paged-string-source masthead-label">${escapeHtml(mastheadLabel)}</div>
      <div class="legal-paged-string-source masthead-meta">Wealthfront (Pty) Ltd t/a Navigate Wealth | FSP 54606 | Email: info@navigatewealth.co</div>

      <section class="legal-paged-cover">
        <div class="legal-paged-top-masthead">
          <div class="legal-paged-brand">
            <div class="legal-paged-brand-logo">Navigate <span>Wealth</span></div>
            <div class="legal-paged-brand-subline">Independent Financial Advisory Services</div>
          </div>
          <div class="legal-paged-doc-head">
            <h1 class="legal-paged-doc-title">${escapeHtml(document.title)}</h1>
            <div class="legal-paged-doc-meta">
              <strong>Issue date</strong>
              <span>${escapeHtml(issueDate)}</span>
            </div>
          </div>
        </div>
        <hr class="legal-paged-divider" />
      </section>

      <main class="legal-paged-body legal-pdf-body">
        ${normalized.html}
      </main>
    </div>
  `;

  return {
    config: pdfConfig,
    styles,
    markup,
    toc: normalized.toc,
    normalizedHtml: normalized.html,
  };
}
