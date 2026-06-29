/**
 * Tests for the pure VAT helpers: inclusive VAT, period derivation (A/B/C),
 * and the income/expense → output/input → net-position summary.
 */

import { describe, expect, it } from 'vitest';
import {
  currentVatPeriod,
  dueDateBucket,
  formatIsoDate,
  formatPeriodRange,
  netVatLabel,
  previousVatPeriod,
  recentVatPeriods,
  summarizeTransactions,
  vatFromInclusive,
  vatSubmissionDueDate,
} from '../vat';
import type { RefundTransaction } from '../types';

function txn(overrides: Partial<RefundTransaction>): RefundTransaction {
  return {
    id: Math.random().toString(36).slice(2),
    entityId: 'e1',
    clusterId: 'c1',
    date: '2026-03-15',
    description: '',
    direction: 'expense',
    vatTreatment: 'standard',
    amount: 0,
    vatAmount: 0,
    vatOverridden: false,
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-15T00:00:00.000Z',
    createdBy: 'u1',
    ...overrides,
  };
}

describe('previousVatPeriod', () => {
  it('returns null when no category is set', () => {
    expect(previousVatPeriod('', new Date(2026, 2, 15))).toBeNull();
  });

  it('category C steps back one calendar month', () => {
    const p = previousVatPeriod('C', new Date(2026, 2, 15)); // March → Feb
    expect(p?.start).toBe('2026-02-01');
    expect(p?.end).toBe('2026-02-28');
  });

  it('category C wraps to the prior year from January', () => {
    const p = previousVatPeriod('C', new Date(2026, 0, 10)); // Jan 2026 → Dec 2025
    expect(p?.start).toBe('2025-12-01');
    expect(p?.end).toBe('2025-12-31');
  });

  it('category A steps back a two-month window', () => {
    // Current for March is Feb–Mar; previous is Dec–Jan.
    const p = previousVatPeriod('A', new Date(2026, 2, 15));
    expect(p?.start).toBe('2025-12-01');
    expect(p?.end).toBe('2026-01-31');
  });

  it('category B steps back a two-month window', () => {
    // Current for March is Mar–Apr; previous is Jan–Feb.
    const p = previousVatPeriod('B', new Date(2026, 2, 15));
    expect(p?.start).toBe('2026-01-01');
    expect(p?.end).toBe('2026-02-28');
  });
});

describe('recentVatPeriods', () => {
  it('returns an empty list when no category is set', () => {
    expect(recentVatPeriods('', 6, new Date(2026, 2, 15))).toEqual([]);
  });

  it('returns the current period first, then prior periods, without gaps', () => {
    const periods = recentVatPeriods('C', 3, new Date(2026, 2, 15)); // Mar, Feb, Jan 2026
    expect(periods).toHaveLength(3);
    expect(periods[0].start).toBe('2026-03-01');
    expect(periods[1].start).toBe('2026-02-01');
    expect(periods[2].start).toBe('2026-01-01');
  });
});

describe('formatPeriodRange', () => {
  it('renders the label plus the inclusive date range', () => {
    const p = currentVatPeriod('C', new Date(2026, 1, 15))!; // Feb 2026
    expect(formatPeriodRange(p)).toBe('Feb 2026 (1 Feb 2026 – 28 Feb 2026)');
  });
});

describe('formatIsoDate', () => {
  it('renders an ISO date as day + short month + year', () => {
    expect(formatIsoDate('2026-07-31')).toBe('31 Jul 2026');
    expect(formatIsoDate('2026-01-01')).toBe('1 Jan 2026');
  });
});

describe('vatSubmissionDueDate', () => {
  it('is the last day of the month after the period end when that is a weekday', () => {
    const feb = currentVatPeriod('C', new Date(2026, 1, 15))!; // Feb 2026
    expect(vatSubmissionDueDate(feb)).toBe('2026-03-31'); // 31 Mar 2026 is a Tuesday

    const febMar = currentVatPeriod('A', new Date(2026, 2, 15))!; // Feb–Mar 2026
    expect(vatSubmissionDueDate(febMar)).toBe('2026-04-30'); // 30 Apr 2026 is a Thursday
  });

  it('rolls back off a weekend month-end to the prior weekday', () => {
    const decJan = currentVatPeriod('A', new Date(2026, 11, 20))!; // Dec 2026 – Jan 2027
    // Following month is Feb 2027; 28 Feb 2027 is a Sunday → 26 Feb (Friday).
    expect(vatSubmissionDueDate(decJan)).toBe('2027-02-26');
  });
});

describe('dueDateBucket', () => {
  const ref = new Date(2026, 5, 15); // 15 Jun 2026

  it('flags a date before today as overdue', () => {
    expect(dueDateBucket('2026-06-14', ref)).toBe('overdue');
    expect(dueDateBucket('2026-05-31', ref)).toBe('overdue');
  });

  it('flags a remaining date this calendar month as this-month', () => {
    expect(dueDateBucket('2026-06-30', ref)).toBe('this-month');
    expect(dueDateBucket('2026-06-15', ref)).toBe('this-month'); // today counts
  });

  it('flags the following calendar month as next-month', () => {
    expect(dueDateBucket('2026-07-31', ref)).toBe('next-month');
  });

  it('flags anything further out as later', () => {
    expect(dueDateBucket('2026-08-31', ref)).toBe('later');
  });

  it('wraps the year for a December reference', () => {
    const dec = new Date(2026, 11, 10); // 10 Dec 2026
    expect(dueDateBucket('2027-01-31', dec)).toBe('next-month');
  });
});

