/**
 * Tests for VAT201 field mapping and the refund payout clock.
 */

import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  businessDaysBetween,
  computeVat201,
  isLockedStatus,
  periodKey,
  refundClock,
  vat201Rows,
  type Vat201Transaction,
} from '../vat201';

const income = (
  amount: number,
  vatAmount: number,
  treatment: Vat201Transaction['vatTreatment'] = 'standard',
): Vat201Transaction => ({
  direction: 'income',
  vatTreatment: treatment,
  amount,
  vatAmount,
});

const expense = (amount: number, vatAmount: number, category?: string): Vat201Transaction => ({
  direction: 'expense',
  vatTreatment: 'standard',
  amount,
  vatAmount,
  category,
});

describe('computeVat201', () => {
  it('maps a mixed ledger onto the field lines', () => {
    const fields = computeVat201([
      income(1150, 150), // field 1: 1000 excl · field 13: 150
      income(500, 0, 'zero_rated'), // field 2
      income(200, 0, 'exempt'), // field 3
      expense(2300, 300, 'materials'), // field 15
      expense(11500, 1500, 'equipment_capital'), // field 14
    ]);
    expect(fields.standardRatedSuppliesExcl).toBe(1000);
    expect(fields.zeroRatedSupplies).toBe(500);
    expect(fields.exemptSupplies).toBe(200);
    expect(fields.totalOutputTax).toBe(150);
    expect(fields.inputTaxCapitalGoods).toBe(1500);
    expect(fields.inputTaxOtherGoods).toBe(300);
    expect(fields.totalInputTax).toBe(1800);
    expect(fields.netVat).toBe(-1650); // refund position
  });

  it('ignores zero-VAT expenses and handles the empty ledger', () => {
    expect(computeVat201([]).netVat).toBe(0);
    const fields = computeVat201([expense(100, 0)]);
    expect(fields.totalInputTax).toBe(0);
  });

  it('lists rows with SARS field numbers in transcription order', () => {
    const rows = vat201Rows(computeVat201([income(1150, 150)]));
    expect(rows.map((r) => r.field)).toEqual(['1', '2', '3', '13', '14', '15', '19']);
    expect(rows[0].value).toBe(1000);
  });
});

describe('submission lifecycle', () => {
  it('locks every status except open/undefined', () => {
    expect(isLockedStatus(undefined)).toBe(false);
    expect(isLockedStatus('open')).toBe(false);
    expect(isLockedStatus('submitted')).toBe(true);
    expect(isLockedStatus('verification')).toBe(true);
    expect(isLockedStatus('refund_received')).toBe(true);
    expect(isLockedStatus('closed')).toBe(true);
  });

  it('builds a stable period key', () => {
    expect(periodKey('2026-06-01', '2026-07-31')).toBe('2026-06-01_2026-07-31');
  });
});

describe('refund clock', () => {
  it('adds business days skipping weekends', () => {
    // 2026-07-17 is a Friday: +1 business day → Monday 2026-07-20.
    expect(addBusinessDays('2026-07-17', 1)).toBe('2026-07-20');
    expect(addBusinessDays('2026-07-17', 5)).toBe('2026-07-24');
  });

  it('counts business days between dates', () => {
    expect(businessDaysBetween('2026-07-17', '2026-07-17')).toBe(0);
    expect(businessDaysBetween('2026-07-17', '2026-07-20')).toBe(1); // Sat+Sun skipped
    expect(businessDaysBetween('2026-07-13', '2026-07-17')).toBe(4); // Mon → Fri
  });

  it('computes the 21-business-day payout deadline and overdue state', () => {
    const clock = refundClock('2026-07-01', '2026-07-19');
    expect(clock.expectedBy).toBe('2026-07-30'); // Wed 1 Jul + 21 business days
    expect(clock.overdue).toBe(false);
    expect(refundClock('2026-06-01', '2026-07-19').overdue).toBe(true);
  });
});
