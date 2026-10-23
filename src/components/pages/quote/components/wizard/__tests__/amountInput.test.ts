import { describe, it, expect } from 'vitest';
import { formatAmountInput, parseAmountInput } from '../amountInput';

describe('formatAmountInput', () => {
  it('groups the rands in threes and drops anything that is not part of the amount', () => {
    expect(formatAmountInput('1250000')).toBe('1,250,000');
    expect(formatAmountInput('R 12500')).toBe('12,500');
    expect(formatAmountInput('')).toBe('');
  });

  it('drops leading zeros', () => {
    expect(formatAmountInput('0265')).toBe('265');
  });

  it('keeps up to two decimals as a finished amount', () => {
    expect(formatAmountInput('45000.5')).toBe('45,000.50');
    expect(formatAmountInput('45000.567')).toBe('45,000.56');
    expect(formatAmountInput('45000.')).toBe('45,000');
  });
});

describe('parseAmountInput', () => {
  it('reads a stored amount, cents included', () => {
    expect(parseAmountInput('45,000')).toBe(45000);
    expect(parseAmountInput('45,000.50')).toBe(45000.5);
    expect(parseAmountInput('R 1 250 000')).toBe(1250000);
  });

  it('is 0 when there is no amount', () => {
    expect(parseAmountInput('')).toBe(0);
    expect(parseAmountInput('abc')).toBe(0);
  });
});
