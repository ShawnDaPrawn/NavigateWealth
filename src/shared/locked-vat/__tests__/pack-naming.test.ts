/**
 * Tests for submission-pack evidence file naming.
 */

import { describe, expect, it } from 'vitest';
import { evidenceFileName, sanitizeFragment } from '../pack-naming';

describe('sanitizeFragment', () => {
  it('keeps alphanumerics and collapses everything else to dashes', () => {
    expect(sanitizeFragment('Acme Construction (Pty) Ltd')).toBe('Acme-Construction-Pty-Ltd');
  });

  it('trims, bounds length and never returns empty', () => {
    expect(sanitizeFragment('  ***  ')).toBe('unnamed');
    expect(sanitizeFragment('x'.repeat(100)).length).toBeLessThanOrEqual(40);
  });
});

describe('evidenceFileName', () => {
  const txn = {
    date: '2026-07-15',
    counterparty: { name: 'Acme Construction' },
    reference: 'INV-0042',
    description: 'Site works',
  };

  it('builds the schedule-cross-reference name', () => {
    expect(evidenceFileName(txn, { kind: 'tax_invoice', fileName: 'scan.PDF' })).toBe(
      '2026-07-15_Acme-Construction_INV-0042_tax-invoice.pdf',
    );
  });

  it('falls back to the description without a counterparty', () => {
    expect(
      evidenceFileName(
        { date: '2026-07-15', description: 'Fuel slip' },
        { kind: 'proof_of_payment', fileName: 'pop.jpg' },
      ),
    ).toBe('2026-07-15_Fuel-slip_proof-of-payment.jpg');
  });

  it('adds a numeric suffix for duplicates', () => {
    expect(evidenceFileName(txn, { kind: 'tax_invoice', fileName: 'scan.pdf' }, 2)).toBe(
      '2026-07-15_Acme-Construction_INV-0042_tax-invoice.2.pdf',
    );
  });
});
