import { describe, expect, it } from 'vitest';
import {
  caretAfterAmountCharacters,
  cleanCurrencyInput,
  countAmountCharacters,
  finishTypedAmount,
  formatAmountWhileTyping,
  formatStoredAmount,
  parseTypedAmount,
  formatCurrency,
  formatCurrencyDisplay,
  formatCurrencyInput,
  formatCurrencyWhole,
  parseCurrency,
} from '../currencyFormatter';

describe('formatCurrency', () => {
  it('formats with thousand separators and 2 decimals', () => {
    expect(formatCurrency(1234567.89)).toBe('R1,234,567.89');
    expect(formatCurrency(0)).toBe('R0.00');
    expect(formatCurrency(1234.5)).toBe('R1,234.50');
  });

  it('prefixes a minus sign for negatives', () => {
    expect(formatCurrency(-1234.5)).toBe('-R1,234.50');
  });

  it('returns R0.00 for NaN / null / undefined', () => {
    expect(formatCurrency(NaN)).toBe('R0.00');
    expect(formatCurrency(undefined as unknown as number)).toBe('R0.00');
    expect(formatCurrency(null as unknown as number)).toBe('R0.00');
  });
});

describe('formatCurrencyWhole', () => {
  it('rounds to whole rands with separators and no decimals', () => {
    expect(formatCurrencyWhole(1234567)).toBe('R1,234,567');
    expect(formatCurrencyWhole(1234.6)).toBe('R1,235');
    expect(formatCurrencyWhole(-1000)).toBe('-R1,000');
  });

  it('returns R0 for invalid input', () => {
    expect(formatCurrencyWhole(NaN)).toBe('R0');
  });
});

describe('parseCurrency', () => {
  it('strips R, spaces and commas', () => {
    expect(parseCurrency('R1,234.56')).toBeCloseTo(1234.56, 2);
    expect(parseCurrency('1 234.56')).toBeCloseTo(1234.56, 2);
    expect(parseCurrency('1234')).toBe(1234);
  });

  it('passes numbers through and guards NaN/empty/nullish', () => {
    expect(parseCurrency(42)).toBe(42);
    expect(parseCurrency(NaN)).toBe(0);
    expect(parseCurrency('')).toBe(0);
    expect(parseCurrency(undefined)).toBe(0);
    expect(parseCurrency(null)).toBe(0);
    expect(parseCurrency('not money')).toBe(0);
  });
});

describe('formatCurrencyDisplay', () => {
  it('formats without the R prefix and blanks zero/empty', () => {
    expect(formatCurrencyDisplay(1234567.89)).toBe('1,234,567.89');
    expect(formatCurrencyDisplay('1234.5')).toBe('1,234.50');
    expect(formatCurrencyDisplay(0)).toBe('');
    expect(formatCurrencyDisplay(undefined)).toBe('');
    expect(formatCurrencyDisplay('abc')).toBe('');
  });
});

describe('formatCurrencyInput', () => {
  it('adds separators and clamps to 2 decimals', () => {
    expect(formatCurrencyInput('1234567.89')).toBe('1,234,567.89');
    expect(formatCurrencyInput('1234')).toBe('1,234');
    expect(formatCurrencyInput('1.999')).toBe('1.99');
    expect(formatCurrencyInput(1234)).toBe('1,234');
  });

  it('keeps only the first decimal point and supports a trailing dot', () => {
    expect(formatCurrencyInput('1.2.3')).toBe('1.23');
    expect(formatCurrencyInput('1234.')).toBe('1,234.');
  });

  it('returns empty string for empty/nullish input', () => {
    expect(formatCurrencyInput('')).toBe('');
    expect(formatCurrencyInput(undefined)).toBe('');
    expect(formatCurrencyInput(null)).toBe('');
  });
});

describe('cleanCurrencyInput', () => {
  it('strips formatting to a parseable numeric string', () => {
    expect(cleanCurrencyInput('1,234,567.89')).toBe('1234567.89');
    expect(cleanCurrencyInput(1234.56)).toBe('1234.56');
  });

  it('returns "0" for empty/nullish input', () => {
    expect(cleanCurrencyInput('')).toBe('0');
    expect(cleanCurrencyInput(undefined)).toBe('0');
    expect(cleanCurrencyInput(null)).toBe('0');
  });
});

