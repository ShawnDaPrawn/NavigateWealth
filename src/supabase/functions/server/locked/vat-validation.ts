/**
 * VAT evidence validation — server-side entry.
 *
 * The pure rules live in the locked-owned shared module (consumed verbatim by
 * the locked UI for flag labels/completeness), mirroring how the supplier
 * template spec is shared. Deleted together with the locked module.
 *
 * @module server/vat-validation
 */

export {
  computeTransactionFlags,
  DEFAULT_PROOF_OF_PAYMENT_THRESHOLD,
  evidenceCompleteness,
  FLAG_LABELS,
  FULL_INVOICE_THRESHOLD,
  NO_INVOICE_REQUIRED_THRESHOLD,
} from '../../../../shared/locked-vat/vat-validation.ts';
export type {
  TransactionFlag,
  ValidatableTransaction,
  ValidationContext,
} from '../../../../shared/locked-vat/vat-validation.ts';
