import { describe, expect, it } from 'vitest';
import { WIZARD_STEPS, TAX_YEAR_2026_2027, TAX_YEAR_2024_2025 } from '../constants';

describe('tax-planning-fna/constants', () => {
  it('WIZARD_STEPS has 4 steps', () => {
    expect(WIZARD_STEPS.length).toBe(4);
  });

  it('WIZARD_STEPS steps are numbered 1–4', () => {
    WIZARD_STEPS.forEach((s, i) => {
      expect(s.step).toBe(i + 1);
    });
  });

  it('each wizard step has a title and description', () => {
    WIZARD_STEPS.forEach((s) => {
      expect(typeof s.title).toBe('string');
      expect(typeof s.description).toBe('string');
    });
  });

  it('TAX_YEAR_2026_2027 has required tax constants', () => {
    expect(TAX_YEAR_2026_2027.RA_DEDUCTION_RATE).toBe(0.275);
    expect(TAX_YEAR_2026_2027.CGT_INCLUSION_RATE_INDIVIDUAL).toBe(0.4);
    expect(TAX_YEAR_2026_2027.INTEREST_EXEMPTION_UNDER_65).toBeGreaterThan(0);
  });

  it('TAX_YEAR_2026_2027 RA_ANNUAL_CAP is higher than 2024_2025', () => {
    expect(TAX_YEAR_2026_2027.RA_ANNUAL_CAP).toBeGreaterThan(TAX_YEAR_2024_2025.RA_ANNUAL_CAP);
  });

  it('TAX_YEAR_2024_2025 is defined as fallback', () => {
    expect(TAX_YEAR_2024_2025).toBeDefined();
    expect(TAX_YEAR_2024_2025.DIVIDEND_WITHHOLDING_RATE).toBe(0.2);
  });
});
