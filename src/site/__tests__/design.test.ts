import { describe, expect, it } from 'vitest';
import { resolveSiteDesign } from '../design';

describe('resolveSiteDesign', () => {
  it('keeps the legacy site unless the switch says navigator', () => {
    expect(resolveSiteDesign(undefined)).toBe('legacy');
    expect(resolveSiteDesign('')).toBe('legacy');
    expect(resolveSiteDesign('legacy')).toBe('legacy');
    expect(resolveSiteDesign('true')).toBe('legacy');
    expect(resolveSiteDesign(1)).toBe('legacy');
  });

  it('turns the redesign on only for an explicit navigator value', () => {
    expect(resolveSiteDesign('navigator')).toBe('navigator');
    expect(resolveSiteDesign(' Navigator ')).toBe('navigator');
  });
});
