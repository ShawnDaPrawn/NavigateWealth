/**
 * profileHandlers — unit tests (Phase 4 coverage push).
 *
 * Entity factory creators (bank account / family member / asset / liability /
 * chronic condition / employer / identity document), the risk-assessment
 * scoring, net-worth totals, and the profile file-upload validator. All pure.
 */
import { describe, expect, it } from 'vitest';
import {
  createBankAccount,
  createFamilyMember,
  createAsset,
  createLiability,
  createChronicCondition,
  createEmployer,
  createIdentityDocument,
  calculateRiskAssessment,
  calculateTotals,
  validateFileUpload,
} from '../profileHandlers';
import type { ProfileData } from '../types';

describe('entity factories', () => {
  it('createBankAccount has the expected defaults', () => {
    expect(createBankAccount()).toMatchObject({
      accountHolderName: '',
      bankName: '',
      accountType: 'checking',
      isPrimary: false,
    });
  });
  it('createFamilyMember / createAsset / createLiability / createChronicCondition / createEmployer default empty', () => {
    expect(createFamilyMember()).toMatchObject({ fullName: '', isFinanciallyDependent: false });
    expect(createAsset()).toMatchObject({ name: '', value: 0 });
    expect(createLiability()).toMatchObject({
      outstandingBalance: 0,
      monthlyPayment: 0,
      interestRate: 0,
    });
    expect(createChronicCondition()).toMatchObject({ conditionName: '', onTreatment: false });
    expect(createEmployer()).toMatchObject({ jobTitle: '', employerName: '', industry: '' });
  });
  it('createIdentityDocument stamps file metadata only when a file is given', () => {
    const withFile = createIdentityDocument('passport', 'doc.pdf', 1024);
    expect(withFile).toMatchObject({
      type: 'passport',
      countryOfIssue: 'South Africa',
      fileName: 'doc.pdf',
      fileSize: 1024,
      isVerified: false,
    });
    expect(typeof withFile.uploadDate).toBe('string');

    const noFile = createIdentityDocument('national-id');
    expect(noFile.fileName).toBeUndefined();
    expect(noFile.uploadDate).toBeUndefined();
  });
});

describe('calculateRiskAssessment', () => {
  it('categorizes complete assessments', () => {
    expect(calculateRiskAssessment(Array(10).fill(1))).toMatchObject({
      totalScore: 10,
      riskCategory: 'Conservative',
      canRetake: true,
    });
    expect(calculateRiskAssessment(Array(10).fill(2)).riskCategory).toBe('Moderate');
    expect(calculateRiskAssessment(Array(10).fill(3)).riskCategory).toBe('Aggressive');
  });
  it('leaves category blank for incomplete assessments', () => {
    const res = calculateRiskAssessment([1, 2, 3]); // only 3 answers
    expect(res.riskCategory).toBe('');
    expect(res.canRetake).toBe(false);
    expect(res.dateCompleted).toBe('');
  });
});

describe('calculateTotals', () => {
  it('sums assets/liabilities into net worth', () => {
    const data = {
      assets: [{ value: 1000 }, { value: 500 }],
      liabilities: [{ outstandingBalance: 300 }],
    } as unknown as ProfileData;
    expect(calculateTotals(data)).toEqual({
      totalAssets: 1500,
      totalLiabilities: 300,
      netWorth: 1200,
    });
  });
});

describe('validateFileUpload', () => {
  it('accepts an allowed file under 5MB', () => {
    expect(validateFileUpload(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toEqual({
      valid: true,
    });
  });
  it('rejects oversized files', () => {
    const f = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(f, 'size', { value: 6 * 1024 * 1024 });
    expect(validateFileUpload(f).valid).toBe(false);
  });
  it('rejects disallowed types', () => {
    expect(validateFileUpload(new File(['x'], 'a.txt', { type: 'text/plain' })).valid).toBe(false);
  });
});
