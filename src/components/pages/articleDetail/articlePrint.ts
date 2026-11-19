/**
 * The article's print view: a clean window with the firm's masthead, the
 * article, the disclaimer and a footer that repeats on every printed page.
 *
 * Moved verbatim out of `ShareActions.tsx`, where it read its content straight
 * from the live page's DOM, so that both designs of the article page print
 * the same document. The caller now hands over what it used to scrape; every
 * piece is inserted as it always was, so a caller passing text escapes it.
 */
import { toast } from 'sonner';
import { escapeHtmlText, navigateWealthPdfDocumentTitle } from '../../../utils/pdfPrintTitle';

export interface ArticlePrintContent {
  /** The rendered article body, as HTML. */
  articleContentHtml: string;
  /** The lead-in under the title, inserted as is; null when there is none. */
  excerptText: string | null;
  /** The by-line pieces (author, date, reading time, views), inserted as is. */
  metaParts: string[];
}

export function printArticle(
  title: string,
  { articleContentHtml, excerptText, metaParts }: ArticlePrintContent,
): void {
  // Open a clean print window whose CSS mirrors BasePdfLayout exactly:
  //   - @page { margin: 0 } — all spacing is controlled by body padding (same as BasePdfLayout)
  //   - position:fixed footer sits at bottom: 5mm, height: 18mm (matching --footer-height)
  //   - body padding-bottom reserves the footer zone so content never flows beneath it
  const printWin = window.open('', '_blank', 'width=900,height=700');
  if (!printWin) {
    toast.error('Pop-up blocked — please allow pop-ups to print.');
    return;
  }

  const excerptHtml =
    excerptText !== null
      ? `<div style="margin-bottom:6mm;padding-left:4mm;border-left:3px solid #6d28d9;"><p style="font-size:10.5px;color:#4b5563;line-height:1.6;font-style:italic;">${excerptText}</p></div>`
      : '';

  const metaHtml =
    metaParts.length > 0
      ? `<div style="font-size:9px;color:#6b7280;margin-bottom:4mm;">${metaParts.join('  |  ')}</div>`
      : '';

  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtmlText(navigateWealthPdfDocumentTitle(title))}</title>
