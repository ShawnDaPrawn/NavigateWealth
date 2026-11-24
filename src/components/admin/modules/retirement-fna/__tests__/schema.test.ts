import { describe, expect, it } from 'vitest';
import { RetirementFNAInputSchema, RetirementFNAAdjustmentsSchema } from '../schema';

const validInput = {
  currentAge: 35,
  retirementAge: 65,
  currentMonthlyIncome: 50000,
  currentMonthlyContribution: 5000,
  currentRetirementSavings: 200000,
};

describe('RetirementFNAInputSchema', () => {
  it('accepts valid retirement FNA input', () => {
    const result = RetirementFNAInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects currentAge below 18', () => {
    const result = RetirementFNAInputSchema.safeParse({ ...validInput, currentAge: 17 });
    expect(result.success).toBe(false);
  });

  it('rejects retirementAge below 40', () => {
    const result = RetirementFNAInputSchema.safeParse({ ...validInput, retirementAge: 39 });
    expect(result.success).toBe(false);
  });

  it('rejects retirementAge <= currentAge', () => {
    const result = RetirementFNAInputSchema.safeParse({
      ...validInput,
      currentAge: 55,
      retirementAge: 55,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero monthly income', () => {
    const result = RetirementFNAInputSchema.safeParse({ ...validInput, currentMonthlyIncome: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts zero net income when gross income is given', () => {
    const result = RetirementFNAInputSchema.safeParse({
      ...validInput,
      currentMonthlyIncome: 0,
      currentGrossMonthlyIncome: 70000,
    });
    expect(result.success).toBe(true);
  });

  it('requires the client age', () => {
    const { currentAge: _omit, ...noAge } = validInput;
    const result = RetirementFNAInputSchema.safeParse(noAge);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/current age is required/);
  });

  it('rejects negative other provision', () => {
    const result = RetirementFNAInputSchema.safeParse({
      ...validInput,
      otherMonthlyRetirementIncome: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero monthly contribution', () => {
    const result = RetirementFNAInputSchema.safeParse({
      ...validInput,
      currentMonthlyContribution: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('RetirementFNAAdjustmentsSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = RetirementFNAAdjustmentsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid adjustment values', () => {
    const result = RetirementFNAAdjustmentsSchema.safeParse({
      retirementAge: 65,
      replacementRatio: 0.75,
      inflationRate: 0.06,
      adviserNotes: 'Some notes',
    });
    expect(result.success).toBe(true);
  });

  it('rejects inflationRate above 0.2', () => {
    const result = RetirementFNAAdjustmentsSchema.safeParse({ inflationRate: 0.5 });
    expect(result.success).toBe(false);
  });
});
