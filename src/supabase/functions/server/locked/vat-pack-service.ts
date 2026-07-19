/**
 * VAT Submission Pack generator
 *
 * Builds the ZIP an operator hands to SARS during a VAT refund verification:
 * a cover summary PDF, output/input schedules (PDF + CSV) whose rows
 * cross-reference the evidence files, every supporting document renamed
 * consistently, the entity's compliance documents, and a missing-evidence
 * checklist for anything a verifier would query.
 *
 * Packs are generated on demand and streamed — never stored.
 *
 * @module server/vat-pack-service
 */

import { zipSync, type Zippable } from 'npm:fflate@0.8.2';
import { jsPDF } from 'npm:jspdf';
import autoTableMod from 'npm:jspdf-autotable';
import { createModuleLogger } from '../stderr-logger.ts';
import type {
  RefundClusterRecord,
  RefundEntityDocument,
  RefundEntityRecord,
  RefundTransactionRecord,
} from './refund-clusters-service.ts';
import { FLAG_LABELS, type TransactionFlag } from './vat-validation.ts';
import { computeVat201, vat201Rows } from './vat201.ts';
import { evidenceFileName, sanitizeFragment } from '../../../../shared/locked-vat/pack-naming.ts';

export { evidenceFileName, sanitizeFragment };

// Cast to callable — npm type resolution exposes module type, not the function signature
const autoTable = autoTableMod as unknown as (doc: jsPDF, options: Record<string, unknown>) => void;

const log = createModuleLogger('vat-pack');

/** Entity compliance documents worth including in every pack. */
export const COMPLIANCE_PACK_DOC_TYPES = [
  'sars_vat_certificate',
  'company_registration',
  'proof_of_business_address',
];

export interface PackPeriod {
  /** ISO yyyy-mm-dd inclusive bounds. */
  start: string;
  end: string;
  /** Human label, e.g. "Jun–Jul 2026 (Category B)". */
  label: string;
}

export interface PackInput {
  cluster: RefundClusterRecord;
  entity: RefundEntityRecord;
  period: PackPeriod;
  /** Transactions already filtered to the period (migrated shape). */
  transactions: RefundTransactionRecord[];
  flags: Record<string, TransactionFlag[]>;
  /** Compliance documents to include (already filtered by type). */
  documents: RefundEntityDocument[];
  /** Streams a stored file; null when missing (recorded in the pack, not fatal). */
  fetchFile: (storagePath: string) => Promise<Uint8Array | null>;
}

// ============================================================================
// Small helpers
// ============================================================================

const fmtR = (value: number): string =>
  `R${value
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

function entityDisplayName(entity: RefundEntityRecord): string {
  if (entity.entityType === 'company') {
    return entity.businessDetails?.tradingName || entity.businessDetails?.companyName || 'Company';
  }
  const first = entity.personalDetails?.name ?? '';
  const last = entity.personalDetails?.surname ?? '';
  return [first, last].filter(Boolean).join(' ') || 'Sole proprietor';
}

interface PeriodSummary {
  outputVat: number;
  inputVat: number;
  netVat: number;
  outputTotal: number;
  inputTotal: number;
}

function summarize(transactions: RefundTransactionRecord[]): PeriodSummary {
  let outputVat = 0;
  let inputVat = 0;
  let outputTotal = 0;
  let inputTotal = 0;
  for (const t of transactions) {
    if (t.direction === 'income') {
      outputVat += t.vatAmount;
      outputTotal += t.amount;
    } else {
      inputVat += t.vatAmount;
      inputTotal += t.amount;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    outputVat: r2(outputVat),
    inputVat: r2(inputVat),
    netVat: r2(outputVat - inputVat),
    outputTotal: r2(outputTotal),
    inputTotal: r2(inputTotal),
  };
}

// ============================================================================
// PDF builders
// ============================================================================

function pdfToBytes(doc: jsPDF): Uint8Array {
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}

function buildCoverPdf(input: PackInput, summary: PeriodSummary, flaggedCount: number): Uint8Array {
  const { cluster, entity, period } = input;
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('VAT SUBMISSION PACK', 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (UTC)`, 14, y);
  y += 12;

  const rows: Array<[string, string]> = [
    ['Vendor', entityDisplayName(entity)],
    ['Entity type', entity.entityType === 'company' ? 'Company' : 'Sole proprietor'],
    ...(entity.businessDetails?.registrationNumber
      ? ([['Registration number', entity.businessDetails.registrationNumber]] as Array<
          [string, string]
        >)
      : []),
    ['Cluster', cluster.name],
    ['VAT category', cluster.vatPeriod || '—'],
    ['VAT period', period.label],
    ['Period dates', `${period.start} to ${period.end}`],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Vendor details', '']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [31, 41, 55] },
  });

  const afterVendor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
  const vat201 = computeVat201(input.transactions);
  autoTable(doc, {
    startY: afterVendor + 10,
    head: [['Field', 'VAT201 line', 'Amount']],
    body: [
      ...vat201Rows(vat201).map((row) => [
        row.field,
        row.field === '19'
          ? vat201.netVat < 0
            ? 'Net VAT — REFUND DUE'
            : 'Net VAT — payable'
          : row.label,
        fmtR(row.field === '19' ? Math.abs(row.value) : row.value),
      ]),
      [
        '—',
        'Gross totals: output / input (VAT-inclusive)',
        `${fmtR(summary.outputTotal)} / ${fmtR(summary.inputTotal)}`,
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [31, 41, 55] },
  });

  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
  doc.setFontSize(10);
  doc.text(
    flaggedCount === 0
      ? 'Evidence status: every transaction in this period carries its supporting documentation.'
      : `Evidence status: ${flaggedCount} transaction(s) flagged — see 99_Missing_Evidence.pdf.`,
    14,
    afterSummary + 10,
  );
  doc.text(
    'Schedules 01/02 cross-reference the files in 03_Evidence by file name.',
    14,
    afterSummary + 16,
  );
  return pdfToBytes(doc);
}

