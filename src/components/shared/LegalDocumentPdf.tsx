import React, { useMemo } from 'react';
import { BasePdfLayout } from '../admin/modules/resources/templates/BasePdfLayout';
import { PdfTemplateViewer } from '../admin/modules/resources/PdfTemplateViewer';
import { sanitizeLegalDocumentHtml } from '../../utils/legalHtml';

export type LegalPdfConfig = {
  pageSize: 'A4' | 'A3';
  orientation: 'portrait' | 'landscape';
};

export type LegalPdfTocItem = {
  id: string;
  title: string;
  level: number;
};

export type LegalPdfDocumentData = {
  title: string;
  description?: string | null;
  version: string;
  effectiveDate?: string | null;
  updatedAt?: string | null;
  sectionLabel?: string | null;
  html: string;
  toc?: LegalPdfTocItem[];
  pdfConfig?: LegalPdfConfig;
};

type PdfChunk = {
  key: string;
  html: string;
  units: number;
  keepWithNext?: boolean;
  forceBreakAfter?: boolean;
};

const DEFAULT_PDF_CONFIG: LegalPdfConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
};

const LEGAL_PDF_CONTENT_CSS = `
  .legal-pdf-body {
    color: #111827;
    font-size: 9.6px;
    line-height: 1.62;
  }

  .legal-pdf-block {
    margin-bottom: 3.2mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .legal-pdf-block.allow-split {
    page-break-inside: auto;
    break-inside: auto;
  }

  .legal-pdf-frontmatter {
    margin-bottom: 5mm;
  }

  .legal-pdf-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3.5mm;
    margin-bottom: 4mm;
  }

  .legal-pdf-summary-card {
    border: 1px solid #d6d3d1;
    border-radius: 5px;
    padding: 3.5mm;
    background: #fafaf9;
  }

  .legal-pdf-summary-card .label {
    display: block;
    font-size: 8px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
    margin-bottom: 1.5mm;
  }

  .legal-pdf-summary-card .value {
    display: block;
    font-size: 10px;
    line-height: 1.4;
    font-weight: 600;
    color: #111827;
  }

  .legal-pdf-description {
    border-left: 3px solid #059669;
    padding-left: 4mm;
    margin: 0 0 4mm;
    color: #374151;
  }

  .legal-pdf-toc {
    border: 1px solid #d6d3d1;
    border-radius: 5px;
    padding: 4mm;
    background: #ffffff;
  }

  .legal-pdf-toc h2 {
    font-size: 11px !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #374151;
    margin: 0 0 2.5mm !important;
  }

  .legal-pdf-toc ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 1.4mm;
  }

  .legal-pdf-toc li {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    font-size: 9.2px;
    line-height: 1.35;
    color: #1f2937;
  }

  .legal-pdf-toc .toc-level-3 {
    padding-left: 4mm;
    color: #4b5563;
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
    font-size: 16px !important;
    font-weight: 800 !important;
    margin: 0 0 3mm !important;
  }

  .legal-pdf-body h2 {
    font-size: 12px !important;
    font-weight: 800 !important;
    margin: 0 0 2.5mm !important;
    padding-top: 1mm;
  }

  .legal-pdf-body h3 {
    font-size: 10.5px !important;
    font-weight: 700 !important;
    margin: 0 0 2mm !important;
  }

  .legal-pdf-body h4 {
    font-size: 9.8px !important;
    font-weight: 700 !important;
    margin: 0 0 2mm !important;
  }

  .legal-pdf-body p,
  .legal-pdf-body li,
  .legal-pdf-body blockquote {
    font-size: 9.6px;
    line-height: 1.62;
  }

  .legal-pdf-body p {
    margin: 0 0 2.6mm;
  }

  .legal-pdf-body ul,
  .legal-pdf-body ol {
    margin: 0 0 3mm;
    padding-left: 5mm;
  }

  .legal-pdf-body li {
    margin-bottom: 1.4mm;
  }

  .legal-pdf-body table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.7px;
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
  }

  .legal-pdf-body blockquote {
    margin: 0;
    padding: 3mm 4mm;
    background: #fafaf9;
    border-left: 3px solid #10b981;
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

  .legal-pdf-page-break {
    border-top: 1px dashed #d1d5db;
    margin-top: 1mm;
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

function estimateTextUnits(text: string, charsPerUnit = 260, minimum = 3): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return minimum;
  return Math.max(minimum, Math.ceil(normalized.length / charsPerUnit) * 3);
}

function getPageCapacity(config: LegalPdfConfig, isFirstPage: boolean): number {
  const base = config.pageSize === 'A3' ? 148 : 108;
  const orientationBonus = config.orientation === 'landscape' ? 14 : 0;
  return base + orientationBonus - (isFirstPage ? 18 : 0);
}

function outerHtml(node: Element): string {
  return node.outerHTML;
}

function buildFrontMatterChunks(document: LegalPdfDocumentData): PdfChunk[] {
  const chunks: PdfChunk[] = [];

  chunks.push({
    key: 'frontmatter-summary',
    units: 16,
    html: `
      <section class="legal-pdf-frontmatter">
        ${document.description ? `<p class="legal-pdf-description">${document.description}</p>` : ''}
        <div class="legal-pdf-summary">
          <div class="legal-pdf-summary-card">
            <span class="label">Version</span>
            <span class="value">v${document.version || '1.0'}</span>
          </div>
          <div class="legal-pdf-summary-card">
            <span class="label">Effective date</span>
            <span class="value">${formatLongDate(document.effectiveDate)}</span>
          </div>
          <div class="legal-pdf-summary-card">
            <span class="label">Last updated</span>
            <span class="value">${formatLongDate(document.updatedAt)}</span>
          </div>
        </div>
      </section>
    `,
  });

  if (document.toc && document.toc.length > 0) {
    chunks.push({
      key: 'frontmatter-toc',
      units: Math.min(24, 8 + (document.toc.length * 2)),
      html: `
        <section class="legal-pdf-toc">
          <h2>Contents</h2>
          <ul>
            ${document.toc.map((item) => `
              <li class="toc-level-${item.level}">
                <span>${item.title}</span>
              </li>
            `).join('')}
          </ul>
        </section>
      `,
      forceBreakAfter: (document.toc?.length || 0) > 8,
    });
  }

  return chunks;
}

function tableBodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  if (table.tBodies.length > 0) {
    return Array.from(table.tBodies[0].rows);
  }
  return Array.from(table.querySelectorAll('tr'));
}

function createTableChunks(table: HTMLTableElement, keyPrefix: string, config: LegalPdfConfig): PdfChunk[] {
  const rows = tableBodyRows(table);
  const headerHtml = table.tHead ? table.tHead.outerHTML : '';
  const rowsPerChunk = config.pageSize === 'A3' ? 12 : 8;

  if (rows.length <= rowsPerChunk) {
    const text = table.textContent || '';
    return [{
      key: `${keyPrefix}-table-0`,
      html: `<div class="legal-pdf-table-wrap">${table.outerHTML}</div>`,
      units: Math.min(32, 8 + Math.ceil(text.length / 200) + rows.length * 2),
    }];
  }

  const chunks: PdfChunk[] = [];
  for (let index = 0; index < rows.length; index += rowsPerChunk) {
    const bodyRows = rows
      .slice(index, index + rowsPerChunk)
      .map((row) => row.outerHTML)
      .join('');
    const segmentHtml = `
      <div class="legal-pdf-table-wrap">
        <table>
          ${headerHtml}
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;
    const segmentText = rows
      .slice(index, index + rowsPerChunk)
      .map((row) => row.textContent || '')
      .join(' ');

    chunks.push({
      key: `${keyPrefix}-table-${index}`,
      html: segmentHtml,
      units: Math.min(30, 8 + Math.ceil(segmentText.length / 180) + (Math.min(rowsPerChunk, rows.length - index) * 2)),
    });
  }

  return chunks;
}

