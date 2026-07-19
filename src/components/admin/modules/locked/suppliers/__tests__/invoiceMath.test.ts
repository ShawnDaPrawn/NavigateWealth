/**
 * Tests for the VAT-exclusive invoice line math and template-driven
 * formatting. The totals must stay in lockstep with the server's
 * computeInvoiceTotals in suppliers-service.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  computeInvoiceTotals,
  formatTemplateCurrency,
  formatTemplateDate,
  lineNet,
  lineTotal,
  lineVat,
} from '../invoiceMath';
import type { InvoiceLineItem } from '../types';

const line = (overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem => ({
  description: 'Services',
  quantity: 1,
  unitPrice: 100,
  vatTreatment: 'standard',
  ...overrides,
});

describe('line math', () => {
  it('computes net, VAT and gross for a standard-rated line', () => {
    const l = line({ quantity: 3, unitPrice: 150 });
    expect(lineNet(l)).toBe(450);
    expect(lineVat(l)).toBe(67.5);
    expect(lineTotal(l)).toBe(517.5);
  });

  it('charges no VAT on zero-rated and exempt lines', () => {
    expect(lineVat(line({ vatTreatment: 'zero_rated' }))).toBe(0);
    expect(lineVat(line({ vatTreatment: 'exempt' }))).toBe(0);
    expect(lineTotal(line({ vatTreatment: 'exempt' }))).toBe(100);
  });

  it('rounds per line before summing (parity with vat.ts round2)', () => {
    // 3 × 33.335 = 100.005 → rounds to 100.01 net; VAT 15.00 (100.01 * .15 = 15.0015 → 15.00)
    const l = line({ quantity: 3, unitPrice: 33.335 });
    expect(lineNet(l)).toBe(100.01);
    expect(lineVat(l)).toBe(15);
  });
});

describe('computeInvoiceTotals', () => {
  it('sums mixed treatments correctly', () => {
    const totals = computeInvoiceTotals([
      line({ quantity: 2, unitPrice: 500 }), // 1000 net, 150 VAT
      line({ quantity: 1, unitPrice: 200, vatTreatment: 'zero_rated' }), // 200 net, 0 VAT
      line({ quantity: 4, unitPrice: 25, vatTreatment: 'exempt' }), // 100 net, 0 VAT
    ]);
    expect(totals).toEqual({ subtotal: 1300, vatAmount: 150, total: 1450 });
  });

  it('handles the empty list', () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotal: 0, vatAmount: 0, total: 0 });
  });
});

describe('formatTemplateCurrency', () => {
  it('formats the SA space-comma style', () => {
    expect(formatTemplateCurrency(1234.5, 'R1 234,56')).toBe('R1 234,50');
    expect(formatTemplateCurrency(1234567.89, 'R1 234,56')).toBe('R1 234 567,89');
  });

  it('formats the comma-dot style', () => {
    expect(formatTemplateCurrency(1234.5, 'R 1,234.56')).toBe('R 1,234.50');
  });

  it('formats the ZAR style and negatives', () => {
    expect(formatTemplateCurrency(-987.65, 'ZAR 1 234.56')).toBe('-ZAR 987.65');
  });
});

describe('formatTemplateDate', () => {
  it('formats each supported style', () => {
    expect(formatTemplateDate('2026-07-19', 'yyyy/MM/dd')).toBe('2026/07/19');
    expect(formatTemplateDate('2026-07-19', 'dd MMM yyyy')).toBe('19 Jul 2026');
    expect(formatTemplateDate('2026-07-19', 'dd/MM/yyyy')).toBe('19/07/2026');
    expect(formatTemplateDate('2026-07-19', 'yyyy-MM-dd')).toBe('2026-07-19');
  });

  it('passes through non-ISO input untouched', () => {
    expect(formatTemplateDate('19 July', 'dd MMM yyyy')).toBe('19 July');
  });
});
