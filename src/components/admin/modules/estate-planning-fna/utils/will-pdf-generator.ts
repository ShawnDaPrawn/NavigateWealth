/**
 * Will PDF Generator
 * Generates multi-page PDF documents for Last Will & Testament and Living Will
 * using jsPDF with programmatic layout and proper pagination.
 *
 * @module estate-planning-fna/utils/will-pdf-generator
 */

import jsPDF from 'jspdf';
import { navigateWealthPdfSaveFileName } from '../../../../../utils/pdfPrintTitle';

// ── Types ──────────────────────────────────────────────────────────

interface PersonalDetails {
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  maritalStatus: string;
  spouseName?: string;
  spouseIdNumber?: string;
  physicalAddress: string;
}

interface Executor {
  id: string;
  type: 'individual' | 'professional';
  name: string;
  idNumber?: string;
  company?: string;
  contactDetails: string;
}

interface Beneficiary {
  id: string;
  name: string;
  idNumber: string;
  relationship: string;
  percentage: number;
}

interface Guardian {
  id: string;
  name: string;
  idNumber: string;
  relationship: string;
  address: string;
}

interface SpecificBequest {
  id: string;
  itemDescription: string;
  beneficiaryName: string;
  beneficiaryIdNumber: string;
}

interface LivingWillData {
  personalDetails: PersonalDetails;
  healthcareAgents: Array<{
    id: string;
    name: string;
    idNumber: string;
    relationship: string;
    contactDetails: string;
    isPrimary: boolean;
  }>;
  lifeSustainingTreatment: {
    ventilator: 'accept' | 'refuse' | 'limited';
    cpr: 'accept' | 'refuse' | 'limited';
    artificialNutrition: 'accept' | 'refuse' | 'limited';
    dialysis: 'accept' | 'refuse' | 'limited';
    antibiotics: 'accept' | 'refuse' | 'limited';
    additionalInstructions: string;
  };
  painManagement: {
    comfortCareOnly: boolean;
    maximumPainRelief: boolean;
    additionalInstructions: string;
  };
  organDonation: {
    isDonor: boolean;
    donationType: 'all' | 'specific' | 'none';
    specificOrgans: string;
    additionalInstructions: string;
  };
  funeralWishes: string;
  additionalDirectives: string;
}

export interface WillDataPayload {
  personalDetails: PersonalDetails;
  executors: Executor[];
  beneficiaries: Beneficiary[];
  guardians: Guardian[];
  specificBequests: SpecificBequest[];
  residueDistribution: string;
  funeralWishes: string;
  additionalClauses: string;
}

export interface WillRecord {
  id: string;
  clientId: string;
  type: 'last_will' | 'living_will';
  status: string;
  version: string | number;
  createdAt: string;
  updatedAt: string;
  data: WillDataPayload | LivingWillData;
}

// ── Constants ──────────────────────────────────────────────────────

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 25; // Space for footer
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 12;

