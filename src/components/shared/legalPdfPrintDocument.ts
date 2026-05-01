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
    font-size: 9.8px;
    line-height: 1.5;
    hyphens: none;
    word-break: normal;
    overflow-wrap: break-word;
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
    break-after: avoid-page;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .legal-pdf-body h1 {
    font-size: 11.2px !important;
    font-weight: 800 !important;
    margin: 0 0 2.6mm !important;
    padding: 0 0 1.2mm !important;
    border-bottom: 1px solid #e5e7eb;
  }

  .legal-pdf-body h2 {
    font-size: 10.7px !important;
    font-weight: 800 !important;
    margin: 5.2mm 0 1.9mm !important;
    padding: 0 0 1.2mm !important;
    border-bottom: 1px solid #e5e7eb;
  }

  .legal-pdf-body h3 {
    font-size: 10px !important;
    font-weight: 700 !important;
    margin: 3.6mm 0 1.4mm !important;
  }

  .legal-pdf-body h4 {
    font-size: 9.5px !important;
    font-weight: 700 !important;
    margin: 2.6mm 0 1.1mm !important;
  }

  .legal-pdf-body hr {
    border: 0 !important;
    border-top: 1px solid #e5e7eb !important;
    margin: 6mm 0 !important;
  }

  .legal-pdf-body p,
  .legal-pdf-body li,
  .legal-pdf-body blockquote {
    font-size: 9.8px;
    line-height: 1.5;
    orphans: 3;
    widows: 3;
    page-break-inside: auto;
    break-inside: auto;
  }

  .legal-pdf-body p {
    margin: 0 0 2.5mm;
  }

  .legal-pdf-body p.legal-pdf-paragraph-fragment {
    margin: 0;
  }

  .legal-pdf-body p.legal-pdf-paragraph-fragment.last-fragment {
    margin: 0 0 2.6mm;
  }

  .legal-pdf-body ul,
  .legal-pdf-body ol {
    margin: 0 0 2.8mm;
    padding-left: 5.2mm;
    page-break-inside: auto;
    break-inside: auto;
  }

  .legal-pdf-body li {
    margin-bottom: 1.1mm;
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
    page-break-inside: auto;
    break-inside: auto;
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

  .legal-pdf-body > :first-child {
    margin-top: 0 !important;
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
  const mastheadLabel = (document.title || document.sectionLabel || 'LEGAL DOCUMENT').toUpperCase();
  const issueDate = formatLongDate(document.updatedAt || document.effectiveDate);
  const mastheadMeta = 'Wealthfront (Pty) Ltd t/a Navigate Wealth | FSP 54606 | Email: info@navigatewealth.co';
  const footerText = 'Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider - FSP 54606. Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178. For inquiries, please contact us at Tel: (012) 667 2505.';

  const styles = `
    @page {
      size: ${pdfConfig.pageSize} ${pdfConfig.orientation};
      margin: 12.5mm 10mm 23mm 10mm;

      @bottom-left {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8px;
        font-weight: 700;
        color: #6b7280;
      }

      @bottom-center {
        content: "${footerText.replace(/"/g, '\\"')}";
        font-size: 8px;
        line-height: 1.35;
        color: #6b7280;
      }
    }

    @page :first {
      margin: 5mm 10mm 23mm 10mm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    ${LEGAL_PDF_CONTENT_CSS}

    .legal-paged-preview-root .legal-pdf-body h1,
    .legal-paged-preview-root .legal-pdf-body h2,
    .legal-paged-preview-root .legal-pdf-body h3,
    .legal-paged-preview-root .legal-pdf-body h4 {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      color: #111827 !important;
      letter-spacing: 0 !important;
    }

    .legal-paged-preview-root .legal-pdf-body h1 {
      font-size: 11.2px !important;
      line-height: 1.25 !important;
    }

    .legal-paged-preview-root .legal-pdf-body h2 {
      font-size: 10.7px !important;
      line-height: 1.25 !important;
    }

    .legal-paged-preview-root .legal-pdf-body h3 {
      font-size: 10px !important;
      line-height: 1.35 !important;
      font-weight: 700 !important;
    }

    .legal-paged-preview-root .legal-pdf-body h4 {
      font-size: 9.5px !important;
      line-height: 1.35 !important;
      font-weight: 700 !important;
    }

    .legal-paged-document {
      width: 100%;
    }

    .legal-paged-cover {
      margin: 0 0 6mm;
      page-break-after: avoid;
      break-after: avoid;
    }

    .legal-paged-top-masthead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10mm;
      height: 15mm;
      border-bottom: 1px solid #d1d5db;
      margin-bottom: 5mm;
    }

    .legal-paged-masthead-left {
      font-size: 9.2px;
      font-weight: 700;
      letter-spacing: 0.2px;
      color: #374151;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .legal-paged-masthead-right {
      font-size: 9.2px;
      color: #6b7280;
      text-align: right;
      line-height: 1.25;
    }

    .legal-paged-masthead-right strong {
      color: #374151;
      font-weight: 700;
    }

    .legal-paged-header {
      margin-bottom: 6mm;
    }

    .legal-paged-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10mm;
    }

    .legal-paged-brand {
      display: flex;
      flex-direction: column;
      gap: 2mm;
      min-width: 65mm;
    }

    .legal-paged-brand-logo {
      font-size: 20px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.35px;
      color: #111827;
      white-space: nowrap;
    }

    .legal-paged-brand-logo span {
      color: #6d28d9;
    }

    .legal-paged-brand-subline {
      font-size: 10.5px;
      color: #6b7280;
      line-height: 1.25;
    }

    .legal-paged-doc-head {
      flex: 1;
      text-align: right;
    }

    .legal-paged-doc-title {
      font-size: 18px;
      line-height: 1.15;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.2px;
      color: #111827;
    }

    .legal-paged-doc-meta {
      display: inline-grid;
      grid-template-columns: auto auto;
      gap: 0.8mm 6mm;
      justify-content: end;
      align-items: baseline;
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 1px solid #e5e7eb;
      font-size: 9.2px;
      color: #6b7280;
    }

    .legal-paged-doc-meta strong {
      color: #4b5563;
      font-weight: 600;
    }

    .legal-paged-divider {
      border: 0;
      border-top: 2px solid #6b7280;
      margin: 4mm 0 6mm;
    }

    .legal-paged-body {
      width: 100%;
      padding-bottom: 3mm;
      box-sizing: border-box;
    }

    .legal-paged-body .legal-page-break {
      break-after: page;
      page-break-after: always;
    }

    .legal-paged-body > :last-child {
      margin-bottom: 0 !important;
    }

    .legal-paged-preview-root {
      background: #f3f4f6;
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
      border: 1px solid rgba(229, 231, 235, 0.9);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
    }

    .legal-paged-preview-root .pagedjs_page_content {
      overflow: hidden;
    }

    .legal-paged-preview-root .pagedjs_area {
      overflow: hidden;
    }

    .legal-paged-preview-root .pagedjs_pagebox {
      box-shadow: none;
    }

    .legal-paged-preview-root .pagedjs_margin-bottom {
      color: #4b5563;
      border-top: 1px solid #e5e7eb;
      padding-top: 3.5mm;
      display: flex;
      align-items: flex-start;
      gap: 5mm;
      font-size: 8px;
      line-height: 1.35;
    }

    .legal-paged-preview-root .pagedjs_margin-bottom-left,
    .legal-paged-preview-root .pagedjs_margin-bottom-center,
    .legal-paged-preview-root .pagedjs_margin-bottom-right {
      padding-top: 0.5mm;
      font-size: 8px;
      line-height: 1.35;
    }

    .legal-paged-preview-root .pagedjs_margin-bottom-left {
      flex: 0 0 20mm;
      width: 20mm;
      min-width: 20mm;
      text-align: left;
      font-weight: 700;
      color: #6b7280;
      white-space: nowrap;
    }

    .legal-paged-preview-root .pagedjs_margin-bottom-center {
      flex: 1 1 auto;
      text-align: left;
      color: #6b7280;
      font-weight: 400;
    }

    .legal-paged-preview-root .pagedjs_margin-bottom-right,
    .legal-paged-preview-root .pagedjs_margin-bottom-right-corner-holder,
    .legal-paged-preview-root .pagedjs_margin-bottom-left-corner-holder {
      display: none;
    }

    .legal-paged-preview-root .pagedjs_margin-bottom-left-corner-holder,
    .legal-paged-preview-root .pagedjs_margin-bottom-center-holder,
    .legal-paged-preview-root .pagedjs_margin-bottom-right-corner-holder,
    .legal-paged-preview-root .pagedjs_margin-bottom-left,
    .legal-paged-preview-root .pagedjs_margin-bottom-center,
    .legal-paged-preview-root .pagedjs_margin-bottom-right {
      font-size: inherit;
      line-height: inherit;
    }

    .legal-paged-preview-root .pagedjs_margin-content,
    .legal-paged-preview-root .pagedjs_margin-content * {
      font-size: 8px !important;
      line-height: 1.35 !important;
    }
  `;

  const markup = `
    <div class="legal-paged-document">
      <section class="legal-paged-cover">
        <div class="legal-paged-top-masthead">
          <div class="legal-paged-masthead-left">${escapeHtml(mastheadLabel)}</div>
          <div class="legal-paged-masthead-right">
            <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br>
            Email: info@navigatewealth.co
          </div>
        </div>
        <header class="legal-paged-header">
          <div class="legal-paged-header-row">
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
        </header>
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
