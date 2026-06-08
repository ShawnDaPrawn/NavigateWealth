import { describe, expect, it } from 'vitest';
import { isFormPrefillEnabled } from '../formPrefillFeature';

describe('isFormPrefillEnabled', () => {
  it('returns a boolean', () => {
    expect(typeof isFormPrefillEnabled()).toBe('boolean');
  });

  it('returns true when env is unset (default-on behavior)', () => {
    // In test env, VITE_FORM_PREFILL_ENABLED is undefined → should return true
    const result = isFormPrefillEnabled();
    expect(result).toBe(true);
  });
});