const COLORS = {
  purple: [109, 40, 217] as [number, number, number],
  text: [17, 24, 39] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  headerBg: [249, 250, 251] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  amberBg: [255, 251, 235] as [number, number, number],
  amberBorder: [253, 230, 138] as [number, number, number],
  amberText: [146, 64, 14] as [number, number, number],
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_cop: 'Married in Community of Property',
  married_anc: 'Married ANC with Accrual',
  married_customary: 'Married under Customary Law',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

const TREATMENT_LABELS: Record<string, string> = {
  accept: 'Accept',
  refuse: 'Refuse',
  limited: 'Limited Trial',
};

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── PDF Builder Class ──────────────────────────────────────────────

class WillPdfBuilder {
  private doc: jsPDF;
  private y: number = MARGIN_TOP;
  private pageNum: number = 1;
  private totalPages: number = 1;
  private docTitle: string;
  private status: string;
  private version: string;
  private clientName: string;
  private createdDate: string;

  constructor(will: WillRecord) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.docTitle = will.type === 'living_will' ? 'Living Will' : 'Last Will and Testament';
    this.status = will.status === 'draft' ? 'DRAFT' : will.status.toUpperCase();
    this.version = String(will.version || '1');
    this.clientName = will.data.personalDetails.fullName || 'Client';
    this.createdDate = formatDate(will.createdAt);
    this.doc.setFont('helvetica');
  }

  private checkPageBreak(requiredSpace: number): void {
    if (this.y + requiredSpace > PAGE_HEIGHT - MARGIN_BOTTOM) {
      this.addNewPage();
    }
  }

  private addNewPage(): void {
    this.renderFooter();
    this.doc.addPage();
    this.pageNum++;
    this.y = MARGIN_TOP;
    // Subsequent page: light masthead
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(`${this.docTitle} — ${this.status}`, MARGIN_LEFT, this.y);
    this.doc.text(`${this.clientName}`, PAGE_WIDTH - MARGIN_RIGHT, this.y, { align: 'right' });
    this.y += 3;
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(MARGIN_LEFT, this.y, PAGE_WIDTH - MARGIN_RIGHT, this.y);
    this.y += 6;
  }

  private renderFooter(): void {
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(MARGIN_LEFT, FOOTER_Y - 4, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y - 4);
    this.doc.setFontSize(6.5);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(`Page ${this.pageNum}`, MARGIN_LEFT, FOOTER_Y);
    this.doc.setFont('helvetica', 'normal');
    const footerText =
      'Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider – FSP 54606. ' +
      'Registration Number: 2024/071953/07. Tel: (012) 667 2505.';
    const footerLines = this.doc.splitTextToSize(footerText, CONTENT_WIDTH - 25);
    this.doc.text(footerLines, MARGIN_LEFT + 18, FOOTER_Y);
  }

  private renderHeader(): void {
    // Top masthead bar
    this.doc.setFontSize(7.5);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(55, 65, 81);
    this.doc.text(
      `${this.docTitle.toUpperCase()} — ${this.status}`,
      MARGIN_LEFT,
      this.y + 4,
    );
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text('Wealthfront (Pty) Ltd t/a Navigate Wealth | FSP 54606', PAGE_WIDTH - MARGIN_RIGHT, this.y + 4, {
      align: 'right',
    });
    this.y += 8;
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(MARGIN_LEFT, this.y, PAGE_WIDTH - MARGIN_RIGHT, this.y);
    this.y += 6;

    // Brand + title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...COLORS.text);
    this.doc.text('Navigate', MARGIN_LEFT, this.y);
    const navigateWidth = this.doc.getTextWidth('Navigate ');
    this.doc.setTextColor(...COLORS.purple);
    this.doc.text('Wealth', MARGIN_LEFT + navigateWidth, this.y);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text('Independent Financial Advisory Services', MARGIN_LEFT, this.y + 4);

    // Document title (right)
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(this.docTitle, PAGE_WIDTH - MARGIN_RIGHT, this.y, { align: 'right' });
    this.y += 7;

    // Meta grid
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(PAGE_WIDTH - MARGIN_RIGHT - 70, this.y, PAGE_WIDTH - MARGIN_RIGHT, this.y);
    this.y += 3;
    const metaX = PAGE_WIDTH - MARGIN_RIGHT - 70;
    const metaItems = [
      ['Client', this.clientName],
      ['Date Created', this.createdDate],
      ['Status', this.status],
      ['Version', String(this.version)],
    ];
    this.doc.setFontSize(7.5);
    metaItems.forEach(([label, value]) => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(75, 85, 99);
      this.doc.text(label, metaX, this.y);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.muted);
      this.doc.text(value, metaX + 28, this.y);
      this.y += 3.5;
    });
    this.y += 2;

    // Divider
    this.doc.setDrawColor(107, 114, 128);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN_LEFT, this.y, PAGE_WIDTH - MARGIN_RIGHT, this.y);
    this.doc.setLineWidth(0.2);
    this.y += 6;
  }

  private renderSectionHead(num: string, title: string): void {
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...COLORS.purple);
    this.doc.text(`${num}.`, MARGIN_LEFT, this.y);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(title.toUpperCase(), MARGIN_LEFT + 6, this.y);
    this.y += 1;
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(MARGIN_LEFT, this.y, PAGE_WIDTH - MARGIN_RIGHT, this.y);
    this.y += 4;
  }

  private renderCallout(text: string, bgColor?: [number, number, number], borderColor?: [number, number, number], textColor?: [number, number, number]): void {
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH - 8);
    const lineHeight = 3.5;
    const boxHeight = lines.length * lineHeight + 6;

    this.checkPageBreak(boxHeight + 2);

    this.doc.setFillColor(...(bgColor || COLORS.headerBg));
    this.doc.setDrawColor(...(borderColor || COLORS.border));
    this.doc.roundedRect(MARGIN_LEFT, this.y, CONTENT_WIDTH, boxHeight, 1.5, 1.5, 'FD');

    this.doc.setFontSize(7.5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...(textColor || COLORS.text));
    this.doc.text(lines, MARGIN_LEFT + 4, this.y + 4);
    this.y += boxHeight + 3;
  }

  private renderKeyValueTable(rows: [string, string][]): void {
    const rowHeight = 6;
    const totalHeight = rows.length * rowHeight;
    this.checkPageBreak(totalHeight + 2);

    const labelWidth = CONTENT_WIDTH * 0.35;

    rows.forEach(([label, value], i) => {
      const rowY = this.y;
      // Background alternation
      if (i % 2 === 0) {
        this.doc.setFillColor(...COLORS.headerBg);
        this.doc.rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, rowHeight, 'F');
      }
      this.doc.setDrawColor(...COLORS.border);
      this.doc.rect(MARGIN_LEFT, rowY, labelWidth, rowHeight);
      this.doc.rect(MARGIN_LEFT + labelWidth, rowY, CONTENT_WIDTH - labelWidth, rowHeight);

      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(55, 65, 81);
      this.doc.text(label, MARGIN_LEFT + 3, rowY + 4);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(value || '-', MARGIN_LEFT + labelWidth + 3, rowY + 4);
      this.y += rowHeight;
    });
    this.y += 2;
  }

  private renderDataTable(headers: string[], rows: string[][], colWidths: number[]): void {
    const rowHeight = 6;
    const headerHeight = 7;
    const totalHeight = headerHeight + rows.length * rowHeight;
    this.checkPageBreak(Math.min(totalHeight, headerHeight + 3 * rowHeight) + 2);

    // Header
    let colX = MARGIN_LEFT;
    this.doc.setFillColor(...COLORS.headerBg);
    this.doc.rect(MARGIN_LEFT, this.y, CONTENT_WIDTH, headerHeight, 'F');
    this.doc.setDrawColor(...COLORS.border);
    headers.forEach((h, i) => {
      const w = colWidths[i] * CONTENT_WIDTH;
      this.doc.rect(colX, this.y, w, headerHeight);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(55, 65, 81);
      this.doc.text(h, colX + 2, this.y + 5);
      colX += w;
    });
    this.y += headerHeight;

    // Data rows
    rows.forEach((row) => {
      this.checkPageBreak(rowHeight + 2);
      colX = MARGIN_LEFT;
      row.forEach((cell, i) => {
        const w = colWidths[i] * CONTENT_WIDTH;
        this.doc.setDrawColor(...COLORS.border);
        this.doc.rect(colX, this.y, w, rowHeight);
        this.doc.setFontSize(7);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...COLORS.text);
        const truncated = cell.length > Math.floor(w / 1.5) ? cell.substring(0, Math.floor(w / 1.5)) + '...' : cell;
        this.doc.text(truncated, colX + 2, this.y + 4);
        colX += w;
      });
      this.y += rowHeight;
    });
    this.y += 2;
  }

  private renderSignatures(clientName: string): void {
    this.checkPageBreak(70);

    this.doc.setFontSize(7.5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(
      'Signed at _________________________ on this _________ day of _________________________ 20______',
      MARGIN_LEFT,
      this.y,
    );
    this.y += 8;

    // Testator
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('TESTATOR', MARGIN_LEFT, this.y);
    this.y += 2;
    this.doc.setDrawColor(...COLORS.border);
    this.doc.rect(MARGIN_LEFT, this.y, 75, 14);
    this.doc.setLineWidth(0.3);
    this.doc.setDrawColor(0, 0, 0);
    this.doc.line(MARGIN_LEFT + 5, this.y + 11, MARGIN_LEFT + 70, this.y + 11);
    this.doc.setLineWidth(0.2);
    this.y += 16;
    this.doc.setFontSize(6.5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(clientName, MARGIN_LEFT, this.y);
    this.y += 8;

    // Witnesses
    const witnessX = [MARGIN_LEFT, MARGIN_LEFT + 95];
    witnessX.forEach((x, idx) => {
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(`WITNESS ${idx + 1}`, x, this.y);
    });
    this.y += 2;
    witnessX.forEach((x) => {
      this.doc.setDrawColor(...COLORS.border);
      this.doc.rect(x, this.y, 80, 14);
      this.doc.setDrawColor(0, 0, 0);
      this.doc.setLineWidth(0.3);
      this.doc.line(x + 5, this.y + 11, x + 75, this.y + 11);
      this.doc.setLineWidth(0.2);
    });
    this.y += 16;
    witnessX.forEach((x) => {
      this.doc.setFontSize(6.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.muted);
      this.doc.text('Full Name: _______________________________', x, this.y);
      this.doc.text('ID Number: _______________________________', x, this.y + 3.5);
    });
    this.y += 8;
  }

  // ── Last Will Build ──────────────────────────────────────────────

  buildLastWill(data: WillDataPayload): jsPDF {
    this.renderHeader();

    // 1. Preamble
    this.renderSectionHead('1', 'Preamble');
    const preambleText =
      `I, ${data.personalDetails.fullName || '___________________'}, ` +
      `Identity Number ${data.personalDetails.idNumber || '___________________'}, ` +
      `born on ${formatDate(data.personalDetails.dateOfBirth)}, ` +
      `residing at ${data.personalDetails.physicalAddress || '___________________'}, ` +
      `being of sound mind and under no duress, hereby revoke all former wills and testamentary ` +
      `dispositions previously made by me and declare this to be my Last Will and Testament.`;
    this.renderCallout(preambleText);

    // 2. Personal Information
    this.checkPageBreak(45);
    this.renderSectionHead('2', 'Personal Information');
    const personalRows: [string, string][] = [
      ['Full Legal Name', data.personalDetails.fullName || '-'],
      ['Identity Number', data.personalDetails.idNumber || '-'],
      ['Date of Birth', formatDate(data.personalDetails.dateOfBirth)],
      ['Marital Status', MARITAL_STATUS_LABELS[data.personalDetails.maritalStatus] || data.personalDetails.maritalStatus],
    ];
    if (data.personalDetails.maritalStatus?.startsWith('married') && data.personalDetails.spouseName) {
      personalRows.push(['Spouse', `${data.personalDetails.spouseName}${data.personalDetails.spouseIdNumber ? ` (ID: ${data.personalDetails.spouseIdNumber})` : ''}`]);
    }
    personalRows.push(['Physical Address', data.personalDetails.physicalAddress || '-']);
    this.renderKeyValueTable(personalRows);

    // 3. Executors
    if (data.executors.length > 0) {
      this.checkPageBreak(25);
      this.renderSectionHead('3', 'Appointment of Executor(s)');
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text('I hereby nominate and appoint the following person(s) as executor(s):', MARGIN_LEFT, this.y);
      this.y += 4;
      this.renderDataTable(
        ['#', 'Name', 'Type', 'ID / Company', 'Contact Details'],
        data.executors.map((e, i) => [
          String(i + 1),
          e.name,
          e.type === 'professional' ? 'Professional' : 'Individual',
          e.type === 'professional' ? (e.company || '-') : (e.idNumber || '-'),
          e.contactDetails || '-',
        ]),
        [0.05, 0.25, 0.15, 0.2, 0.35],
      );
    }

    // 4. Beneficiaries
    if (data.beneficiaries.length > 0) {
      this.checkPageBreak(25);
      this.renderSectionHead('4', 'Beneficiaries & Distribution of Estate');
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text('The residue of my estate shall be distributed as follows:', MARGIN_LEFT, this.y);
      this.y += 4;
      const total = data.beneficiaries.reduce((s, b) => s + b.percentage, 0);
      this.renderDataTable(
        ['#', 'Name', 'ID Number', 'Relationship', 'Share (%)'],
        [
          ...data.beneficiaries.map((b, i) => [
            String(i + 1),
            b.name,
            b.idNumber || '-',
            b.relationship || '-',
            `${b.percentage}%`,
          ]),
          ['', '', '', 'Total', `${total}%`],
        ],
        [0.05, 0.3, 0.2, 0.2, 0.12],
      );
    }

    // 5. Guardians
    if (data.guardians.length > 0) {
      this.checkPageBreak(25);
      this.renderSectionHead('5', 'Guardianship of Minor Children');
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text('I nominate the following person(s) as guardian(s) of my minor children:', MARGIN_LEFT, this.y);
      this.y += 4;
      this.renderDataTable(
        ['#', 'Name', 'ID Number', 'Relationship', 'Address'],
        data.guardians.map((g, i) => [
          String(i + 1),
          g.name,
          g.idNumber || '-',
          g.relationship || '-',
          g.address || '-',
        ]),
        [0.05, 0.25, 0.15, 0.15, 0.4],
      );
    }

    // 6. Specific Bequests
    if (data.specificBequests.length > 0) {
      this.checkPageBreak(25);
      this.renderSectionHead('6', 'Specific Bequests');
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text('I bequeath the following specific items to the persons named below:', MARGIN_LEFT, this.y);
      this.y += 4;
      this.renderDataTable(
        ['#', 'Item / Description', 'Beneficiary', 'ID Number'],
        data.specificBequests.map((b, i) => [
          String(i + 1),
          b.itemDescription,
          b.beneficiaryName,
          b.beneficiaryIdNumber || '-',
        ]),
        [0.05, 0.4, 0.3, 0.25],
      );
    }

    // 7. Funeral Wishes & Additional Clauses
    if (data.funeralWishes || data.additionalClauses) {
      this.checkPageBreak(20);
      this.renderSectionHead('7', 'Funeral Wishes & Additional Clauses');
      if (data.funeralWishes) {
        this.doc.setFontSize(7.5);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...COLORS.text);
        this.doc.text('Funeral Wishes:', MARGIN_LEFT, this.y);
        this.y += 3;
        this.renderCallout(data.funeralWishes);
      }
      if (data.additionalClauses) {
        this.doc.setFontSize(7.5);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...COLORS.text);
        this.doc.text('Additional Clauses:', MARGIN_LEFT, this.y);
        this.y += 3;
        this.renderCallout(data.additionalClauses);
      }
    }

    // 8. Legal Notice
    this.checkPageBreak(20);
    this.renderSectionHead('8', 'Legal Notice');
    this.renderCallout(
      'Important: This document is a draft prepared by Navigate Wealth for review purposes only. ' +
      'It does not constitute a valid Last Will and Testament until it has been printed, signed by the testator ' +
      'in the presence of two competent witnesses (who must also sign), in compliance with the requirements ' +
      'of the Wills Act 7 of 1953 (South Africa). Navigate Wealth recommends that the testator seek ' +
      'independent legal advice before executing this will.',
      COLORS.amberBg,
      COLORS.amberBorder,
      COLORS.amberText,
    );

    // 9. Signatures
    this.checkPageBreak(70);
    this.renderSectionHead('9', 'Signatures');
    this.renderSignatures(data.personalDetails.fullName || 'Full Name');

    // Final footer
    this.renderFooter();
    return this.doc;
  }

  // ── Living Will Build ────────────────────────────────────────────

  buildLivingWill(data: LivingWillData): jsPDF {
    this.renderHeader();

    // 1. Preamble
    this.renderSectionHead('1', 'Declaration');
    const preambleText =
      `I, ${data.personalDetails.fullName || '___________________'}, ` +
      `Identity Number ${data.personalDetails.idNumber || '___________________'}, ` +
      `born on ${formatDate(data.personalDetails.dateOfBirth)}, ` +
      `residing at ${data.personalDetails.physicalAddress || '___________________'}, ` +
      `being of sound and disposing mind and memory, make this Living Will to express my wishes ` +
      `regarding medical treatment and end-of-life care in the event that I am unable to communicate ` +
      `my decisions.`;
    this.renderCallout(preambleText);

    // 2. Personal Information
    this.checkPageBreak(35);
    this.renderSectionHead('2', 'Personal Information');
    const personalRows: [string, string][] = [
      ['Full Legal Name', data.personalDetails.fullName || '-'],
      ['Identity Number', data.personalDetails.idNumber || '-'],
      ['Date of Birth', formatDate(data.personalDetails.dateOfBirth)],
      ['Physical Address', data.personalDetails.physicalAddress || '-'],
    ];
    this.renderKeyValueTable(personalRows);

    // 3. Healthcare Agents
    if (data.healthcareAgents.length > 0) {
      this.checkPageBreak(25);
      this.renderSectionHead('3', 'Healthcare Agent / Proxy');
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(
        'I appoint the following person(s) to make healthcare decisions on my behalf:',
        MARGIN_LEFT,
        this.y,
      );
      this.y += 4;
      this.renderDataTable(
        ['#', 'Name', 'ID Number', 'Relationship', 'Contact', 'Priority'],
        data.healthcareAgents.map((a, i) => [
          String(i + 1),
          a.name,
          a.idNumber || '-',
          a.relationship || '-',
          a.contactDetails || '-',
          a.isPrimary ? 'Primary' : 'Alternate',
        ]),
        [0.04, 0.22, 0.15, 0.15, 0.25, 0.12],
      );
    }

    // 4. Life-Sustaining Treatment
    this.checkPageBreak(40);
    this.renderSectionHead('4', 'Life-Sustaining Treatment Preferences');
    this.doc.setFontSize(7.5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(
      'In the event of a terminal condition, persistent vegetative state, or irreversible coma:',
      MARGIN_LEFT,
      this.y,
    );
    this.y += 4;

    const treatmentRows: [string, string][] = [
      ['Mechanical Ventilation', TREATMENT_LABELS[data.lifeSustainingTreatment.ventilator] || '-'],
      ['Cardiopulmonary Resuscitation (CPR)', TREATMENT_LABELS[data.lifeSustainingTreatment.cpr] || '-'],
      ['Artificial Nutrition & Hydration', TREATMENT_LABELS[data.lifeSustainingTreatment.artificialNutrition] || '-'],
      ['Dialysis', TREATMENT_LABELS[data.lifeSustainingTreatment.dialysis] || '-'],
      ['Antibiotics', TREATMENT_LABELS[data.lifeSustainingTreatment.antibiotics] || '-'],
    ];
    this.renderKeyValueTable(treatmentRows);

    if (data.lifeSustainingTreatment.additionalInstructions) {
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text('Additional Instructions:', MARGIN_LEFT, this.y);
      this.y += 3;
      this.renderCallout(data.lifeSustainingTreatment.additionalInstructions);
    }

    // 5. Pain Management
    this.checkPageBreak(25);
    this.renderSectionHead('5', 'Pain Management & Comfort Care');
    const painRows: [string, string][] = [
      ['Comfort Care Only (no curative treatment)', data.painManagement.comfortCareOnly ? 'Yes' : 'No'],
      ['Maximum Pain Relief (even if it hastens death)', data.painManagement.maximumPainRelief ? 'Yes' : 'No'],
    ];
    this.renderKeyValueTable(painRows);

    if (data.painManagement.additionalInstructions) {
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text('Additional Instructions:', MARGIN_LEFT, this.y);
      this.y += 3;
      this.renderCallout(data.painManagement.additionalInstructions);
    }

    // 6. Organ Donation
    this.checkPageBreak(25);
    this.renderSectionHead('6', 'Organ Donation');
    const donationRows: [string, string][] = [
      ['Organ Donor', data.organDonation.isDonor ? 'Yes' : 'No'],
      ['Donation Type', data.organDonation.donationType === 'all' ? 'All organs and tissues' : data.organDonation.donationType === 'specific' ? 'Specific organs only' : 'None'],
    ];
    if (data.organDonation.donationType === 'specific' && data.organDonation.specificOrgans) {
      donationRows.push(['Specific Organs', data.organDonation.specificOrgans]);
    }
    this.renderKeyValueTable(donationRows);

    if (data.organDonation.additionalInstructions) {
      this.renderCallout(data.organDonation.additionalInstructions);
    }

    // 7. Funeral Wishes
    if (data.funeralWishes) {
      this.checkPageBreak(15);
      this.renderSectionHead('7', 'Funeral & End-of-Life Wishes');
      this.renderCallout(data.funeralWishes);
    }

    // 8. Additional Directives
    if (data.additionalDirectives) {
      this.checkPageBreak(15);
      this.renderSectionHead(data.funeralWishes ? '8' : '7', 'Additional Directives');
      this.renderCallout(data.additionalDirectives);
    }

    // Legal Notice
    const legalNum = (data.funeralWishes ? 1 : 0) + (data.additionalDirectives ? 1 : 0) + 6;
    this.checkPageBreak(20);
    this.renderSectionHead(String(legalNum + 1), 'Legal Notice');
    this.renderCallout(
      'Important: This Living Will is a directive prepared by Navigate Wealth for review purposes only. ' +
      'It does not constitute a legally binding document until signed by the declarant in the presence of ' +
      'two competent witnesses. Navigate Wealth recommends that the declarant seek independent legal and ' +
      'medical advice before executing this directive.',
      COLORS.amberBg,
      COLORS.amberBorder,
      COLORS.amberText,
    );

    // Signatures
    this.checkPageBreak(70);
    this.renderSectionHead(String(legalNum + 2), 'Signatures');
    this.renderSignatures(data.personalDetails.fullName || 'Full Name');

    this.renderFooter();
    return this.doc;
  }
}

// ── Public API ──────────────────────────────────────────────────────

export function generateWillPdf(will: WillRecord): jsPDF {
  const builder = new WillPdfBuilder(will);
  if (will.type === 'living_will') {
    return builder.buildLivingWill(will.data as LivingWillData);
  }
  return builder.buildLastWill(will.data as WillDataPayload);
}

export function downloadWillPdf(will: WillRecord): void {
  const doc = generateWillPdf(will);
  const fullName = (will.data.personalDetails.fullName || '').trim();
  const docLabel =
    will.type === 'living_will'
      ? fullName
        ? `Living Will - ${fullName}`
        : 'Living Will'
      : fullName
        ? `Last Will and Testament - ${fullName}`
        : 'Last Will and Testament';
  doc.save(navigateWealthPdfSaveFileName(docLabel));
}