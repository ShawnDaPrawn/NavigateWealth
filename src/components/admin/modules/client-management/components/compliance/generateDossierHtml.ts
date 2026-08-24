import { BASE_PDF_CSS } from '../../../resources';
import {
  escapeHtmlText,
  navigateWealthPdfDocumentTitle,
} from '../../../../../../utils/pdfPrintTitle';

export function generateDossierHtml({
  clientName,
  now,
  issueDate,
  grouped,
  allResults,
  sectionsHtml,
}: {
  clientName: string;
  now: string;
  issueDate: string;
  grouped: Record<string, unknown[]>;
  allResults: unknown[];
  sectionsHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtmlText(navigateWealthPdfDocumentTitle(`Compliance Dossier — ${clientName}`))}</title>
  <style>
    ${BASE_PDF_CSS}

    /* ===== Dossier-specific overrides for flowing multi-page layout ===== */

    /* Override fixed-height page for flowing content */
    .pdf-viewport {
      display: block;
      padding: 24px;
      background: #f3f4f6;
    }
    .pdf-page {
      height: auto;
      overflow: visible;
      max-width: 210mm;
      margin: 0 auto;
      page-break-after: auto;
      break-after: auto;
    }
    .pdf-content {
      height: auto;
      padding-bottom: 8mm;
    }

    /* On-screen footer is static, not absolute */
    .pdf-footer {
      position: relative;
      bottom: auto;
      left: auto;
      right: auto;
      margin-top: 6mm;
    }

    /* Dossier result blocks — avoid page-break inside */
    .dossier-result {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 3mm;
      margin-bottom: 2mm;
    }
    .dossier-result table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    .dossier-result table th,
    .dossier-result table td {
      padding: 2px 6px;
      border-bottom: 1px solid #f3f4f6;
      text-align: left;
      vertical-align: top;
    }
    .dossier-result table th {
      color: #6b7280;
      width: 25%;
      font-weight: 600;
      background: transparent;
      border: none;
      border-bottom: 1px solid #f3f4f6;
    }
    .dossier-result table td {
      font-weight: 500;
      border: none;
      border-bottom: 1px solid #f3f4f6;
    }

    /* Section headings stay with first result */
    .dossier-section-head {
      break-after: avoid;
      page-break-after: avoid;
    }

    /* Sections allow internal breaks for large result sets */
    .dossier-section {
      break-inside: auto;
      page-break-inside: auto;
    }

    /* Meta summary box */
    .dossier-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5mm 6mm;
      margin-bottom: 5mm;
      padding: 3mm 4mm;
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 9.5px;
    }
    .dossier-meta .dk { color: #6b7280; font-weight: 600; }
    .dossier-meta .dv { color: var(--text); }

    /* Attribution callout */
    .dossier-attribution {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 6mm;
      padding: 3mm 4mm;
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 8.5px;
      line-height: 1.5;
      color: #64748b;
    }
    .dossier-attribution strong { color: #334155; }

    /* Running footer for print — repeats on every printed page */
    .running-footer {
      display: none;
    }

    /* ===== Print overrides ===== */
    @media print {
      @page {
        size: A4;
        margin: 12mm 10mm 28mm 10mm;
      }

      html, body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .no-print { display: none !important; }

      .pdf-viewport {
        padding: 0;
        background: transparent;
      }
      .pdf-page {
        box-shadow: none;
        border: none;
        max-width: none;
        width: auto;
      }
      .pdf-content {
        padding: 0;
      }

      /* Hide on-screen static footer in print */
      .pdf-footer { display: none !important; }

      /* Show running footer that repeats on every printed page */
      .running-footer {
        display: block;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 18mm;
        border-top: 1px solid var(--border);
        padding: 3mm 0 0 0;
        font-size: 8px;
        line-height: 1.35;
        color: var(--muted);
        background: #ffffff;
      }
      .running-footer .footer-row {
        display: flex;
        gap: 5mm;
        align-items: flex-start;
      }

      .top-masthead {
        display: flex;
        height: 15mm;
        border-bottom: 1px solid var(--border);
      }
    }
  </style>
</head>
<body>
  <!-- Print / Save button -->
  <div class="no-print" style="text-align:right;padding:12px 24px 0">
    <button onclick="window.print()" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">
      Print / Save as PDF
    </button>
  </div>

  <div class="pdf-preview-container">
    <div class="pdf-viewport">
      <div class="pdf-page">
        <div class="pdf-content">

          <!-- MASTHEAD -->
          <div class="top-masthead">
            <div class="masthead-left">COMPLIANCE DOSSIER</div>
            <div class="masthead-right">
              <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
              Email: info@navigatewealth.co
            </div>
          </div>

          <!-- HEADER -->
          <header class="page-header-full">
            <div class="header-row">
              <div class="brand-block">
                <div class="logo">Navigate <span class="wealth">Wealth</span></div>
                <div class="brand-subline">Independent Financial Advisory Services</div>
              </div>
              <div class="doc-block">
                <h1 class="doc-title">Compliance Dossier</h1>
                <div class="meta-grid">
                  <div class="meta-k">Issue date</div>
                  <div class="meta-v">${issueDate}</div>
                  <div class="meta-k">Client</div>
                  <div class="meta-v">${clientName}</div>
                </div>
              </div>
            </div>
          </header>
          <hr class="section-divider" style="border-top:2px solid #6b7280;margin:4mm 0 6mm 0" />

          <!-- DOSSIER META -->
          <div class="dossier-meta">
            <div><span class="dk">Client:</span> <span class="dv">${clientName}</span></div>
            <div><span class="dk">Generated:</span> <span class="dv">${now}</span></div>
            <div><span class="dk">Total Check Types:</span> <span class="dv">${Object.keys(grouped).length}</span></div>
            <div><span class="dk">Total Check Runs:</span> <span class="dv">${allResults.length}</span></div>
          </div>

          <!-- SECTIONS -->
          ${sectionsHtml}

          <!-- ATTRIBUTION -->
          <div class="dossier-attribution">
            <p style="margin:0 0 1mm 0"><strong>Independent Third-Party Verification</strong></p>
            <p style="margin:0">All checks in this dossier were performed by <strong>Honeycomb Information Services (Pty) Ltd</strong>,
            an independent South African bureau service provider, via the <strong>Beeswax</strong> compliance platform.
            Navigate Wealth acts as a consumer of this data and does not independently verify the information contained herein.
            All results are subject to the accuracy and completeness of the data held by the originating bureau(s).</p>
          </div>

          <!-- ON-SCREEN FOOTER (hidden in print; running-footer takes over) -->
          <footer class="pdf-footer">
            <div class="footer-row">
              <div class="footer-page">Compliance Dossier</div>
              <div class="footer-text">
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider – FSP 54606.
                Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                For inquiries, please contact us at Tel: (012) 667 2505.
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  </div>

  <!-- RUNNING FOOTER (print only — repeats on every printed page) -->
  <div class="running-footer">
    <div class="footer-row">
      <div class="footer-page">Compliance Dossier</div>
      <div class="footer-text">
        Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider – FSP 54606.
        Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
        For inquiries, please contact us at Tel: (012) 667 2505.
      </div>
    </div>
  </div>
</body>
</html>`;
}