describe('formatAmountWhileTyping', () => {
  it('puts a comma between every three digits of the rands', () => {
    expect(formatAmountWhileTyping('1234567')).toBe('1,234,567');
    expect(formatAmountWhileTyping('1,23,4567')).toBe('1,234,567');
  });

  it('keeps a leading "-" only when negatives are allowed', () => {
    expect(formatAmountWhileTyping('-1234')).toBe('1,234');
    expect(formatAmountWhileTyping('-01234', { allowNegative: true })).toBe('-1,234');
    expect(formatAmountWhileTyping('-', { allowNegative: true })).toBe('-');
    expect(parseTypedAmount('-')).toBeUndefined();
    expect(parseTypedAmount('-1,234.5')).toBe(-1234.5);
    expect(finishTypedAmount('-')).toBe('');
  });

  it('never keeps a leading zero in front of what is typed', () => {
    expect(formatAmountWhileTyping('0265')).toBe('265');
    expect(formatAmountWhileTyping('000')).toBe('0');
    expect(formatAmountWhileTyping('0.5')).toBe('0.5');
  });

  it('starts cents with a "." and keeps at most two', () => {
    expect(formatAmountWhileTyping('1234.')).toBe('1,234.');
    expect(formatAmountWhileTyping('1234.567')).toBe('1,234.56');
    expect(formatAmountWhileTyping('.')).toBe('0.');
    expect(formatAmountWhileTyping('1.2.3')).toBe('1.23');
  });

  it('drops anything that is not a digit', () => {
    expect(formatAmountWhileTyping('R 12a3')).toBe('123');
    expect(formatAmountWhileTyping('-50')).toBe('50');
  });

  it('can be whole numbers only, without separators', () => {
    expect(formatAmountWhileTyping('0042.5', { decimals: 0, grouping: false })).toBe('425');
    expect(formatAmountWhileTyping('12345', { decimals: 0, grouping: false })).toBe('12345');
  });
});

describe('parseTypedAmount', () => {
  it('reads the number, or undefined while the field is empty', () => {
    expect(parseTypedAmount('1,234.5')).toBe(1234.5);
    expect(parseTypedAmount('1,234.')).toBe(1234);
    expect(parseTypedAmount('')).toBeUndefined();
    expect(parseTypedAmount('.')).toBeUndefined();
  });
});

describe('formatStoredAmount', () => {
  it('shows a stored amount the way it is typed', () => {
    expect(formatStoredAmount(1234567.5, { padDecimals: true })).toBe('1,234,567.50');
    expect(formatStoredAmount('2500000')).toBe('2,500,000');
    expect(formatStoredAmount(0.1 + 0.2, { padDecimals: true })).toBe('0.30');
  });

  it('shows zero as empty when asked, and nothing for no value', () => {
    expect(formatStoredAmount(0, { hideZero: true })).toBe('');
    expect(formatStoredAmount(0)).toBe('0');
    expect(formatStoredAmount(undefined)).toBe('');
    expect(formatStoredAmount('')).toBe('');
  });
});

describe('finishTypedAmount', () => {
  it('drops a trailing point and can complete the cents', () => {
    expect(finishTypedAmount('1,234.')).toBe('1,234');
    expect(finishTypedAmount('1,234.5', { padDecimals: true })).toBe('1,234.50');
    expect(finishTypedAmount('1,234', { padDecimals: true })).toBe('1,234');
  });
});

describe('caret helpers', () => {
  it('puts the caret after the same digits once separators move', () => {
    // "1234|" typed, formatted to "1,234": caret after the 4th digit.
    expect(caretAfterAmountCharacters('1,234', countAmountCharacters('1234'))).toBe(5);
    // "5|1,234" (5 typed in front): caret stays after the 5.
    expect(caretAfterAmountCharacters('51,234', countAmountCharacters('5'))).toBe(1);
    expect(caretAfterAmountCharacters('1,234', 0)).toBe(0);
  });
});