function buildContentChunks(html: string, config: LegalPdfConfig): PdfChunk[] {
  if (typeof window === 'undefined') {
    return [{
      key: 'content-fallback',
      html,
      units: 40,
    }];
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html || '<p></p>', 'text/html');
  const nodes = Array.from(doc.body.childNodes);
  const chunks: PdfChunk[] = [];

  nodes.forEach((node, index) => {
    if (node.nodeType === window.Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      if (!text) return;
      chunks.push({
        key: `text-${index}`,
        html: `<p>${text}</p>`,
        units: estimateTextUnits(text),
      });
      return;
    }

    if (!(node instanceof window.HTMLElement)) {
      return;
    }

    const tag = node.tagName.toLowerCase();
    const classNames = Array.from(node.classList);
    const text = node.textContent || '';

    if (classNames.includes('legal-page-break') || tag === 'hr') {
      chunks.push({
        key: `page-break-${index}`,
        html: '<div class="legal-pdf-page-break"></div>',
        units: 1,
        forceBreakAfter: true,
      });
      return;
    }

    if (tag === 'table') {
      chunks.push(...createTableChunks(node as HTMLTableElement, `node-${index}`, config));
      return;
    }

    if (classNames.includes('legal-signatures') || classNames.includes('legal-pdf-signatures')) {
      chunks.push({
        key: `signature-${index}`,
        html: outerHtml(node),
        units: 16,
      });
      return;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      chunks.push({
        key: `heading-${index}`,
        html: outerHtml(node),
        units: tag === 'h1' ? 8 : tag === 'h2' ? 6 : 5,
        keepWithNext: true,
      });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.querySelectorAll('li'));
      const listText = items.map((item) => item.textContent || '').join(' ');
      chunks.push({
        key: `list-${index}`,
        html: outerHtml(node),
        units: Math.max(6, Math.ceil(listText.length / 220) * 3 + items.length),
      });
      return;
    }

    if (tag === 'blockquote') {
      chunks.push({
        key: `quote-${index}`,
        html: outerHtml(node),
        units: Math.max(7, Math.ceil(text.length / 200) * 3),
      });
      return;
    }

    chunks.push({
      key: `block-${index}`,
      html: outerHtml(node),
      units: estimateTextUnits(text, 240, tag === 'p' ? 3 : 5),
    });
  });

  return chunks.length > 0
    ? chunks
    : [{
        key: 'empty-document',
        html: '<p></p>',
        units: 3,
      }];
}

