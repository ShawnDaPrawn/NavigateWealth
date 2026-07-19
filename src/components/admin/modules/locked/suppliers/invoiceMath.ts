/**
 * Suppliers — Invoice line math & template-driven formatting
 *
 * Line items carry VAT-EXCLUSIVE unit prices (unlike the refund-clusters
 * ledger, whose amounts are VAT-inclusive). The rounding rules (`round2`,
 * per-line rounding before summing) intentionally match both `vat.ts` and the
 * server's computeInvoiceTotals so client preview and stored totals agree to
 * the cent.
 */

import { round2 } from '../refund-clusters/vat';
import { VAT_RATE } from '../refund-clusters/constants';
import type {
  InvoiceLineItem,
  InvoicePreviewData,
  InvoiceTotals,
  Supplier,
  VatTreatment,
} from './types';
import type { TemplateCurrencyFormat, TemplateDateFormat } from './templateSpec';

export function lineNet(line: Pick<InvoiceLineItem, 'quantity' | 'unitPrice'>): number {
  return round2(line.quantity * line.unitPrice);
}

export function lineVat(line: InvoiceLineItem): number {
  return line.vatTreatment === 'standard' ? round2(lineNet(line) * VAT_RATE) : 0;
}

export function lineTotal(line: InvoiceLineItem): number {
  return round2(lineNet(line) + lineVat(line));
}

/** Mirrors the server's computeInvoiceTotals — keep the two in lockstep. */
export function computeInvoiceTotals(lineItems: InvoiceLineItem[]): InvoiceTotals {
  let subtotal = 0;
  let vatAmount = 0;
  for (const line of lineItems) {
    subtotal += lineNet(line);
    vatAmount += lineVat(line);
  }
  subtotal = round2(subtotal);
  vatAmount = round2(vatAmount);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

export function emptyLineItem(defaultTreatment: VatTreatment = 'standard'): InvoiceLineItem {
  return { description: '', quantity: 1, unitPrice: 0, vatTreatment: defaultTreatment };
}

/** Sample data for template previews before a real invoice exists. */
export function sampleInvoiceData(supplier: Supplier): InvoicePreviewData {
  return {
    invoiceNumber: 'INV-0042',
    invoiceDate: '2026-07-01',
    dueDate: '2026-07-31',
    billedToName: 'Example Client (Pty) Ltd',
    billedToVatNumber: '4123456789',
    billedToAddress: '1 Client Street, Cape Town, 8001',
    lineItems: [
      {
        description: 'Professional services rendered',
        quantity: 10,
        unitPrice: 850,
        vatTreatment: supplier.defaultVatTreatment,
      },
      {
        description: 'Call-out fee',
        quantity: 1,
        unitPrice: 450,
        vatTreatment: supplier.defaultVatTreatment,
      },
    ],
  };
}

// ============================================================================
// Template-driven formatting
// ============================================================================

/** Format an amount in the currency style captured from the example invoice. */
export function formatTemplateCurrency(value: number, format: TemplateCurrencyFormat): string {
  const fixed = Math.abs(value).toFixed(2);
  const [whole, cents] = fixed.split('.');
  const sign = value < 0 ? '-' : '';
  const spaceGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const commaGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  switch (format) {
    case 'R 1,234.56':
      return `${sign}R ${commaGrouped}.${cents}`;
    case 'ZAR 1 234.56':
      return `${sign}ZAR ${spaceGrouped}.${cents}`;
    case 'R1 234,56':
    default:
      return `${sign}R${spaceGrouped},${cents}`;
  }
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Format an ISO yyyy-mm-dd date in the style captured from the example invoice. */
export function formatTemplateDate(isoDate: string, format: TemplateDateFormat): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  switch (format) {
    case 'dd MMM yyyy':
      return `${day} ${MONTHS_SHORT[Number(month) - 1] ?? month} ${year}`;
    case 'dd/MM/yyyy':
      return `${day}/${month}/${year}`;
    case 'yyyy-MM-dd':
      return isoDate;
    case 'yyyy/MM/dd':
    default:
      return `${year}/${month}/${day}`;
  }
}
