/**
 * Will PDF View
 * Renders a drafted will in the Navigate Wealth base PDF template.
 * Handles multi-page pagination so content never bleeds over the footer.
 *
 * Uses the BasePdfLayout component for consistent branding and A4 structure.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Loader2, Printer, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../../../utils/api';
import { escapeHtmlText, navigateWealthPdfDocumentTitle } from '../../../../../utils/pdfPrintTitle';
import { BasePdfLayout, BASE_PDF_CSS } from '../../../../shared/pdf';
import { downloadWillPdf, type WillRecord as WillRecordPdf } from '../utils/will-pdf-generator';
import {
  type LivingWillDataPayload,
  MARITAL_STATUS_LABELS,
  type WillDataPayload,
  type WillRecord,
  formatDate,
} from './willPdf/willPdfShared';
import {
  SectionBeneficiaries,
  SectionBequests,
  SectionExecutors,
  SectionFuneralWishes,
  SectionGuardians,
  SectionLegalNotice,
  SectionPersonalDetails,
  SectionPreamble,
  SectionSignatures,
} from './willPdf/WillSections';
import {
  LivingWillLegalNotice,
  LivingWillPersonalDetails,
  LivingWillPreamble,
  LivingWillSignatures,
  SectionHealthcareAgents,
  SectionLivingWillWishes,
  SectionOrganDonation,
  SectionPainManagement,
  SectionTreatmentPreferences,
} from './willPdf/LivingWillSections';

interface WillPdfViewProps {
  open: boolean;
  onClose: () => void;
  willId: string;
  clientName: string;
}

// ── Main Component ─────────────────────────────────────────────────
export function WillPdfView({ open, onClose, willId, clientName }: WillPdfViewProps) {
  // ── Helpers ────────────────────────────────────────────────────────

  const [will, setWill] = useState<WillRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const loadWill = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.get<{ success?: boolean; data?: WillRecord; error?: string }>(
        `/estate-planning-fna/wills/${willId}`,
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to load will');
      }

      setWill(result.data ?? null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading will for PDF view:', errorMessage);
      toast.error(`Failed to load will: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [willId]);

  useEffect(() => {
    if (!open || !willId) return;
    loadWill();
  }, [open, willId, loadWill]);

  const handlePrint = useCallback(() => {
    if (!will?.data) return;

    // For living wills, use the jsPDF generator which already handles both types
    if (will.type === 'living_will') {
      try {
        downloadWillPdf(will as unknown as WillRecordPdf);
        toast.success('Living Will PDF generated — you can print from your PDF viewer.');
      } catch (err) {
        console.error('Error generating living will PDF for print:', err);
        toast.error('Failed to generate PDF for printing');
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow pop-ups.');
      return;
    }

    // The living_will branch returned above, so this is a standard will:
    // narrow will.data (a non-discriminated union) to WillDataPayload.
    const data = will.data as WillDataPayload;
    const displayDate = formatDate(will.createdAt);
    const status = will.status === 'draft' ? 'DRAFT' : will.status.toUpperCase();
    const fullName = (data.personalDetails.fullName || '').trim();
    const willTitleForPrint = fullName
      ? `Last Will and Testament - ${fullName}`
      : 'Last Will and Testament';

    // Build the sections HTML
    const sectionsHtml = `
      <div class="section">
        <div class="section-head">
          <span class="num">1.</span>
          <h2>Preamble</h2>
        </div>
        <div class="callout" style="margin-top:2mm;">
          <p style="font-size:9.5px;line-height:1.5;">
            I, <strong>${data.personalDetails.fullName || '___________________'}</strong>,
            Identity Number <strong>${data.personalDetails.idNumber || '___________________'}</strong>,
            born on <strong>${formatDate(data.personalDetails.dateOfBirth)}</strong>,
            residing at <strong>${data.personalDetails.physicalAddress || '___________________'}</strong>,
            being of sound mind and under no duress, hereby revoke all former wills and testamentary
            dispositions previously made by me and declare this to be my Last Will and Testament.
          </p>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">2.</span>
          <h2>Personal Information</h2>
        </div>
        <table>
          <tbody>
            <tr><th>Full Legal Name</th><td>${data.personalDetails.fullName || '-'}</td></tr>
            <tr><th>Identity Number</th><td>${data.personalDetails.idNumber || '-'}</td></tr>
            <tr><th>Date of Birth</th><td>${formatDate(data.personalDetails.dateOfBirth)}</td></tr>
            <tr><th>Marital Status</th><td>${MARITAL_STATUS_LABELS[data.personalDetails.maritalStatus] || data.personalDetails.maritalStatus}</td></tr>
            ${data.personalDetails.spouseName ? `<tr><th>Spouse</th><td>${data.personalDetails.spouseName}${data.personalDetails.spouseIdNumber ? ` (ID: ${data.personalDetails.spouseIdNumber})` : ''}</td></tr>` : ''}
            <tr><th>Physical Address</th><td>${data.personalDetails.physicalAddress || '-'}</td></tr>
          </tbody>
        </table>
      </div>

      ${
        data.executors.length > 0
          ? `
      <div class="section">
        <div class="section-head">
          <span class="num">3.</span>
          <h2>Appointment of Executor(s)</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          I hereby nominate and appoint the following person(s) as executor(s) of this my Last Will and Testament:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:25%">Name</th><th style="width:15%">Type</th><th style="width:20%">ID / Company</th><th style="width:35%">Contact Details</th></tr></thead>
          <tbody>
            ${data.executors.map((e, i) => `<tr><td>${i + 1}</td><td>${e.name}</td><td>${e.type === 'professional' ? 'Professional' : 'Individual'}</td><td>${e.type === 'professional' ? e.company || '-' : e.idNumber || '-'}</td><td>${e.contactDetails || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`
          : ''
      }

      ${
        data.beneficiaries.length > 0
          ? `
      <div class="section">
        <div class="section-head">
          <span class="num">4.</span>
          <h2>Beneficiaries &amp; Distribution of Estate</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          Subject to the specific bequests herein below, the residue of my estate shall be distributed as follows:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:30%">Name</th><th style="width:20%">ID Number</th><th style="width:20%">Relationship</th><th style="width:12%">Share (%)</th></tr></thead>
          <tbody>
            ${data.beneficiaries.map((b, i) => `<tr><td>${i + 1}</td><td>${b.name}</td><td>${b.idNumber || '-'}</td><td>${b.relationship || '-'}</td><td style="text-align:right">${b.percentage}%</td></tr>`).join('')}
            <tr><td colspan="4" style="font-weight:700;text-align:right">Total</td><td style="font-weight:700;text-align:right">${data.beneficiaries.reduce((s, b) => s + b.percentage, 0)}%</td></tr>
          </tbody>
        </table>
      </div>`
          : ''
      }

      ${
        data.guardians.length > 0
          ? `
      <div class="section">
        <div class="section-head">
          <span class="num">5.</span>
          <h2>Guardianship of Minor Children</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          In the event of my death, I nominate and appoint the following person(s) as guardian(s) of my minor children:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:25%">Name</th><th style="width:15%">ID Number</th><th style="width:15%">Relationship</th><th style="width:40%">Address</th></tr></thead>
          <tbody>
            ${data.guardians.map((g, i) => `<tr><td>${i + 1}</td><td>${g.name}</td><td>${g.idNumber || '-'}</td><td>${g.relationship || '-'}</td><td>${g.address || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`
          : ''
      }

      ${
        data.specificBequests.length > 0
          ? `
      <div class="section">
        <div class="section-head">
          <span class="num">6.</span>
          <h2>Specific Bequests</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          I bequeath the following specific items to the persons named below:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:40%">Item / Description</th><th style="width:30%">Beneficiary</th><th style="width:25%">ID Number</th></tr></thead>
          <tbody>
            ${data.specificBequests.map((b, i) => `<tr><td>${i + 1}</td><td>${b.itemDescription}</td><td>${b.beneficiaryName}</td><td>${b.beneficiaryIdNumber || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`
          : ''
      }

      ${
        data.funeralWishes || data.additionalClauses
          ? `
      <div class="section">
        <div class="section-head">
          <span class="num">7.</span>
          <h2>Funeral Wishes &amp; Additional Clauses</h2>
        </div>
        ${
          data.funeralWishes
            ? `
          <p style="font-size:9.5px;font-weight:700;margin-bottom:1mm;">Funeral Wishes:</p>
          <div class="callout"><p style="font-size:9.5px;line-height:1.5;white-space:pre-wrap;">${data.funeralWishes}</p></div>
        `
            : ''
        }
        ${
          data.additionalClauses
            ? `
          <p style="font-size:9.5px;font-weight:700;margin-bottom:1mm;margin-top:3mm;">Additional Clauses:</p>
          <div class="callout"><p style="font-size:9.5px;line-height:1.5;white-space:pre-wrap;">${data.additionalClauses}</p></div>
        `
            : ''
        }
      </div>`
          : ''
      }

      <div class="section">
        <div class="section-head">
          <span class="num">8.</span>
          <h2>Legal Notice</h2>
        </div>
        <div class="callout" style="background:#fffbeb;border-color:#fde68a;">
          <p style="font-size:9px;line-height:1.5;color:#92400e;">
            <strong>Important:</strong> This document is a draft prepared by Navigate Wealth for review purposes only.
            It does not constitute a valid Last Will and Testament until it has been printed, signed by the testator
            in the presence of two competent witnesses (who must also sign), in compliance with the requirements
            of the Wills Act 7 of 1953 (South Africa). Navigate Wealth recommends that the testator seek
            independent legal advice before executing this will.
          </p>
        </div>
      </div>

      <div class="section" style="margin-top:8mm;">
        <div class="section-head">
          <span class="num">9.</span>
          <h2>Signatures</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:4mm;">
          Signed at _________________________ on this _________ day of _________________________ 20______
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:4mm;">
          <div>
            <p style="font-size:9px;font-weight:700;margin-bottom:1mm;">TESTATOR</p>
            <div class="signature-box" style="border:1px solid #d1d5db;border-radius:4px;padding:4px;">
              <div class="signature-line" style="margin-top:10mm;"></div>
            </div>
            <p style="font-size:8.5px;color:#6b7280;margin-top:1mm;">${data.personalDetails.fullName || 'Full Name'}</p>
          </div>
          <div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm;">
          <div>
            <p style="font-size:9px;font-weight:700;margin-bottom:1mm;">WITNESS 1</p>
            <div class="signature-box" style="border:1px solid #d1d5db;border-radius:4px;padding:4px;">
              <div class="signature-line" style="margin-top:10mm;"></div>
            </div>
            <p style="font-size:8.5px;color:#6b7280;margin-top:1mm;">Full Name: _______________________________</p>
            <p style="font-size:8.5px;color:#6b7280;">ID Number: _______________________________</p>
          </div>
          <div>
            <p style="font-size:9px;font-weight:700;margin-bottom:1mm;">WITNESS 2</p>
            <div className="signature-box" style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
              <div className="signature-line" style={{ marginTop: '10mm' }}></div>
            </div>
            <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>Full Name: _______________________________</p>
            <p style={{ fontSize: '8.5px', color: '#6b7280' }}>ID Number: _______________________________</p>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtmlText(navigateWealthPdfDocumentTitle(willTitleForPrint))}</title>
  <style>
    ${BASE_PDF_CSS}
    /* Override for print: allow content to flow across pages naturally */
    .pdf-page {
      height: auto !important;
      min-height: var(--a4-h);
      overflow: visible !important;
      page-break-after: auto !important;
    }
    .pdf-content {
      height: auto !important;
      padding-bottom: var(--margin-bottom) !important;
    }
    .pdf-footer {
      position: relative !important;
      bottom: auto !important;
      margin-top: 8mm;
    }
    /* Ensure sections don't break across pages mid-section */
    .section {
      page-break-inside: avoid;
    }
    /* Allow tables to break if they are very long */
    table {
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
    }
    /* Signatures should stay together */
    .section:last-child {
      page-break-inside: avoid;
    }
    @media print {
      .pdf-page {
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="pdf-preview-container">
    <div class="pdf-viewport">
      <div class="pdf-page">
        <div class="pdf-content">
          <div class="top-masthead">
            <div class="masthead-left">LAST WILL AND TESTAMENT &mdash; ${status}</div>
            <div class="masthead-right">
              <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
              Email: info@navigatewealth.co
            </div>
          </div>
          <header class="page-header-full">
            <div class="header-row">
              <div class="brand-block">
                <div class="logo">Navigate <span class="wealth">Wealth</span></div>
                <div class="brand-subline">Independent Financial Advisory Services</div>
              </div>
              <div class="doc-block">
                <h1 class="doc-title">Last Will and Testament</h1>
                <div class="meta-grid">
                  <div class="meta-k">Client</div>
                  <div class="meta-v">${data.personalDetails.fullName}</div>
                  <div class="meta-k">Date Created</div>
                  <div class="meta-v">${displayDate}</div>
                  <div class="meta-k">Status</div>
                  <div class="meta-v">${status}</div>
                  <div class="meta-k">Version</div>
                  <div class="meta-v">${will.version || '1.0'}</div>
                </div>
              </div>
            </div>
          </header>
          <hr class="section-divider" style="border-top:2px solid #6b7280;margin:4mm 0 6mm 0;" />
          <main>
            ${sectionsHtml}
          </main>
          <footer class="pdf-footer">
            <div class="footer-row">
              <div class="footer-page">Page 1</div>
              <div class="footer-text">
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider - FSP 54606.
                Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                For inquiries, please contact us at Tel: (012) 667 2505.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }, [will]);

  const handleDownload = useCallback(() => {
    if (!will) return;
    try {
      downloadWillPdf(will as unknown as WillRecordPdf);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    }
  }, [will]);

  if (!open) return null;

  const data = will?.data;
  const status = will?.status === 'draft' ? 'DRAFT' : (will?.status || '').toUpperCase();
  const displayDate = will ? formatDate(will.createdAt) : '';
  // Use client name from will data if available, fallback to prop
  const displayClientName = data?.personalDetails?.fullName || clientName;

  const willTypeLabel = will?.type === 'living_will' ? 'Living Will' : 'Last Will and Testament';

  // Build the page content sections for the PDF layout
  const buildPages = (): React.ReactNode[] => {
    if (!data) return [];

    // Living Will — render living will specific sections
    if (will?.type === 'living_will') {
      const lwData = data as unknown as LivingWillDataPayload;
      return [
        <div key="living-will-content">
          <LivingWillPreamble data={lwData} />
          <LivingWillPersonalDetails data={lwData} />
          <SectionHealthcareAgents agents={lwData.healthcareAgents} />
          <SectionTreatmentPreferences treatment={lwData.lifeSustainingTreatment} />
          <SectionPainManagement painMgmt={lwData.painManagement} />
          <SectionOrganDonation donation={lwData.organDonation} />
          <SectionLivingWillWishes
            funeralWishes={lwData.funeralWishes}
            additionalDirectives={lwData.additionalDirectives}
          />
          <LivingWillLegalNotice />
          <LivingWillSignatures data={lwData} />
        </div>,
      ];
    }

    // Last Will — render standard sections
    const lwData = data as WillDataPayload;
    return [
      <div key="will-content">
        <SectionPreamble data={lwData} />
        <SectionPersonalDetails data={lwData} />
        <SectionExecutors executors={lwData.executors} />
        <SectionBeneficiaries beneficiaries={lwData.beneficiaries} />
        <SectionGuardians guardians={lwData.guardians} />
        <SectionBequests bequests={lwData.specificBequests} />
        <SectionFuneralWishes
          funeralWishes={lwData.funeralWishes}
          additionalClauses={lwData.additionalClauses}
        />
        <SectionLegalNotice />
        <SectionSignatures data={lwData} />
      </div>,
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] max-h-[95vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            <DialogTitle className="text-base font-semibold">
              {willTypeLabel} {status ? `(${status})` : ''}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayClientName} {displayDate ? `- Created ${displayDate}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!data}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-4" ref={contentRef}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9] mb-3" />
              <p className="text-sm text-muted-foreground">Loading will document...</p>
            </div>
          ) : !data ? (
            <div className="text-center py-20">
              <p className="text-sm text-muted-foreground">Unable to load will data.</p>
            </div>
          ) : (
            <div className="contents">
              {/* Override: allow content to flow naturally in preview instead of clipping at A4 height.
                  Print/PDF output uses the separate print handler which opens a new window with proper pagination. */}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                .will-pdf-preview .pdf-page {
                  height: auto !important;
                  min-height: var(--a4-h);
                  overflow: visible !important;
                }
                .will-pdf-preview .pdf-content {
                  height: auto !important;
                  min-height: 100%;
                }
                .will-pdf-preview .pdf-footer {
                  position: relative !important;
                  bottom: auto !important;
                  margin-top: 8mm;
                }
              `,
                }}
              />
              <div className="will-pdf-preview">
                <BasePdfLayout
                  pages={buildPages()}
                  docTitle={willTypeLabel}
                  issueDate={displayDate}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
