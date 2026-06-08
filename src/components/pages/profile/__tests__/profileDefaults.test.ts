import { describe, expect, it } from 'vitest';
import { getInitialProfileData } from '../profileDefaults';

describe('getInitialProfileData', () => {
  it('returns an object with default personal info fields', () => {
    const data = getInitialProfileData();
    expect(data.firstName).toBe('');
    expect(data.lastName).toBe('');
    expect(data.nationality).toBe('South Africa');
  });

  it('uses provided email when supplied', () => {
    const data = getInitialProfileData('user@example.com');
    expect(data.email).toBe('user@example.com');
  });

  it('uses provided firstName and lastName when supplied', () => {
    const data = getInitialProfileData(undefined, 'John', 'Smith');
    expect(data.firstName).toBe('John');
    expect(data.lastName).toBe('Smith');
  });

  it('falls back to empty strings when names are omitted', () => {
    const data = getInitialProfileData();
    expect(data.email).toBe('');
    expect(data.firstName).toBe('');
  });

  it('returns zero numeric defaults for income fields', () => {
    const data = getInitialProfileData();
    expect(data.grossIncome).toBe(0);
    expect(data.netIncome).toBe(0);
  });

  it('returns empty arrays for list fields', () => {
    const data = getInitialProfileData();
    expect(Array.isArray(data.employers)).toBe(true);
    expect(Array.isArray(data.familyMembers)).toBe(true);
    expect(Array.isArray(data.bankAccounts)).toBe(true);
  });

  it('returns a riskAssessment object with question fields initialized to 0', () => {
    const data = getInitialProfileData();
    expect(data.riskAssessment.question1).toBe(0);
    expect(data.riskAssessment.totalScore).toBe(0);
    expect(data.riskAssessment.canRetake).toBe(true);
  });
});
