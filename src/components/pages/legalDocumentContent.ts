/**
 * A published legal document as GET /resources/legal/:slug returns it, and
 * the helpers that turn it into the page: the dates as the page prints them,
 * a block-built (legacy) document as HTML, and its contents list. Both
 * designs read them from here (LegalDocumentPage.tsx for the live page,
 * src/site/pages/NavigatorLegalDocumentPage.tsx for the redesign), so a
 * document reads the same whichever design is live. Moved here verbatim from
 * LegalDocumentPage.tsx.
 */

export type LegalBlock = {
  id?: string;
  type: string;
  data?: {
    number?: string;
    title?: string;
    content?: string;
    columns?: number;
    fields?: Array<{ label?: string; key?: string }>;
    signatories?: Array<{ label?: string }>;
    showDate?: boolean;
    rows?: Array<{ id?: string; cells?: Array<{ value?: string }> }>;
    hasColumnHeaders?: boolean;
    hasRowHeaders?: boolean;
    columnHeaders?: string[];
    rowHeaders?: string[];
  };
};

export type PublicLegalDocumentResponse = {
  available: boolean;
  slug: string;
  document?: {
    id: string;
    title: string;
    description?: string;
    blocks: LegalBlock[];
    version: string;
    updatedAt: string;
    effectiveDate: string | null;
    section: string | null;
    toc: Array<{ id: string; title: string; level: number }>;
    contentHtml: string | null;
    renderMode: 'legacy_resource' | 'versioned_document';
    pdfConfig: {
      pageSize: 'A4' | 'A3';
      orientation: 'portrait' | 'landscape';
    };
  };
};

export function formatLongDate(value: string | null | undefined): string {
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

export function blocksToHtml(blocks: LegalBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'section_header': {
          const title = block.data?.title || '';
          const number = block.data?.number ? `${block.data.number} ` : '';
          const heading = `${number}${title}`.trim();
          const id =
            heading
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-') || `section-${Math.random().toString(36).slice(2, 8)}`;

          return `<section class="legal-section"><h2 id="${escapeHtml(id)}">${escapeHtml(heading)}</h2></section>`;
        }
        case 'text':
          return block.data?.content || '';
        case 'table': {
          const hasRowHeaders = Boolean(block.data?.hasRowHeaders);
          const headerCells = (block.data?.columnHeaders || [])
            .map((header) => `<th>${escapeHtml(header)}</th>`)
            .join('');
          const headerRow = block.data?.hasColumnHeaders
            ? `<thead><tr>${hasRowHeaders ? '<th></th>' : ''}${headerCells}</tr></thead>`
            : '';

          const bodyRows = (block.data?.rows || [])
            .map((row, rowIndex) => {
              const rowHeader = hasRowHeaders
                ? `<th>${escapeHtml((block.data?.rowHeaders || [])[rowIndex] || '')}</th>`
                : '';
              const cells = (row.cells || [])
                .map((cell) => `<td>${escapeHtml(cell.value || '')}</td>`)
                .join('');
              return `<tr>${rowHeader}${cells}</tr>`;
            })
            .join('');

          return `<div class="legal-table-wrap"><table>${headerRow}<tbody>${bodyRows}</tbody></table></div>`;
        }
        case 'signature': {
          const signatories = (block.data?.signatories || [])
            .map(
              (signatory) =>
                `<div class="legal-signature-line"><div class="line"></div><span>${escapeHtml(signatory.label || 'Signature')}</span></div>`,
            )
            .join('');

          return `<div class="legal-signatures">${signatories}</div>`;
        }
        case 'page_break':
          return '<div class="legal-page-break"></div>';
        default:
          return '';
      }
    })
    .join('');
}

export function deriveTocFromBlocks(blocks: LegalBlock[]) {
  return blocks
    .filter((block) => block.type === 'section_header')
    .map((block, index) => {
      const title =
        `${block.data?.number ? `${block.data.number} ` : ''}${block.data?.title || `Section ${index + 1}`}`.trim();
      const id =
        title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-') || `section-${index + 1}`;

      return { id, title, level: 2 };
    });
}
