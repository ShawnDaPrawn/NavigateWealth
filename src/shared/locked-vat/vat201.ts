/**
 * VAT201 field mapping + submission lifecycle helpers — pure rules.
 *
 * Maps the entity ledger onto the SARS VAT201 return fields so the operator
 * can transcribe line-by-line into eFiling, and models the refund payout
 * clock (21 business days from submission, s45 of the VAT Act) that matters
 * for vendors in refund positions.
 *
 * Locked-owned shared module (SPA + edge); deleted together with the locked
 * module (see components/admin/modules/locked/README.md).
 *
 * @module shared/locked-vat/vat201
 */

// ============================================================================
// Categories
// ============================================================================

/**
 * Ledger categories that are capital goods — VAT201 separates input tax on
 * capital goods (field 14) from other goods/services (field 15).
 */
export const CAPITAL_CATEGORIES: ReadonlySet<string> = new Set([
  'equipment_capital',
  'vehicles_capital',
]);

// ============================================================================
// VAT201 computation
// ============================================================================

/** Minimal transaction shape the mapping needs. */
export interface Vat201Transaction {
  direction: 'income' | 'expense';
  vatTreatment: 'standard' | 'zero_rated' | 'exempt';
  /** Gross amount, VAT-inclusive. */
  amount: number;
  vatAmount: number;
  category?: string;
}

export interface Vat201Fields {
  /** Field 1 — standard-rated supplies, consideration excl. VAT. */
  standardRatedSuppliesExcl: number;
  /** Field 2 — zero-rated supplies. */
  zeroRatedSupplies: number;
  /** Field 3 — exempt and non-supplies. */
  exemptSupplies: number;
  /** Field 13 — total output tax. */
  totalOutputTax: number;
  /** Field 14 — input tax on capital goods. */
  inputTaxCapitalGoods: number;
  /** Field 15 — input tax on other goods and services. */
  inputTaxOtherGoods: number;
  /** Fields 14 + 15. */
  totalInputTax: number;
  /** Field 19 — net (negative = refundable). */
  netVat: number;
}

const r2 = (value: number): number => Math.round(value * 100) / 100;

/** Map period-scoped ledger transactions onto the VAT201 field lines. */
export function computeVat201(transactions: Vat201Transaction[]): Vat201Fields {
  let standardExcl = 0;
  let zeroRated = 0;
  let exempt = 0;
  let outputTax = 0;
  let inputCapital = 0;
  let inputOther = 0;

  for (const txn of transactions) {
    if (txn.direction === 'income') {
      if (txn.vatTreatment === 'standard') {
        standardExcl += txn.amount - txn.vatAmount;
        outputTax += txn.vatAmount;
      } else if (txn.vatTreatment === 'zero_rated') {
        zeroRated += txn.amount;
      } else {
        exempt += txn.amount;
      }
    } else if (txn.vatAmount > 0) {
      if (CAPITAL_CATEGORIES.has(txn.category ?? '')) inputCapital += txn.vatAmount;
      else inputOther += txn.vatAmount;
    }
  }

  const totalOutputTax = r2(outputTax);
  const totalInputTax = r2(inputCapital + inputOther);
  return {
    standardRatedSuppliesExcl: r2(standardExcl),
    zeroRatedSupplies: r2(zeroRated),
    exemptSupplies: r2(exempt),
    totalOutputTax,
    inputTaxCapitalGoods: r2(inputCapital),
    inputTaxOtherGoods: r2(inputOther),
    totalInputTax,
    netVat: r2(totalOutputTax - totalInputTax),
  };
}

/** VAT201 rows with SARS field numbers, in transcription order. */
export function vat201Rows(
  fields: Vat201Fields,
): Array<{ field: string; label: string; value: number }> {
  return [
    {
      field: '1',
      label: 'Standard-rated supplies (excl. VAT)',
      value: fields.standardRatedSuppliesExcl,
    },
    { field: '2', label: 'Zero-rated supplies', value: fields.zeroRatedSupplies },
    { field: '3', label: 'Exempt and non-supplies', value: fields.exemptSupplies },
    { field: '13', label: 'Total output tax', value: fields.totalOutputTax },
    { field: '14', label: 'Input tax — capital goods', value: fields.inputTaxCapitalGoods },
    { field: '15', label: 'Input tax — other goods/services', value: fields.inputTaxOtherGoods },
    { field: '19', label: 'Net VAT (negative = refund due)', value: fields.netVat },
  ];
}

// ============================================================================
// Submission lifecycle
// ============================================================================

export type SubmissionStatus = 'open' | 'submitted' | 'verification' | 'refund_received' | 'closed';

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  open: 'Open',
  submitted: 'Submitted to SARS',
  verification: 'Under verification',
  refund_received: 'Refund received',
  closed: 'Closed',
};

/**
 * A period is locked (no transaction create/edit/delete inside its dates)
 * from the moment it is submitted. Evidence attachments stay allowed —
 * verification is exactly when documents get gathered.
 */
export function isLockedStatus(status: SubmissionStatus | undefined): boolean {
  return status !== undefined && status !== 'open';
}

/** Stable KV key fragment for a period. */
export function periodKey(start: string, end: string): string {
  return `${start}_${end}`;
}

// ============================================================================
// Refund payout clock (21 business days, s45)
// ============================================================================

/** SARS must pay a verified refund within 21 business days of submission. */
export const REFUND_CLOCK_BUSINESS_DAYS = 21;

function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

/** Add N business days (weekends skipped; public holidays not modelled). */
export function addBusinessDays(isoDate: string, businessDays: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  let remaining = businessDays;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isBusinessDay(date)) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

/** Business days from `fromIso` (exclusive) to `toIso` (inclusive); 0 when to ≤ from. */
export function businessDaysBetween(fromIso: string, toIso: string): number {
  if (toIso <= fromIso) return 0;
  const cursor = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${toIso}T00:00:00Z`);
  let count = 0;
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor)) count += 1;
  }
  return count;
}

export interface RefundClock {
  /** Payout deadline: submission date + 21 business days. */
  expectedBy: string;
  /** Business days elapsed since submission (as of `today`). */
  elapsed: number;
  overdue: boolean;
}

export function refundClock(submittedDateIso: string, todayIso: string): RefundClock {
  const expectedBy = addBusinessDays(submittedDateIso, REFUND_CLOCK_BUSINESS_DAYS);
  return {
    expectedBy,
    elapsed: businessDaysBetween(submittedDateIso, todayIso),
    overdue: todayIso > expectedBy,
  };
}