function deriveTocFromHtml(html: string): LegalPdfTocItem[] {
  if (typeof window === 'undefined') return [];

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html || '<p></p>', 'text/html');

  return Array.from(doc.body.querySelectorAll('h1, h2, h3'))
    .map((heading, index) => ({
      id: heading.id || `section-${index + 1}`,
      title: heading.textContent?.trim() || `Section ${index + 1}`,
      level: heading.tagName.toLowerCase() === 'h1' ? 1 : heading.tagName.toLowerCase() === 'h2' ? 2 : 3,
    }))
    .filter((item) => item.title);
}

function paginateChunks(chunks: PdfChunk[], config: LegalPdfConfig): PdfChunk[][] {
  const pages: PdfChunk[][] = [];
  let currentPage: PdfChunk[] = [];
  let currentUnits = 0;

  const pushPage = () => {
    if (currentPage.length === 0) return;
    pages.push(currentPage);
    currentPage = [];
    currentUnits = 0;
  };

  chunks.forEach((chunk, index) => {
    const capacity = getPageCapacity(config, pages.length === 0);
    const nextChunk = chunks[index + 1];
    const combinedUnits = chunk.keepWithNext && nextChunk
      ? chunk.units + nextChunk.units
      : chunk.units;

    if (
      currentPage.length > 0
      && currentUnits + combinedUnits > capacity
    ) {
      pushPage();
    }

    currentPage.push(chunk);
    currentUnits += chunk.units;

    if (chunk.forceBreakAfter) {
      pushPage();
    }
  });

  pushPage();

  return pages.length > 0 ? pages : [[{
    key: 'blank-page',
    html: '<p></p>',
    units: 1,
  }]];
}

function renderPage(chunks: PdfChunk[], pageIndex: number) {
  return (
    <div className="legal-pdf-body" key={`legal-pdf-page-${pageIndex}`}>
      {chunks.map((chunk) => (
        <section
          key={chunk.key}
          className={`legal-pdf-block ${chunk.html.includes('<table') ? '' : 'allow-split'}`}
          dangerouslySetInnerHTML={{ __html: chunk.html }}
        />
      ))}
    </div>
  );
}

export function LegalDocumentPdfLayout({ document }: { document: LegalPdfDocumentData }) {
  const pdfConfig = document.pdfConfig || DEFAULT_PDF_CONFIG;
  const sanitizedHtml = useMemo(
    () => sanitizeLegalDocumentHtml(document.html || '<p></p>'),
    [document.html],
  );
  const toc = useMemo(
    () => (document.toc && document.toc.length > 0 ? document.toc : deriveTocFromHtml(sanitizedHtml)),
    [document.toc, sanitizedHtml],
  );

  const pages = useMemo(() => {
    const chunks = [
      ...buildFrontMatterChunks({
        ...document,
        toc,
      }),
      ...buildContentChunks(sanitizedHtml, pdfConfig),
    ];
    return paginateChunks(chunks, pdfConfig).map((pageChunks, pageIndex) => renderPage(pageChunks, pageIndex));
  }, [document, pdfConfig, sanitizedHtml, toc]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_PDF_CONTENT_CSS }} />
      <BasePdfLayout
        pages={pages}
        docTitle={document.title}
        issueDate={formatLongDate(document.updatedAt || document.effectiveDate)}
        pageSize={pdfConfig.pageSize}
        orientation={pdfConfig.orientation}
      />
    </>
  );
}

export function LegalDocumentPdfDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalPdfDocumentData | null;
}) {
  if (!document) return null;

  const pdfConfig = document.pdfConfig || DEFAULT_PDF_CONFIG;

  return (
    <PdfTemplateViewer
      open={open}
      onOpenChange={onOpenChange}
      title={document.title}
      pageSize={pdfConfig.pageSize}
      orientation={pdfConfig.orientation}
    >
      <LegalDocumentPdfLayout document={document} />
    </PdfTemplateViewer>
  );
}
