/**
 * Refund Clusters — VAT evidence validation (re-export)
 *
 * The rules live in the locked-owned shared module, computed server-side per
 * ledger fetch; the client uses the labels and completeness helper for
 * display.
 */

export {
  DEFAULT_PROOF_OF_PAYMENT_THRESHOLD,
  evidenceCompleteness,
  FLAG_LABELS,
  FULL_INVOICE_THRESHOLD,
} from '../../../../../shared/locked-vat/vat-validation';
export type { TransactionFlag } from '../../../../../shared/locked-vat/vat-validation';
