/**
 * Application PDF (client-side, pdf-lib)
 *
 * Every section of the review page as a branded Navigate Wealth PDF — the
 * same template as the Submissions PDF (purple header band, section bars,
 * bordered form rows, paginated, footer on every page).
 *
 * `applicationPdfSections` is pure (tested); `downloadApplicationAsPdf`
 * loads pdf-lib on demand and draws them.
 */

import type { Application } from '../types';
import { formatDate, normalizeApplicationData } from '../utils';

export interface PdfSection {
  title: string;
  rows: Array<[label: string, value: string]>;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Incomplete',
  in_progress: 'Incomplete',
  submitted: 'Pending review',
  invited: 'Invited',
  approved: 'Approved',
  declined: 'Rejected',
};

const ORIGIN_LABEL: Record<string, string> = {
  admin_invite: 'Invited',
  admin_import: 'Import',
};

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value).trim();
}

function humanise(value: unknown): string {
  return text(value)
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function accepted(value: unknown): string {
  if (value === true) return 'Accepted';
  if (value === false) return 'Not accepted';
  return 'Not provided';
}

/** The ID number partly hidden, as on the review page ("800325••••82"). */
function maskId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 6)}••••${id.slice(-2)}`;
}

/** Every section of the review page, as label/value rows. Empty values read "Not provided". */
export function applicationPdfSections(app: Application): PdfSection[] {
  const d = normalizeApplicationData(app.application_data);
  const row = (label: string, value: unknown): [string, string] => [
    label,
    text(value) || 'Not provided',
  ];

  const sections: PdfSection[] = [
    {
      title: 'Application',
      rows: [
        row('Application number', app.application_number || app.id),
        row('Status', STATUS_LABEL[app.status] ?? app.status),
        row('Account type', d.accountType || 'Personal Client'),
        row(
          app.status === 'draft' || app.status === 'in_progress' ? 'Signed up' : 'Submitted',
          formatDate(app.submitted_at || app.created_at),
        ),
        row('Last updated', formatDate(app.updated_at)),
        row('Origin', ORIGIN_LABEL[app.origin ?? ''] ?? 'Self-service'),
      ],
    },
    {
      title: 'Personal information',
      rows: [
        row(
          'Full name',
          [d.title, d.firstName, d.middleName, d.lastName].filter(Boolean).join(' '),
        ),
        row('Preferred name', d.preferredName),
        row('Date of birth', d.dateOfBirth),
        row('Gender', d.gender),
        row('Nationality', d.nationality),
        row('SA tax resident', d.isSATaxResident),
        row('Number of dependants', d.numberOfDependants),
      ],
    },
    {
      title: 'Identification',
      rows: [
        row('ID type', d.idType === 'passport' ? 'Passport' : d.idType ? 'South African ID' : ''),
        row('ID / passport number', d.idNumber ? maskId(d.idNumber) : ''),
        row('Tax number', d.taxNumber),
      ],
    },
    {
      title: 'Marital status',
      rows: [
        row('Marital status', humanise(d.maritalStatus)),
        row('Marital regime', humanise(d.maritalRegime)),
        row('Spouse name', [d.spouseFirstName, d.spouseLastName].filter(Boolean).join(' ')),
        row('Spouse date of birth', d.spouseDateOfBirth),
        row('Spouse employed', d.spouseEmployed),
      ],
    },
    {
      title: 'Contact information',
      rows: [
        row('Email', d.emailAddress || app.user_email),
        row('Alternative email', d.alternativeEmail),
        row('Cellphone', d.cellphoneNumber),
        row('Alternative cellphone', d.alternativeCellphone),
        row('WhatsApp', d.whatsappNumber),
        row('Preferred contact', humanise(d.preferredContactMethod)),
        row('Best time to contact', humanise(d.bestTimeToContact)),
      ],
    },
    {
      title: 'Residential address',
      rows: [
        row(
          'Address',
          [d.residentialAddressLine1, d.residentialAddressLine2, d.residentialSuburb]
            .filter(Boolean)
            .join(', '),
        ),
        row('City', d.residentialCity),
        row('Province', d.residentialProvince),
        row('Postal code', d.residentialPostalCode),
        row('Country', d.residentialCountry),
      ],
    },
    {
      title: 'Employment',
      rows: [
        row('Employment status', humanise(d.employmentStatus)),
        row('Job title', d.jobTitle),
        row('Employer', d.employerName || d.selfEmployedCompanyName),
        row('Industry', d.industry || d.selfEmployedIndustry),
        ...(d.selfEmployedDescription
          ? [row('Business description', d.selfEmployedDescription)]
          : []),
      ],
    },
    {
      title: 'Financial overview',
      rows: [
        row('Gross monthly income', d.grossMonthlyIncome),
        row('Monthly expenses', d.monthlyExpensesEstimate),
      ],
    },
    {
      title: 'Services & interests',
      rows: [
        row(
          'Services requested',
          (d.accountReasons ?? []).map(humanise).join(', ') || 'None selected',
        ),
        ...(d.otherReason ? [row('Other', d.otherReason)] : []),
        row('Timeline', humanise(d.urgency)),
        row('Financial goals', d.financialGoals),
      ],
    },
    {
      title: 'External providers (FSPs)',
      rows: [
        row(
          'Providers',
          [...(d.externalProviders ?? []), ...(d.customProviders ?? [])].join(', ') ||
            'None recorded',
        ),
      ],
    },
    {
      title: 'External financial products',
      rows: [
        row(
          'Products',
          (d.existingProducts ?? []).filter((p) => p !== 'None of the above').join(', ') ||
            'None recorded',
        ),
      ],
    },
    {
      title: 'Consent & agreements',
      rows: [
        ['Terms and conditions', accepted(d.termsAccepted)],
        ['POPIA consent', accepted(d.popiaConsent)],
        ['Disclosure acknowledgment', accepted(d.disclosureAcknowledged)],
        ['FAIS disclosure', accepted(d.faisAcknowledged)],
        ['Electronic communications', accepted(d.electronicCommunicationConsent)],
        row('Marketing consent', d.communicationConsent),
        row('Signed by', d.signatureFullName),
      ],
    },
  ];

  if (app.review_notes) {
    sections.push({
      title: 'Review notes',
      rows: [
        row('Notes', app.review_notes),
        ...(app.reviewed_at ? [row('Reviewed on', formatDate(app.reviewed_at))] : []),
      ],
    });
  }
  return sections;
}

/** The download file name, e.g. "Navigate_Wealth_Application_APP-2026-0190.pdf". */
export function applicationPdfFileName(app: Application): string {
  const ref = (app.application_number || app.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `Navigate_Wealth_Application_${ref}.pdf`;
}

/** Builds the PDF in the browser and downloads it. */
export async function downloadApplicationAsPdf(app: Application): Promise<void> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // A4 portrait — same geometry and colours as the Submissions PDF.
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const HEADER_H = 65;
  const FOOTER_ZONE = 70;
  const CONTENT_TOP = PAGE_H - HEADER_H - 24;
  const MIN_CONTENT_Y = FOOTER_ZONE + 15;
  const PURPLE = rgb(109 / 255, 40 / 255, 217 / 255);
  const PURPLE_LIGHT = rgb(139 / 255, 92 / 255, 246 / 255);
  const TEXT_COLOR = rgb(17 / 255, 24 / 255, 39 / 255);
  const MUTED = rgb(107 / 255, 114 / 255, 128 / 255);
  const LINE_COLOR = rgb(0.82, 0.82, 0.82);
  const WHITE = rgb(1, 1, 1);
  const SECTION_BG = rgb(0.975, 0.975, 0.985);
  const TABLE_BORDER = rgb(0.85, 0.85, 0.88);

  const d = normalizeApplicationData(app.application_data);
  const name =
    [d.firstName, d.lastName].filter(Boolean).join(' ') || app.user_name || 'Unknown applicant';

  // pdf-lib's standard fonts are WinAnsi: drop characters they cannot draw.
  const safe = (s: string) =>
    s
      .replace(/\u00A0/g, ' ')
      .replace(/•/g, '*')
      .replace(/[^\x20-\x7E\xA1-\xFF\u2013\u2014\u2018\u2019\u201C\u201D]/g, '');

  type PDFPage = ReturnType<typeof pdfDoc.addPage>;
  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = CONTENT_TOP;

  const wrap = (value: string, size: number, usedFont: typeof font, maxWidth: number) => {
    const lines: string[] = [];
    for (const paragraph of safe(value).split('\n')) {
      let current = '';
      for (const word of paragraph.split(' ')) {
        const test = current ? `${current} ${word}` : word;
        if (usedFont.widthOfTextAtSize(test, size) > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      lines.push(current);
    }
    return lines.length ? lines : [''];
  };

  const drawHeader = (p: PDFPage) => {
    p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: PURPLE });
    p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: 2, color: PURPLE_LIGHT });
    p.drawText('Navigate Wealth', {
      x: MARGIN,
      y: PAGE_H - 28,
      size: 16,
      font: boldFont,
      color: WHITE,
    });
    p.drawText('Client application', {
      x: MARGIN,
      y: PAGE_H - 48,
      size: 10,
      font,
      color: rgb(0.88, 0.88, 0.95),
    });
    p.drawText('FSP 54606', {
      x: MARGIN,
      y: PAGE_H - 60,
      size: 7,
      font,
      color: rgb(0.75, 0.75, 0.85),
    });
    const ref = safe(app.application_number || '');
    if (ref) {
      p.drawText(ref, {
        x: PAGE_W - MARGIN - font.widthOfTextAtSize(ref, 8),
        y: PAGE_H - 28,
        size: 8,
        font,
        color: rgb(0.8, 0.8, 0.9),
      });
    }
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MIN_CONTENT_Y) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      drawHeader(page);
      y = CONTENT_TOP;
    }
  };

  const heading = (title: string) => {
    const h = 26;
    ensureSpace(h + 30);
    y -= 6;
    page.drawRectangle({ x: MARGIN, y: y - h + 8, width: CONTENT_W, height: h, color: PURPLE });
    page.drawText(safe(title.toUpperCase()), {
      x: MARGIN + 10,
      y: y - h + 16,
      size: 9.5,
      font: boldFont,
      color: WHITE,
    });
    y -= h + 4;
  };

  const formRow = (label: string, value: string, isLast: boolean) => {
    const labelW = 150;
    const lines = wrap(value || '—', 8.5, font, CONTENT_W - labelW - 25);
    const h = Math.max(18, lines.length * 12 + 6);
    ensureSpace(h + 2);
    page.drawRectangle({ x: MARGIN, y: y - h + 4, width: CONTENT_W, height: h, color: SECTION_BG });
    for (const x of [MARGIN, MARGIN + CONTENT_W]) {
      page.drawLine({
        start: { x, y: y + 4 },
        end: { x, y: y - h + 4 },
        thickness: 0.5,
        color: TABLE_BORDER,
      });
    }
    page.drawLine({
      start: { x: MARGIN, y: y - h + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - h + 4 },
      thickness: 0.5,
      color: isLast ? TABLE_BORDER : LINE_COLOR,
    });
    page.drawText(safe(label), { x: MARGIN + 10, y: y - 6, size: 8, font: boldFont, color: MUTED });
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: MARGIN + labelW + 10,
        y: y - 6 - i * 12,
        size: 8.5,
        font,
        color: TEXT_COLOR,
      });
    });
    y -= h;
  };

  drawHeader(page);
  page.drawText(safe(name), { x: MARGIN, y, size: 14, font: boldFont, color: TEXT_COLOR });
  y -= 24;

  for (const section of applicationPdfSections(app)) {
    heading(section.title);
    section.rows.forEach(([label, value], i) =>
      formRow(label, value, i === section.rows.length - 1),
    );
    y -= 12;
  }

  const total = pages.length;
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: FOOTER_ZONE + 2 },
      end: { x: PAGE_W - MARGIN, y: FOOTER_ZONE + 2 },
      thickness: 0.5,
      color: LINE_COLOR,
    });
    p.drawText('Navigate Wealth  |  FSP 54606  |  info@navigatewealth.co  |  (+27) 12-667-2505', {
      x: MARGIN,
      y: FOOTER_ZONE - 15,
      size: 6.5,
      font: italicFont,
      color: MUTED,
    });
    const pageText = `Page ${i + 1} of ${total}`;
    p.drawText(pageText, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(pageText, 7),
      y: FOOTER_ZONE - 15,
      size: 7,
      font,
      color: MUTED,
    });
  });

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = applicationPdfFileName(app);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