describe('vatFromInclusive', () => {
  it('extracts 15/115 of a standard-rated amount', () => {
    expect(vatFromInclusive(115, 'standard')).toBe(15);
    expect(vatFromInclusive(1150, 'standard')).toBe(150);
  });

  it('returns 0 for zero-rated and exempt', () => {
    expect(vatFromInclusive(115, 'zero_rated')).toBe(0);
    expect(vatFromInclusive(115, 'exempt')).toBe(0);
  });

  it('returns 0 for non-positive amounts', () => {
    expect(vatFromInclusive(0, 'standard')).toBe(0);
    expect(vatFromInclusive(-100, 'standard')).toBe(0);
  });
});

describe('currentVatPeriod', () => {
  it('returns null when no category is set', () => {
    expect(currentVatPeriod('')).toBeNull();
  });

  it('category C is the calendar month', () => {
    const p = currentVatPeriod('C', new Date(2026, 1, 15)); // Feb 2026
    expect(p).toEqual({ start: '2026-02-01', end: '2026-02-28', label: 'Feb 2026' });
  });

  it('category A ends in an odd month (Feb-Mar window for March)', () => {
    const p = currentVatPeriod('A', new Date(2026, 2, 15)); // March
    expect(p?.start).toBe('2026-02-01');
    expect(p?.end).toBe('2026-03-31');
  });

  it('category A wraps the year (Dec-Jan)', () => {
    const p = currentVatPeriod('A', new Date(2026, 11, 20)); // December
    expect(p?.start).toBe('2026-12-01');
    expect(p?.end).toBe('2027-01-31');
  });

  it('category B ends in an even month (Mar-Apr window for March)', () => {
    const p = currentVatPeriod('B', new Date(2026, 2, 15)); // March
    expect(p?.start).toBe('2026-03-01');
    expect(p?.end).toBe('2026-04-30');
  });

  it('category B for February is the Jan-Feb window', () => {
    const p = currentVatPeriod('B', new Date(2026, 1, 10)); // February
    expect(p?.start).toBe('2026-01-01');
    expect(p?.end).toBe('2026-02-28');
  });
});

describe('summarizeTransactions', () => {
  const period = currentVatPeriod('A', new Date(2026, 2, 15)); // Feb-Mar 2026

  it('nets output (income) minus input (expense) VAT', () => {
    const summary = summarizeTransactions(
      [
        txn({ direction: 'income', amount: 1150, vatAmount: 150, date: '2026-03-01' }),
        txn({ direction: 'expense', amount: 2300, vatAmount: 300, date: '2026-03-02' }),
      ],
      period,
    );
    expect(summary.outputVat).toBe(150);
    expect(summary.inputVat).toBe(300);
    expect(summary.netVat).toBe(-150);
    expect(summary.status).toBe('refundable'); // negative = input/refund
    expect(summary.totalIncome).toBe(1150);
    expect(summary.totalExpense).toBe(2300);
    expect(summary.count).toBe(2);
  });

  it('reports a payable (output) position when output exceeds input', () => {
    const summary = summarizeTransactions(
      [
        txn({ direction: 'income', amount: 2300, vatAmount: 300, date: '2026-03-01' }),
        txn({ direction: 'expense', amount: 1150, vatAmount: 150, date: '2026-03-02' }),
      ],
      period,
    );
    expect(summary.netVat).toBe(150);
    expect(summary.status).toBe('payable'); // positive = output/payable
  });

  it('excludes transactions outside the period', () => {
    const summary = summarizeTransactions(
      [
        txn({ direction: 'expense', amount: 1150, vatAmount: 150, date: '2026-03-10' }),
        txn({ direction: 'expense', amount: 1150, vatAmount: 150, date: '2026-01-10' }),
      ],
      period,
    );
    expect(summary.count).toBe(1);
    expect(summary.inputVat).toBe(150);
  });

  it('counts everything when there is no period', () => {
    const summary = summarizeTransactions(
      [
        txn({ direction: 'expense', amount: 1150, vatAmount: 150, date: '2020-01-01' }),
        txn({ direction: 'income', amount: 1150, vatAmount: 150, date: '2030-01-01' }),
      ],
      null,
    );
    expect(summary.count).toBe(2);
    expect(summary.netVat).toBe(0);
    expect(summary.status).toBe('nil');
  });
});

describe('netVatLabel', () => {
  it('labels the position by sign', () => {
    expect(netVatLabel('refundable')).toBe('Input / Refund');
    expect(netVatLabel('payable')).toBe('Output / Payable');
    expect(netVatLabel('nil')).toBe('Nil');
  });
});
