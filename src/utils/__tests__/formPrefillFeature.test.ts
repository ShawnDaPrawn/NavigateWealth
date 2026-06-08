import { describe, expect, it, vi, afterEach } from 'vitest';

describe('formPrefillFeature', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when VITE_FORM_PREFILL_ENABLED is undefined', async () => {
    vi.stubEnv('VITE_FORM_PREFILL_ENABLED', undefined as unknown as string);
    const { isFormPrefillEnabled } = await import('../formPrefillFeature');
    expect(isFormPrefillEnabled()).toBe(true);
  });

  it('returns true when VITE_FORM_PREFILL_ENABLED is "true"', async () => {
    vi.stubEnv('VITE_FORM_PREFILL_ENABLED', 'true');
    const { isFormPrefillEnabled } = await import('../formPrefillFeature');
    expect(isFormPrefillEnabled()).toBe(true);
  });

  it('returns true when VITE_FORM_PREFILL_ENABLED is "1"', async () => {
    vi.stubEnv('VITE_FORM_PREFILL_ENABLED', '1');
    const { isFormPrefillEnabled } = await import('../formPrefillFeature');
    expect(isFormPrefillEnabled()).toBe(true);
  });

  it('returns false when VITE_FORM_PREFILL_ENABLED is "false"', async () => {
    vi.stubEnv('VITE_FORM_PREFILL_ENABLED', 'false');
    const { isFormPrefillEnabled } = await import('../formPrefillFeature');
    expect(isFormPrefillEnabled()).toBe(false);
  });

  it('returns false when VITE_FORM_PREFILL_ENABLED is "0"', async () => {
    vi.stubEnv('VITE_FORM_PREFILL_ENABLED', '0');
    const { isFormPrefillEnabled } = await import('../formPrefillFeature');
    expect(isFormPrefillEnabled()).toBe(false);
  });
});
