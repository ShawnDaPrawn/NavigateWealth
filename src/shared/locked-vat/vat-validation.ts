/**
 * VAT evidence validation — pure rules for SARS refund-verification readiness.
 *
 * Flags the gaps SARS verification most commonly rejects a refund over:
 * missing tax invoices, unverified FULL tax invoices on supplies > R5,000
 * (s20(4) requires the recipient's details above that threshold), missing
 * supplier VAT numbers, VAT claimed above the arithmetic maximum, duplicate
 * claims of the same counterparty reference, and large inputs without proof
 * of payment.
 *
 * Pure TypeScript with no imports; consumed by the routes layer (which
 * supplies supplier data) and unit-tested with Vitest.
 *
 * @module shared/locked-vat/vat-validation
 */

export type TransactionFlag =
  | 'missing_tax_invoice'
  | 'missing_invoice_copy'
  | 'full_invoice_unverified'
  | 'no_supplier_vat_number'
  | 'vat_exceeds_rate'
  | 'duplicate_reference'
  | 'missing_proof_of_payment';

/** Human-readable explanations, used by the UI and the submission pack. */
export const FLAG_LABELS: Record<TransactionFlag, string> = {
  missing_tax_invoice: 'No tax invoice attached — SARS will disallow this input claim',
  missing_invoice_copy:
    'No copy of the issued invoice attached (output supplies must be evidenced)',
  full_invoice_unverified:
    'Over R5,000 — confirm the attached document is a FULL tax invoice (recipient name, address and VAT number)',
  no_supplier_vat_number: 'Linked supplier has no VAT number on file',
  vat_exceeds_rate: 'VAT amount exceeds 15/115 of the gross amount',
  duplicate_reference:
    'Same counterparty + reference captured more than once (possible duplicate claim)',
  missing_proof_of_payment: 'Large input with no proof of payment attached',
};

/** s20(4)/(5): a FULL tax invoice is required when consideration exceeds R5,000. */
export const FULL_INVOICE_THRESHOLD = 5000;

/** Flag inputs at/above this gross amount when no proof of payment is attached. */
export const DEFAULT_PROOF_OF_PAYMENT_THRESHOLD = 10000;

/** No documentary proof is required for supplies of R50 or less (s20(6)). */
export const NO_INVOICE_REQUIRED_THRESHOLD = 50;

const VAT_RATE = 0.15;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Minimal transaction shape the rules need (structural subset of the record). */
export interface ValidatableTransaction {
  id: string;
  direction: 'income' | 'expense';
  vatTreatment: 'standard' | 'zero_rated' | 'exempt';
  amount: number;
  vatAmount: number;
  counterparty?: { kind: string; id?: string; name: string };
  reference?: string;
  attachments?: Array<{ kind: string; verifiedFull?: boolean }>;
}

export interface ValidationContext {
  /** VAT numbers by supplier id (empty string = supplier has none on file). */
  supplierVatNumbers?: Record<string, string>;
  proofOfPaymentThreshold?: number;
}

function counterpartyKey(txn: ValidatableTransaction): string | null {
  const ref = (txn.reference ?? '').trim().toLowerCase();
  if (!ref) return null;
  const who = txn.counterparty?.id || txn.counterparty?.name.trim().toLowerCase();
  return who ? `${who}::${ref}` : null;
}

/**
 * Compute flags for every transaction in a set. Duplicate detection is
 * cross-transaction, which is why the whole list is validated together.
 */
export function computeTransactionFlags(
  transactions: ValidatableTransaction[],
  context: ValidationContext = {},
): Record<string, TransactionFlag[]> {
  const threshold = context.proofOfPaymentThreshold ?? DEFAULT_PROOF_OF_PAYMENT_THRESHOLD;
  const supplierVat = context.supplierVatNumbers ?? {};

  // Counterparty+reference occurrence counts for duplicate detection.
  const refCounts = new Map<string, number>();
  for (const txn of transactions) {
    const key = counterpartyKey(txn);
    if (key) refCounts.set(key, (refCounts.get(key) ?? 0) + 1);
  }

  const result: Record<string, TransactionFlag[]> = {};
  for (const txn of transactions) {
    const flags: TransactionFlag[] = [];
    const attachments = txn.attachments ?? [];
    const taxInvoices = attachments.filter((a) => a.kind === 'tax_invoice');
    const needsDocument = txn.amount > NO_INVOICE_REQUIRED_THRESHOLD;

    if (needsDocument && taxInvoices.length === 0) {
      flags.push(txn.direction === 'expense' ? 'missing_tax_invoice' : 'missing_invoice_copy');
    }

    if (
      txn.direction === 'expense' &&
      txn.amount > FULL_INVOICE_THRESHOLD &&
      taxInvoices.length > 0 &&
      !taxInvoices.some((a) => a.verifiedFull)
    ) {
      flags.push('full_invoice_unverified');
    }

    if (
      txn.direction === 'expense' &&
      txn.counterparty?.kind === 'supplier' &&
      txn.counterparty.id &&
      !(supplierVat[txn.counterparty.id] ?? '').trim()
    ) {
      flags.push('no_supplier_vat_number');
    }

    const maxVat = round2((txn.amount * VAT_RATE) / (1 + VAT_RATE));
    if (txn.vatAmount > maxVat + 0.05) {
      flags.push('vat_exceeds_rate');
    }

    const key = counterpartyKey(txn);
    if (key && (refCounts.get(key) ?? 0) > 1) {
      flags.push('duplicate_reference');
    }

    if (
      txn.direction === 'expense' &&
      txn.amount >= threshold &&
      !attachments.some((a) => a.kind === 'proof_of_payment')
    ) {
      flags.push('missing_proof_of_payment');
    }

    result[txn.id] = flags;
  }
  return result;
}

/** Share of transactions with no flags — the "evidence completeness" metric. */
export function evidenceCompleteness(flagsById: Record<string, TransactionFlag[]>): number {
  const ids = Object.keys(flagsById);
  if (ids.length === 0) return 1;
  const clean = ids.filter((id) => flagsById[id].length === 0).length;
  return clean / ids.length;
}
