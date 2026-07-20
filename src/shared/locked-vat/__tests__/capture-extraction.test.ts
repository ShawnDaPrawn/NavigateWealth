/**
 * Tests for the AI invoice-capture normalization and supplier matching.
 */

import { describe, expect, it } from 'vitest';
import { matchSupplier, normalizeCaptureExtraction } from '../capture-extraction';

describe('normalizeCaptureExtraction', () => {
  it('cleans a well-formed extraction', () => {
    const draft = normalizeCaptureExtraction({
      supplierName: '  Acme Construction (Pty) Ltd  ',
      supplierVatNumber: '4 123 456 789',
      invoiceNumber: 'INV-0042',
      invoiceDate: '2026-07-15',
      total: 1150,
      vatAmount: 150,
      description: 'Site works',
      confidence: 0.92,
      notes: '',
    });
    expect(draft.supplierName).toBe('Acme Construction (Pty) Ltd');
    expect(draft.supplierVatNumber).toBe('4123456789');
    expect(draft.vatTreatment).toBe('standard');
    expect(draft.confidence).toBe(0.92);
    expect(draft.notes).toBe('');
  });

  it('tolerates garbage input', () => {
    const draft = normalizeCaptureExtraction(null);
    expect(draft.total).toBe(0);
    expect(draft.vatTreatment).toBe('zero_rated');
    expect(draft.invoiceDate).toBe('');
  });

  it('parses numeric strings and rejects invalid dates', () => {
    const draft = normalizeCaptureExtraction({
      total: 'R1 150,00'.replace(',', '.'), // "R1 150.00"
      vatAmount: '150.00',
      invoiceDate: '15/07/2026',
    });
    expect(draft.total).toBe(1150);
    expect(draft.vatAmount).toBe(150);
    expect(draft.invoiceDate).toBe('');
  });

  it('clamps VAT above the 15/115 maximum and notes it', () => {
    const draft = normalizeCaptureExtraction({ total: 1150, vatAmount: 400 });
    expect(draft.vatAmount).toBe(150);
    expect(draft.notes).toMatch(/clamped/);
  });

  it('notes a VAT/total mismatch suggesting partial zero-rating', () => {
    const draft = normalizeCaptureExtraction({ total: 2300, vatAmount: 150 });
    expect(draft.vatAmount).toBe(150);
    expect(draft.notes).toMatch(/does not match 15%/);
  });

  it('infers zero-rated when no VAT was charged', () => {
    expect(normalizeCaptureExtraction({ total: 500, vatAmount: 0 }).vatTreatment).toBe(
      'zero_rated',
    );
  });
});

describe('matchSupplier', () => {
  const suppliers = [
    { id: 's1', name: 'Acme Construction (Pty) Ltd', vatNumber: '4123456789' },
    { id: 's2', name: 'Bright Cleaning Services', vatNumber: '4987654321' },
  ];

  it('matches by exact VAT number first', () => {
    expect(
      matchSupplier(
        { supplierName: 'Totally Different', supplierVatNumber: '4123456789' },
        suppliers,
      )?.id,
    ).toBe('s1');
  });

  it('falls back to name containment either way', () => {
    expect(
      matchSupplier({ supplierName: 'acme construction', supplierVatNumber: '' }, suppliers)?.id,
    ).toBe('s1');
    expect(
      matchSupplier(
        { supplierName: 'Bright Cleaning Services JHB Branch', supplierVatNumber: '' },
        suppliers,
      )?.id,
    ).toBe('s2');
  });

  it('returns null for short or unknown names', () => {
    expect(matchSupplier({ supplierName: 'AC', supplierVatNumber: '' }, suppliers)).toBeNull();
    expect(
      matchSupplier({ supplierName: 'Unknown Vendor', supplierVatNumber: '' }, suppliers),
    ).toBeNull();
  });
});
