/**
 * The rand-amount mask shared by the four quote wizards.
 * ======================================================
 *
 * Risk, retirement, investment and employee benefits each used to keep a
 * private copy of this. They now re-export the one in amountInput.ts, and
 * the number it returns is what the wizard submits as cover, income and
 * contribution amounts. A copy that drifts, or a "fix" that starts reading
 * a decimal point, changes the figure an adviser receives.
 */
import { describe, expect, it } from 'vitest';
import { formatAmountInput, parseAmountInput } from '../amountInput';
import { formatCurrency as riskFormat, parseCurrencyToNumber as riskParse } from '../../risk/model';
import {
  formatCurrency as retirementFormat,
  parseCurrencyToNumber as retirementParse,
} from '../../retirement/model';
import {
  formatCurrency as investmentFormat,
  parseCurrencyToNumber as investmentParse,
} from '../../investment/model';
import {
  formatCurrency as benefitsFormat,
  parseCurrencyToNumber as benefitsParse,
} from '../../employeeBenefits/model';

describe('formatAmountInput', () => {
  it('groups digits in threes and drops everything else', () => {
    expect(formatAmountInput('1250000')).toBe('1,250,000');
    expect(formatAmountInput('R1 250 000')).toBe('1,250,000');
    expect(formatAmountInput('R 12500')).toBe('12,500');
    expect(formatAmountInput('1,250,000')).toBe('1,250,000');
    expect(formatAmountInput('500')).toBe('500');
    expect(formatAmountInput('5000')).toBe('5,000');
  });

  it('drops a pasted decimal instead of reading cents', () => {
    // The field asks for whole rands. "R1,250.00" is not R1,250: the point
    // is not a decimal, so the two cent digits stay and the amount is
    // 125,000. A currency parser here would submit a different quote.
    expect(formatAmountInput('R1,250.00')).toBe('125,000');
    expect(formatAmountInput('12.5')).toBe('125');
  });

  it('drops a leading minus, so a cover amount cannot go negative', () => {
    expect(formatAmountInput('-2500')).toBe('2,500');
  });

  it('returns empty when the visitor has not typed a digit', () => {
    expect(formatAmountInput('')).toBe('');
    expect(formatAmountInput('R')).toBe('');
    expect(formatAmountInput('abc')).toBe('');
    expect(formatAmountInput('   ')).toBe('');
  });
});

describe('parseAmountInput', () => {
  it('reads the masked field back as a whole-rand integer', () => {
    expect(parseAmountInput('1,250,000')).toBe(1250000);
    expect(parseAmountInput('R 1 250 000')).toBe(1250000);
    expect(parseAmountInput('5,000')).toBe(5000);
    expect(parseAmountInput('0')).toBe(0);
  });

  it('agrees with the mask on a pasted amount that contains cents', () => {
    expect(parseAmountInput(formatAmountInput('R1,250.00'))).toBe(125000);
    expect(parseAmountInput('R1,250.00')).toBe(125000);
  });

  it('is 0 for empty or digit-free input, which the wizards then omit', () => {
    expect(parseAmountInput('')).toBe(0);
    expect(parseAmountInput('R')).toBe(0);
    expect(parseAmountInput('not an amount')).toBe(0);
  });
});

describe('quote wizard re-exports', () => {
  it('all four wizards use this mask, not a private copy', () => {
    for (const format of [riskFormat, retirementFormat, investmentFormat, benefitsFormat]) {
      expect(format).toBe(formatAmountInput);
    }
    for (const parse of [riskParse, retirementParse, investmentParse, benefitsParse]) {
      expect(parse).toBe(parseAmountInput);
    }
  });
});
