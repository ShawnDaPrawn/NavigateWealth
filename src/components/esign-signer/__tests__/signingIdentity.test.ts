/**
 * Pins the signer identity helpers.
 *
 * These had no coverage: they lived inside SigningWorkflow.tsx, whose pdf.js
 * canvas rendering jsdom cannot exercise, so nothing in that file was testable.
 * The checksum is the part that matters — it decides whether a signer is
 * allowed to proceed on a legally binding document, so a wrong answer either
 * blocks a legitimate signer or lets a mistyped ID through onto a signed
 * record.
 */
import { describe, it, expect } from 'vitest';
import { isValidSaId, maskSaId, inProgressKey } from '../signingIdentity';

describe('isValidSaId', () => {
  // Checksum is the Luhn variant Home Affairs uses: sum the odd-positioned
  // digits, double the concatenated even-positioned digits and sum those, then
  // the check digit completes the total to a multiple of ten.
  // Check digits computed from the spec with an independent implementation,
  // not copied from the function under test.
  const VALID = ['8001015009087', '9202204720083', '0102035009087', '8705120801085'];

  it.each(VALID)('accepts the valid ID %s', (id) => {
    expect(isValidSaId(id)).toBe(true);
  });

  it('rejects an ID whose check digit is wrong', () => {
    // Same digits as a valid ID with only the final check digit changed.
    const valid = VALID[0];
    const wrongCheck = valid.slice(0, 12) + String((Number(valid[12]) + 1) % 10);
    expect(isValidSaId(wrongCheck)).toBe(false);
  });

  it('rejects anything that is not thirteen digits', () => {
    expect(isValidSaId('')).toBe(false);
    expect(isValidSaId('800101500908')).toBe(false); // 12
    expect(isValidSaId('80010150090877')).toBe(false); // 14
  });

  it('ignores non-digit separators', () => {
    // The field is displayed grouped, so what reaches this function may carry
    // the spaces maskSaId puts in.
    expect(isValidSaId('800101 5009 0 87')).toBe(true);
    expect(isValidSaId('800101-5009-0-87')).toBe(true);
  });

  it('rejects a string of letters', () => {
    expect(isValidSaId('abcdefghijklm')).toBe(false);
  });

  it('agrees with maskSaId — a grouped valid ID stays valid', () => {
    for (const id of VALID) {
      expect(isValidSaId(maskSaId(id))).toBe(true);
    }
  });
});

describe('maskSaId', () => {
  it('groups a full ID as YYMMDD SSSS C AZ', () => {
    expect(maskSaId('8001015009087')).toBe('800101 5009 0 87');
  });

  it('groups progressively as the signer types', () => {
    expect(maskSaId('8')).toBe('8');
    expect(maskSaId('800101')).toBe('800101');
    expect(maskSaId('8001015')).toBe('800101 5');
    expect(maskSaId('80010150090')).toBe('800101 5009 0');
    expect(maskSaId('800101500908')).toBe('800101 5009 0 8');
  });

  it('stops at thirteen digits', () => {
    expect(maskSaId('80010150090879999')).toBe('800101 5009 0 87');
  });

  it('strips non-digits before grouping, so re-formatting is stable', () => {
    const once = maskSaId('8001015009087');
    expect(maskSaId(once)).toBe(once);
  });

  it('returns an empty string for no digits', () => {
    expect(maskSaId('')).toBe('');
    expect(maskSaId('abc')).toBe('');
  });
});

describe('inProgressKey', () => {
  it('scopes saved progress to one signing token', () => {
    expect(inProgressKey('tok-1')).toBe('nw-esign-inprogress:tok-1');
    expect(inProgressKey('tok-2')).not.toBe(inProgressKey('tok-1'));
  });
});
