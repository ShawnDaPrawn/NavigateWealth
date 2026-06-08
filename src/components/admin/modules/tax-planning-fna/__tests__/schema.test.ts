import { describe, expect, it } from 'vitest';
import { TaxPlanningInputSchema, AdjustmentLogSchema } from '../schema';

const validInput = {
  age: 40,
  maritalStatus: 'single',
  taxResidency: 'resident',
  numberOfDependants: 0,
  employmentIncome: 500000,
  variableIncome: 0,
  businessIncome: 0,
  rentalIncome: 0,
  interestIncome: 10000,
  dividendIncome: 0,
  foreignIncome: 0,
  capitalGainsRealised: 0,
  raContributions: 50000,
  tfsaContributionsLifetime: 100000,
  medicalSchemeMembers: 2,
};

describe('TaxPlanningInputSchema', () => {
  it('accepts valid tax planning input', () => {
    const result = TaxPlanningInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects age below 18', () => {
    const result = TaxPlanningInputSchema.safeParse({ ...validInput, age: 17 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid marital status', () => {
    const result = TaxPlanningInputSchema.safeParse({ ...validInput, maritalStatus: 'other' });
    expect(result.success).toBe(false);
  });

  it('rejects TFSA lifetime contributions above 500000', () => {
    const result = TaxPlanningInputSchema.safeParse({
      ...validInput,
      tfsaContributionsLifetime: 600000,
    });
    expect(result.success).toBe(false);
  });

  it('accepts married_in_community marital status', () => {
    const result = TaxPlanningInputSchema.safeParse({
      ...validInput,
      maritalStatus: 'married_in_community',
    });
    expect(result.success).toBe(true);
  });
});

describe('AdjustmentLogSchema', () => {
  it('accepts a valid adjustment log entry', () => {
    const result = AdjustmentLogSchema.safeParse({
      id: 'adj-1',
      field: 'employmentIncome',
      originalValue: 500000,
      newValue: 600000,
      reason: 'Client provided updated payslip',
      timestamp: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects reason shorter than 5 characters', () => {
    const result = AdjustmentLogSchema.safeParse({
      id: 'adj-1',
      field: 'x',
      originalValue: 0,
      newValue: 1,
      reason: 'no',
      timestamp: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