function buildSchedulePdf(
  title: string,
  transactions: RefundTransactionRecord[],
  flags: Record<string, TransactionFlag[]>,
  evidenceNames: Map<string, string[]>,
): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [
      [
        'Date',
        'Counterparty',
        'Reference',
        'Description',
        'Treatment',
        'Excl',
        'VAT',
        'Incl',
        'Evidence',
        'Flags',
      ],
    ],
    body: transactions.map((t) => [
      t.date,
      t.counterparty?.name ?? '—',
      t.reference ?? '—',
      t.description || '—',
      t.vatTreatment.replace('_', '-'),
      fmtR(Math.round((t.amount - t.vatAmount) * 100) / 100),
      fmtR(t.vatAmount),
      fmtR(t.amount),
      (evidenceNames.get(t.id) ?? []).join('\n') || 'NONE',
      (flags[t.id] ?? []).length > 0 ? (flags[t.id] ?? []).join(', ') : '',
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [31, 41, 55], fontSize: 7 },
    columnStyles: { 8: { cellWidth: 60 } },
  });
  return pdfToBytes(doc);
}

function buildMissingEvidencePdf(
  transactions: RefundTransactionRecord[],
  flags: Record<string, TransactionFlag[]>,
): Uint8Array {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Missing / Flagged Evidence Checklist', 14, 16);
  const flagged = transactions.filter((t) => (flags[t.id] ?? []).length > 0);
  if (flagged.length === 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('No gaps — every transaction in this period passed the evidence checks.', 14, 28);
    return pdfToBytes(doc);
  }
  autoTable(doc, {
    startY: 22,
    head: [['Date', 'Counterparty', 'Amount', 'Issue']],
    body: flagged.flatMap((t) =>
      (flags[t.id] ?? []).map((f) => [
        t.date,
        t.counterparty?.name ?? t.description ?? '—',
        fmtR(t.amount),
        FLAG_LABELS[f] ?? f,
      ]),
    ),
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [153, 27, 27] },
  });
  return pdfToBytes(doc);
}

function buildScheduleCsv(transactions: RefundTransactionRecord[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    'date,counterparty,reference,description,treatment,amount_excl,vat,amount_incl,payment_status',
  ];
  for (const t of transactions) {
    lines.push(
      [
        t.date,
        esc(t.counterparty?.name ?? ''),
        esc(t.reference ?? ''),
        esc(t.description ?? ''),
        t.vatTreatment,
        (Math.round((t.amount - t.vatAmount) * 100) / 100).toFixed(2),
        t.vatAmount.toFixed(2),
        t.amount.toFixed(2),
        t.payment?.status ?? '',
      ].join(','),
    );
  }
  return lines.join('\n');
}

// ============================================================================
// Pack builder
// ============================================================================

export async function buildSubmissionPack(input: PackInput): Promise<Uint8Array> {
  const { transactions, flags, documents, fetchFile } = input;
  const outputs = transactions.filter((t) => t.direction === 'income');
  const inputs = transactions.filter((t) => t.direction === 'expense');
  const summary = summarize(transactions);
  const flaggedCount = transactions.filter((t) => (flags[t.id] ?? []).length > 0).length;

  const files: Zippable = {};

  // Evidence files, renamed consistently, with schedule cross-references.
  const evidenceNames = new Map<string, string[]>();
  const usedNames = new Set<string>();
  for (const txn of transactions) {
    const dir = txn.direction === 'income' ? 'outputs' : 'inputs';
    const names: string[] = [];
    for (const attachment of txn.attachments ?? []) {
      let name = evidenceFileName(txn, attachment);
      let dup = 0;
      while (usedNames.has(`${dir}/${name}`)) {
        dup += 1;
        name = evidenceFileName(txn, attachment, dup);
      }
      usedNames.add(`${dir}/${name}`);
      const bytes = await fetchFile(attachment.storagePath);
      if (bytes) {
        files[`03_Evidence/${dir}/${name}`] = bytes;
        names.push(name);
      } else {
        log.error('Evidence file missing from storage', { storagePath: attachment.storagePath });
        names.push(`${name} (FILE MISSING FROM STORAGE)`);
      }
    }
    evidenceNames.set(txn.id, names);
  }

  // Compliance documents.
  for (const document of documents) {
    const bytes = await fetchFile(document.storagePath);
    if (bytes) {
      const ext = document.fileName.includes('.') ? document.fileName.split('.').pop() : 'bin';
      files[`05_Compliance/${sanitizeFragment(document.documentType)}.${ext}`] = bytes;
    }
  }

  files['00_Cover_Summary.pdf'] = buildCoverPdf(input, summary, flaggedCount);
  files['01_Output_Schedule.pdf'] = buildSchedulePdf(
    `Output supplies — ${input.period.label}`,
    outputs,
    flags,
    evidenceNames,
  );
  files['01_Output_Schedule.csv'] = new TextEncoder().encode(buildScheduleCsv(outputs));
  files['02_Input_Schedule.pdf'] = buildSchedulePdf(
    `Input purchases — ${input.period.label}`,
    inputs,
    flags,
    evidenceNames,
  );
  files['02_Input_Schedule.csv'] = new TextEncoder().encode(buildScheduleCsv(inputs));
  files['99_Missing_Evidence.pdf'] = buildMissingEvidencePdf(transactions, flags);

  return zipSync(files, { level: 6 });
}