<style>
  /*
   * @page margins provide safe zones on every printed page.
   *
   *   top:    14mm  → content never starts flush at the physical top edge
   *   sides:  10mm  → consistent left/right gutter on every page
   *   bottom: 8mm   → small physical margin; the tfoot element reserves
   *                    the actual footer zone within the content area
   *
   * The footer repeats via <tfoot> — browsers natively repeat thead/tfoot
   * on every page when a table spans multiple pages. This is far more
   * reliable than position:fixed which Chrome often renders at the TOP.
   */
  @page {
    size: A4;
    margin: 14mm 10mm 8mm 10mm;
  }

  :root {
    --nw-purple: #6d28d9;
    --text: #111827;
    --muted: #6b7280;
    --border: #e5e7eb;
    --soft: #f9fafb;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: "Inter", "Segoe UI", Arial, sans-serif;
    color: var(--text);
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Table-based print layout ──────────────────────────────────────────
     The outer table spans the full content area. Browsers repeat <tfoot>
     at the bottom of every printed page automatically.
     height:100% ensures the table stretches to fill the last page,
     keeping the tfoot pinned to the bottom even when content is short.
  ──────────────────────────────────────────────────────────────────────── */
  .print-table { width: 100%; height: 100%; border-collapse: collapse; }
  .print-table td { padding: 0; border: none; vertical-align: top; }
  .print-table tfoot td { vertical-align: bottom; }

  /* ── Footer (inside tfoot) ─────────────────────────────────────────── */
  .print-footer {
    height: 18mm;
    border-top: 1px solid var(--border);
    padding: 3mm 0 0 0;
    font-size: 8px;
    color: var(--muted);
    line-height: 1.35;
    display: flex;
    gap: 5mm;
    align-items: flex-start;
  }
  .print-footer .fp { font-weight: 700; white-space: nowrap; width: 20mm; color: #374151; }
  .print-footer .ft { flex: 1; }

  /* ── Top masthead ── */
  .top-masthead {
    height: 15mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10mm;
    border-bottom: 1px solid var(--border);
    margin-bottom: 5mm;
    font-size: 9.2px;
  }
  .masthead-left { font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px; color: #374151; }
  .masthead-right { color: var(--muted); text-align: right; line-height: 1.25; }
  .masthead-right strong { color: #374151; font-weight: 700; }

  /* ── First-page header ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10mm;
    margin-bottom: 6mm;
  }
  .brand-block { display: flex; flex-direction: column; gap: 2mm; min-width: 65mm; }
  .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.35px; line-height: 1; color: var(--text); }
  .logo .wealth { color: var(--nw-purple); }
  .brand-sub { font-size: 10.5px; color: var(--muted); line-height: 1.25; }
  .doc-block { text-align: right; flex: 1; }
  .doc-title { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.2px; line-height: 1.2; }
  .doc-meta {
    display: inline-grid;
    grid-template-columns: auto auto;
    gap: 0.8mm 6mm;
    justify-content: end;
    align-items: baseline;
    margin-top: 2mm;
    padding-top: 2mm;
    border-top: 1px solid var(--border);
    font-size: 9.2px;
    color: var(--muted);
  }
  .doc-meta .mk { font-weight: 600; color: #4b5563; }
  hr.divider { border: none; border-top: 2px solid #6b7280; margin: 4mm 0 5mm 0; }

  /* ── Article body typography ── */
  .article-print-body { font-size: 10px; line-height: 1.65; color: var(--text); }
  .article-print-body h2 {
    font-size: 13px !important; font-weight: 800 !important;
    margin: 6mm 0 2mm !important; padding-bottom: 1mm;
    border-bottom: 1px solid var(--border); color: var(--text);
    page-break-after: avoid; break-after: avoid;
  }
  .article-print-body h3 {
    font-size: 11.5px !important; font-weight: 700 !important;
    margin: 5mm 0 1.5mm !important; color: var(--text);
    page-break-after: avoid; break-after: avoid;
  }
  .article-print-body h4 {
    font-size: 10.5px !important; font-weight: 600 !important;
    margin: 4mm 0 1mm !important; color: var(--text);
    page-break-after: avoid; break-after: avoid;
  }
  .article-print-body p {
    font-size: 10px !important; line-height: 1.65 !important;
    margin-bottom: 2.5mm !important; margin-top: 0 !important;
    orphans: 3; widows: 3;
  }
  .article-print-body ul, .article-print-body ol { margin: 2mm 0 2mm 5mm; padding-left: 3mm; font-size: 10px; line-height: 1.6; list-style-position: outside; }
  .article-print-body ul { list-style-type: disc; }
  .article-print-body ol { list-style-type: decimal; }
  .article-print-body li { margin-bottom: 1mm; orphans: 2; widows: 2; }
  .article-print-body blockquote {
    margin: 4mm 0; padding: 3mm 4mm;
    border-left: 3px solid #8b5cf6; background: #f5f3ff;
    font-style: italic; font-size: 10px; color: #3730a3;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid; break-inside: avoid;
  }
  .article-print-body strong { font-weight: 700; color: var(--text); }
  .article-print-body a { color: var(--nw-purple); text-decoration: none; }
  .article-print-body table { width: 100%; border-collapse: collapse; font-size: 9px; margin: 3mm 0; page-break-inside: avoid; break-inside: avoid; }
  .article-print-body th, .article-print-body td { border: 1px solid var(--border); padding: 2mm 3mm; }
  .article-print-body th { background: var(--soft); font-weight: 700; text-align: left; }
  .article-print-body span[style] { /* preserve inline colours from editor */ }

  /* ── Disclaimer ── */
  .disclaimer {
    margin-top: 8mm;
    padding: 4mm;
    background: var(--soft);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 8px;
    color: var(--muted);
    line-height: 1.5;
    page-break-inside: avoid; break-inside: avoid;
  }
  .disclaimer strong { color: #374151; }
</style>
</head><body>

  <table class="print-table">
    <tfoot><tr><td>
      <div class="print-footer">
        <div class="fp">Navigate Wealth</div>
        <div class="ft">
          Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider &ndash; FSP 54606.
          Registration Number: 2024/071953/07. Located at First Floor, Milestone Place Block A, 25 Sovereign Drive, Route 21 Business Park, Pretoria, 0157.
          For inquiries, please contact us at Tel: (012) 667 2505.
        </div>
      </div>
    </td></tr></tfoot>
    <tbody><tr><td>

  <div class="top-masthead">
    <div class="masthead-left">ARTICLE</div>
    <div class="masthead-right">
      <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
      Email: info@navigatewealth.co
    </div>
  </div>

  <div class="page-header">
    <div class="brand-block">
      <div class="logo">Navigate <span class="wealth">Wealth</span></div>
      <div class="brand-sub">Independent Financial Advisory Services</div>
    </div>
    <div class="doc-block">
      <div class="doc-title">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      <div class="doc-meta">
        <span class="mk">Issue date</span>
        <span>${issueDate}</span>
      </div>
    </div>
  </div>
  <hr class="divider" />

  ${metaHtml}
  ${excerptHtml}

  <div class="article-print-body">
    ${articleContentHtml}
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This article is for informational purposes only and does not constitute financial, tax,
    or legal advice. Please consult a qualified financial adviser before making any investment decisions.
    Navigate Wealth is an authorised Financial Services Provider.
  </div>

    </td></tr></tbody>
  </table>

</body></html>`;

  printWin.document.write(fullHtml);
  printWin.document.close();
  printWin.onload = () => {
    printWin.print();
  };
}
