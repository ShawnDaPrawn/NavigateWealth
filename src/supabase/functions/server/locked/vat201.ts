/**
 * VAT201 mapping + submission lifecycle — server-side entry.
 *
 * Pure rules live in the locked-owned shared module (also consumed by the
 * locked UI); deleted together with the locked module.
 *
 * @module server/vat201
 */

export {
  addBusinessDays,
  businessDaysBetween,
  CAPITAL_CATEGORIES,
  computeVat201,
  isLockedStatus,
  periodKey,
  REFUND_CLOCK_BUSINESS_DAYS,
  refundClock,
  vat201Rows,
} from '../../../../shared/locked-vat/vat201.ts';
export type {
  SubmissionStatus,
  Vat201Fields,
  Vat201Transaction,
} from '../../../../shared/locked-vat/vat201.ts';
