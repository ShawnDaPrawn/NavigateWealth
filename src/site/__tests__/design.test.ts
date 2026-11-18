import { describe, expect, it } from 'vitest';
import { resolveSiteDesign } from '../design';

describe('resolveSiteDesign', () => {
  it('builds the redesign unless the switch explicitly says legacy', () => {
    expect(resolveSiteDesign(undefined)).toBe('navigator');
    expect(resolveSiteDesign('')).toBe('navigator');
    expect(resolveSiteDesign('navigator')).toBe('navigator');
    expect(resolveSiteDesign('true')).toBe('navigator');
    expect(resolveSiteDesign(1)).toBe('navigator');
  });

  it('reverts to the pre-redesign site for an explicit legacy value', () => {
    expect(resolveSiteDesign('legacy')).toBe('legacy');
    expect(resolveSiteDesign(' Legacy ')).toBe('legacy');
  });
});
