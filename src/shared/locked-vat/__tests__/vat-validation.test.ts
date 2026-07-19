/**
 * Tests for the SARS evidence validation rules.
 */

import { describe, expect, it } from 'vitest';
import {
  computeTransactionFlags,
  evidenceCompleteness,
  type ValidatableTransaction,
} from '../vat-validation';

const txn = (overrides: Partial<ValidatableTransaction> = {}): ValidatableTransaction => ({
  id: overrides.id ?? 't1',
  direction: 'expense',
  vatTreatment: 'standard',
  amount: 1150,
  vatAmount: 150,
  attachments: [{ kind: 'tax_invoice' }],
  ...overrides,
});

describe('computeTransactionFlags', () => {
  it('passes a fully-evidenced expense', () => {
    const flags = computeTransactionFlags([txn()]);
    expect(flags.t1).toEqual([]);
  });

  it('flags a missing tax invoice on an expense', () => {
    const flags = computeTransactionFlags([txn({ attachments: [] })]);
    expect(flags.t1).toContain('missing_tax_invoice');
  });

  it('flags a missing invoice copy on income', () => {
    const flags = computeTransactionFlags([txn({ direction: 'income', attachments: [] })]);
    expect(flags.t1).toContain('missing_invoice_copy');
    expect(flags.t1).not.toContain('missing_tax_invoice');
  });

  it('requires no document at or below R50', () => {
    const flags = computeTransactionFlags([txn({ amount: 50, vatAmount: 6.52, attachments: [] })]);
    expect(flags.t1).toEqual([]);
  });

  it('flags unverified full invoices above R5,000 and clears when verified', () => {
    const unverified = computeTransactionFlags([txn({ amount: 6000, vatAmount: 782.61 })]);
    expect(unverified.t1).toContain('full_invoice_unverified');
    const verified = computeTransactionFlags([
      txn({
        amount: 6000,
        vatAmount: 782.61,
        attachments: [{ kind: 'tax_invoice', verifiedFull: true }],
      }),
    ]);
    expect(verified.t1).not.toContain('full_invoice_unverified');
  });

  it('does not require full-invoice verification at or below R5,000', () => {
    const flags = computeTransactionFlags([txn({ amount: 5000, vatAmount: 652.17 })]);
    expect(flags.t1).not.toContain('full_invoice_unverified');
  });

  it('flags linked suppliers without a VAT number on file', () => {
    const base = txn({ counterparty: { kind: 'supplier', id: 's1', name: 'Acme' } });
    expect(computeTransactionFlags([base], { supplierVatNumbers: { s1: '' } }).t1).toContain(
      'no_supplier_vat_number',
    );
    expect(
      computeTransactionFlags([base], { supplierVatNumbers: { s1: '4123456789' } }).t1,
    ).not.toContain('no_supplier_vat_number');
  });

  it('flags VAT claimed above the 15/115 maximum', () => {
    const flags = computeTransactionFlags([txn({ amount: 1150, vatAmount: 200 })]);
    expect(flags.t1).toContain('vat_exceeds_rate');
  });

  it('flags duplicate counterparty references across the set', () => {
    const a = txn({
      id: 'a',
      reference: 'INV-9',
      counterparty: { kind: 'supplier', id: 's1', name: 'Acme' },
    });
    const b = txn({
      id: 'b',
      reference: 'inv-9',
      counterparty: { kind: 'supplier', id: 's1', name: 'Acme' },
    });
    const flags = computeTransactionFlags([a, b], { supplierVatNumbers: { s1: '4123456789' } });
    expect(flags.a).toContain('duplicate_reference');
    expect(flags.b).toContain('duplicate_reference');
  });

  it('does not flag the same reference for different counterparties', () => {
    const a = txn({ id: 'a', reference: 'INV-9', counterparty: { kind: 'other', name: 'Alpha' } });
    const b = txn({ id: 'b', reference: 'INV-9', counterparty: { kind: 'other', name: 'Beta' } });
    const flags = computeTransactionFlags([a, b]);
    expect(flags.a).toEqual([]);
    expect(flags.b).toEqual([]);
  });

  it('flags large inputs without proof of payment (configurable threshold)', () => {
    const large = txn({
      amount: 12000,
      vatAmount: 1565.22,
      attachments: [{ kind: 'tax_invoice', verifiedFull: true }],
    });
    expect(computeTransactionFlags([large]).t1).toContain('missing_proof_of_payment');
    const withPop = txn({
      amount: 12000,
      vatAmount: 1565.22,
      attachments: [{ kind: 'tax_invoice', verifiedFull: true }, { kind: 'proof_of_payment' }],
    });
    expect(computeTransactionFlags([withPop]).t1).not.toContain('missing_proof_of_payment');
    expect(computeTransactionFlags([large], { proofOfPaymentThreshold: 20000 }).t1).not.toContain(
      'missing_proof_of_payment',
    );
  });
});

describe('evidenceCompleteness', () => {
  it('is 1 for an empty or fully clean set', () => {
    expect(evidenceCompleteness({})).toBe(1);
    expect(evidenceCompleteness({ a: [], b: [] })).toBe(1);
  });

  it('is the clean share otherwise', () => {
    expect(evidenceCompleteness({ a: [], b: ['missing_tax_invoice'] })).toBe(0.5);
  });
});
