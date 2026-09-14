/**
 * One rule decides whether the documents step is finished, and both the step
 * and the wizard shell read it. If these drift the user gets an enabled
 * Continue button that fails on click — the behaviour this rule replaced.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPIRY_DAYS,
  documentStepBlocker,
  isValidExpiry,
  type DocumentUploadValue,
} from '../documentStepModel';

const pdf = () => new File(['%PDF-1.7'], 'mandate.pdf', { type: 'application/pdf' });

const ready = (over: Partial<DocumentUploadValue> = {}): DocumentUploadValue => ({
  files: [pdf()],
  title: 'Mandate',
  message: '',
  expiryDays: DEFAULT_EXPIRY_DAYS,
  ...over,
});

describe('documentStepBlocker', () => {
  it('passes a complete step', () => {
    expect(documentStepBlocker(ready())).toBeNull();
  });

  it('asks for a document first', () => {
    expect(documentStepBlocker(ready({ files: [] }))).toMatch(/at least one PDF/i);
  });

  it('asks for a title, treating whitespace as empty', () => {
    expect(documentStepBlocker(ready({ title: '   ' }))).toMatch(/title/i);
  });

  it('rejects an expiry outside 1–365 days, including a cleared field', () => {
    expect(documentStepBlocker(ready({ expiryDays: 0 }))).toMatch(/1 and 365/);
    expect(documentStepBlocker(ready({ expiryDays: 366 }))).toMatch(/1 and 365/);
    expect(documentStepBlocker(ready({ expiryDays: NaN }))).toMatch(/1 and 365/);
  });

  it('reports the missing document before the missing title', () => {
    expect(documentStepBlocker(ready({ files: [], title: '' }))).toMatch(/at least one PDF/i);
  });
});

describe('isValidExpiry', () => {
  it('accepts the inclusive bounds and rejects everything outside them', () => {
    expect(isValidExpiry(1)).toBe(true);
    expect(isValidExpiry(365)).toBe(true);
    expect(isValidExpiry(0)).toBe(false);
    expect(isValidExpiry(366)).toBe(false);
    expect(isValidExpiry(NaN)).toBe(false);
  });
});
