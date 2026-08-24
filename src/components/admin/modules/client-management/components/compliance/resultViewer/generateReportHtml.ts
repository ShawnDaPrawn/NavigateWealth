/**
 * Rendering a check result to standalone HTML for download or print.
 *
 * Split out of `ComplianceResultViewer.tsx` (1,486 lines), which held forty
 * named functions: the viewer, seventeen per-check result views, the primitives
 * they share, and an HTML report generator. Each was already self-contained.
 */
import { BASE_PDF_CSS } from '../../../../resources';
import {
  escapeHtmlText,
  navigateWealthPdfDocumentTitle,
} from '../../../../../../../utils/pdfPrintTitle';
import { formatDate, num } from './complianceFormat';
import { type CheckResult, type ComplianceActivity } from './complianceTypes';

export function generateReportHtml(
  activity: ComplianceActivity,
  result: CheckResult,
  clientName: string,
): string {
  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const performedAt = formatDate(result.submittedAt);
  const raw = result.rawResponse;

  // Build a summary section based on activity type
  let summaryHtml: string;
  switch (activity.type) {
    case 'IDV Report':
    case 'IDV Report (Photo)':
      summaryHtml = `
        <tr><th>ID Verified</th><td>${raw?.idVerified ?? raw?.verified ?? '\u2014'}</td></tr>
        ${activity.type.includes('Photo') ? `<tr><th>Photo Match</th><td>${raw?.photoMatch ?? '\u2014'}</td></tr>` : ''}
        <tr><th>Verification Status</th><td>${raw?.verificationStatus ?? raw?.status ?? '\u2014'}</td></tr>
        ${raw?.failureReason ? `<tr><th>Failure Reason</th><td style="color:#dc2626">${raw.failureReason}</td></tr>` : ''}
      `;
      break;
    case 'Bank Verification':
      summaryHtml = `
        <tr><th>Account Verified</th><td>${raw?.verified ?? raw?.accountExists ?? '\u2014'}</td></tr>
        <tr><th>Account Open</th><td>${raw?.accountOpen ?? '\u2014'}</td></tr>
        <tr><th>Name Match</th><td>${raw?.nameMatch ?? '\u2014'}</td></tr>
        <tr><th>Account Holder</th><td>${raw?.accountHolderName ?? '\u2014'}</td></tr>
        <tr><th>Bank</th><td>${raw?.bankName ?? '\u2014'}</td></tr>
      `;
      break;
    case 'Consumer Credit Check':
      summaryHtml = `
        <tr><th>Credit Score</th><td><strong>${raw?.creditScore ?? '\u2014'}</strong></td></tr>
        <tr><th>Active Accounts</th><td>${Array.isArray(raw?.accounts) ? raw.accounts.length : '\u2014'}</td></tr>
        <tr><th>Judgments</th><td>${Array.isArray(raw?.judgments) ? raw.judgments.length : '\u2014'}</td></tr>
        <tr><th>Defaults</th><td>${Array.isArray(raw?.defaults) ? raw.defaults.length : '\u2014'}</td></tr>
      `;
      break;
    case 'Sanctions Search':
      summaryHtml = `
        <tr><th>Matches Found</th><td style="color:${num(raw?.totalMatches) > 0 ? '#dc2626' : '#16a34a'};font-weight:bold">
          ${raw?.totalMatches ?? 0}
        </td></tr>
        <tr><th>Lists Searched</th><td>${Array.isArray(raw?.searchedLists) ? raw.searchedLists.join(', ') : 'All'}</td></tr>
      `;
      break;
    case 'Debt Review Enquiry':
      summaryHtml = `
        <tr><th>Under Debt Review</th><td style="color:${raw?.isUnderDebtReview ? '#dc2626' : '#16a34a'};font-weight:bold">
          ${raw?.isUnderDebtReview === true ? 'Yes' : raw?.isUnderDebtReview === false ? 'No' : '\u2014'}
        </td></tr>
        <tr><th>Debt Counsellor</th><td>${raw?.debtCounsellor ?? '\u2014'}</td></tr>
      `;
      break;
    default:
      summaryHtml = `<tr><th>Summary</th><td>${result.summary || '\u2014'}</td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtmlText(navigateWealthPdfDocumentTitle(`${activity.type} \u2014 ${clientName}`))}</title>
  <style>
    ${BASE_PDF_CSS}

    /* ===== Single-report overrides for flowing layout ===== */

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

    /* On-screen footer is static */
    .pdf-footer {
      position: relative;
      bottom: auto;
      left: auto;
      right: auto;
      margin-top: 6mm;
    }

    /* Report sections avoid page-break inside */
    .report-section {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 5mm;
    }

    /* Status badge */
    .status-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-badge.completed { background: #dcfce7; color: #166534; }
    .status-badge.failed { background: #fef2f2; color: #991b1b; }

    /* Attribution callout */
    .report-attribution {
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
    .report-attribution strong { color: #334155; }

    /* Raw data section */
    .raw-data-section {
      break-inside: auto;
      page-break-inside: auto;
      margin-top: 5mm;
    }
    .raw-data-pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 3mm;
      border-radius: 4px;
      font-size: 8px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.4;
    }

    /* Running footer for print */
    .running-footer {
      display: none;
    }

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

      .pdf-footer { display: none !important; }

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
            <div class="masthead-left">COMPLIANCE CHECK REPORT</div>
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
                <h1 class="doc-title">${activity.type}</h1>
                <div class="meta-grid">
                  <div class="meta-k">Issue date</div>
                  <div class="meta-v">${issueDate}</div>
                  <div class="meta-k">Status</div>
                  <div class="meta-v">
                    <span class="status-badge ${result.status === 'completed' ? 'completed' : 'failed'}">${result.status}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <hr class="section-divider" style="border-top:2px solid #6b7280;margin:4mm 0 6mm 0" />

          <!-- SECTION 1: REPORT DETAILS -->
          <div class="section report-section">
            <div class="section-head">
              <span class="num">1</span>
              <h2>Report Details</h2>
            </div>
            <table>
              <tr><th>Client</th><td>${clientName}</td></tr>
              <tr><th>Check Type</th><td>${result.checkType.replace(/_/g, ' ')}</td></tr>
              ${result.matterId ? `<tr><th>Matter ID</th><td style="font-family:monospace;font-size:9px">${result.matterId}</td></tr>` : ''}
              <tr><th>Performed At</th><td>${performedAt}</td></tr>
              <tr><th>Verification Provider</th><td><strong>Honeycomb Information Services (Pty) Ltd</strong></td></tr>
              <tr><th>Platform</th><td>Beeswax Compliance Platform</td></tr>
            </table>
          </div>

          <!-- SECTION 2: RESULTS SUMMARY -->
          <div class="section report-section">
            <div class="section-head">
              <span class="num">2</span>
              <h2>Results Summary</h2>
            </div>
            <table>${summaryHtml}</table>
          </div>

          <!-- ATTRIBUTION -->
          <div class="report-attribution">
            <p style="margin:0 0 1mm 0"><strong>Independent Third-Party Verification</strong></p>
            <p style="margin:0">This report was generated from data provided by <strong>Honeycomb Information Services (Pty) Ltd</strong>,
            an independent South African bureau service provider. The verification was performed via the
            <strong>Beeswax</strong> compliance platform. Navigate Wealth acts as a consumer of this data and
            does not independently verify the information contained herein. All results are subject to the
            accuracy and completeness of the data held by the originating bureau(s).</p>
          </div>

          <!-- SECTION 3: FULL PROVIDER RESPONSE -->
          <div class="section raw-data-section" style="margin-top:5mm">
            <div class="section-head">
              <span class="num">3</span>
              <h2>Full Provider Response</h2>
            </div>
            <pre class="raw-data-pre">${JSON.stringify(raw, null, 2)}</pre>
          </div>

          <!-- ON-SCREEN FOOTER -->
          <footer class="pdf-footer">
            <div class="footer-row">
              <div class="footer-page">${activity.type}</div>
              <div class="footer-text">
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider \u2013 FSP 54606.
                Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                For inquiries, please contact us at Tel: (012) 667 2505.
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  </div>

  <!-- RUNNING FOOTER (print only \u2014 repeats on every printed page) -->
  <div class="running-footer">
    <div class="footer-row">
      <div class="footer-page">${activity.type}</div>
      <div class="footer-text">
        Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider \u2013 FSP 54606.
        Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
        For inquiries, please contact us at Tel: (012) 667 2505.
      </div>
    </div>
  </div>
</body>
</html>`;
}
