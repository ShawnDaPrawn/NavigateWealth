/**
 * Refund Clusters — VAT calculations (pure, unit-tested).
 *
 * South African VAT at 15%. Amounts are captured VAT-inclusive. A transaction
 * is either income (output VAT, payable to SARS) or an expense (input VAT,
 * claimable from SARS). The net position for a period is output − input:
 *   net > 0 → payable (output position)
 *   net < 0 → refundable (input position)
 */

import { VAT_RATE } from './constants';
import type { RefundTransaction, VatPeriodCategory, VatTreatment } from './types';

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** VAT-inclusive VAT portion of an amount; 0 for zero-rated/exempt. */
export function vatFromInclusive(amount: number, treatment: VatTreatment): number {
  if (treatment !== 'standard' || !Number.isFinite(amount) || amount <= 0) return 0;
  return round2((amount * VAT_RATE) / (1 + VAT_RATE));
}

export interface VatPeriod {
  /** Inclusive start date (ISO yyyy-mm-dd). */
  start: string;
  /** Inclusive end date (ISO yyyy-mm-dd). */
  end: string;
  label: string;
}

const MONTH_NAMES = [
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

const iso = (year: number, month1: number, day: number): string =>
  `${year.toString().padStart(4, '0')}-${month1.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;

const lastDayOfMonth = (year: number, month1: number): number =>
  new Date(year, month1, 0).getDate();

/**
 * The open VAT period for a category as at `refDate`.
 *
 * - Category C: the calendar month.
 * - Category A: 2-month window ending in an ODD month (Dec-Jan, Feb-Mar, …).
 * - Category B: 2-month window ending in an EVEN month (Jan-Feb, Mar-Apr, …).
 *
 * Returns null when no category is set (caller treats this as "all transactions").
 */
export function currentVatPeriod(
  category: VatPeriodCategory | '',
  refDate: Date = new Date(),
): VatPeriod | null {
  if (category !== 'A' && category !== 'B' && category !== 'C') return null;

  const year = refDate.getFullYear();
  const month1 = refDate.getMonth() + 1; // 1-12

  if (category === 'C') {
    const end = lastDayOfMonth(year, month1);
    return {
      start: iso(year, month1, 1),
      end: iso(year, month1, end),
      label: `${MONTH_NAMES[month1 - 1]} ${year}`,
    };
  }

  // Bi-monthly: determine the end month by parity.
  const wantOdd = category === 'A';
  const isOdd = month1 % 2 === 1;
  // End month is this month if its parity matches, otherwise the next month.
  let endMonth = isOdd === wantOdd ? month1 : month1 + 1;
  let endYear = year;
  if (endMonth > 12) {
    endMonth = 1;
    endYear += 1;
  }
  // Start month is the month before the end month.
  let startMonth = endMonth - 1;
  let startYear = endYear;
  if (startMonth < 1) {
    startMonth = 12;
    startYear -= 1;
  }

  return {
    start: iso(startYear, startMonth, 1),
    end: iso(endYear, endMonth, lastDayOfMonth(endYear, endMonth)),
    label: `${MONTH_NAMES[startMonth - 1]}–${MONTH_NAMES[endMonth - 1]} ${endYear}`,
  };
}

/** The submission period immediately before the one open at `refDate` (null if no category). */
export function previousVatPeriod(
  category: VatPeriodCategory | '',
  refDate: Date = new Date(),
): VatPeriod | null {
  const current = currentVatPeriod(category, refDate);
  if (!current) return null;
  // Step to the day before this period starts; that date falls in the prior
  // period, so currentVatPeriod resolves it — handling A/B/C + year-wrap for free.
  const [y, m, d] = current.start.split('-').map(Number);
  const dayBefore = new Date(y, m - 1, d - 1);
  return currentVatPeriod(category, dayBefore);
}

/** The current period plus the `count - 1` periods before it, most recent first. */
export function recentVatPeriods(
  category: VatPeriodCategory | '',
  count: number,
  refDate: Date = new Date(),
): VatPeriod[] {
  const periods: VatPeriod[] = [];
  let cursor = refDate;
  for (let i = 0; i < count; i += 1) {
    const period = currentVatPeriod(category, cursor);
    if (!period) break;
    periods.push(period);
    const [y, m, d] = period.start.split('-').map(Number);
    cursor = new Date(y, m - 1, d - 1);
  }
  return periods;
}

/** Human-readable date range, e.g. "Feb–Mar 2026 (1 Feb 2026 – 31 Mar 2026)". */
export function formatPeriodRange(period: VatPeriod): string {
  const fmt = (isoDate: string): string => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
  };
  return `${period.label} (${fmt(period.start)} – ${fmt(period.end)})`;
}

export type VatStatus = 'refundable' | 'payable' | 'nil';

export interface VatSummary {
  totalIncome: number;
  totalExpense: number;
  /** Output VAT — VAT on income (payable to SARS). */
  outputVat: number;
  /** Input VAT — VAT on expenses (claimable from SARS). */
  inputVat: number;
  /** outputVat − inputVat. Negative = input/refund, positive = output/payable. */
  netVat: number;
  status: VatStatus;
  count: number;
}

function inPeriod(date: string, period: VatPeriod | null): boolean {
  if (!period) return true;
  return date >= period.start && date <= period.end;
}

/** Aggregate transactions into income/expense + output/input VAT and the net position. */
export function summarizeTransactions(
  transactions: RefundTransaction[],
  period: VatPeriod | null,
): VatSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let outputVat = 0;
  let inputVat = 0;
  let count = 0;

  for (const txn of transactions) {
    if (!inPeriod(txn.date, period)) continue;
    count += 1;
    if (txn.direction === 'income') {
      totalIncome += txn.amount;
      outputVat += txn.vatAmount;
    } else {
      totalExpense += txn.amount;
      inputVat += txn.vatAmount;
    }
  }

  const netVat = round2(outputVat - inputVat);
  const status: VatStatus = netVat < 0 ? 'refundable' : netVat > 0 ? 'payable' : 'nil';

  return {
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    outputVat: round2(outputVat),
    inputVat: round2(inputVat),
    netVat,
    status,
    count,
  };
}

/** Net-VAT label: negative = input/refund, positive = output/payable. */
export function netVatLabel(status: VatStatus): string {
  if (status === 'refundable') return 'Input / Refund';
  if (status === 'payable') return 'Output / Payable';
  return 'Nil';
}

/** Format a number as South African Rand. */
export function formatZar(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
