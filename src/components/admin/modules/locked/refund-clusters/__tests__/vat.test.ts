/**
 * Tests for the pure VAT helpers: inclusive VAT, period derivation (A/B/C),
 * and the income/expense → output/input → net-position summary.
 */

import { describe, expect, it } from 'vitest';
import { currentVatPeriod, netVatLabel, summarizeTransactions, vatFromInclusive } from '../vat';
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
