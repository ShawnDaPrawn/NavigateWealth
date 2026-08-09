/**
 * Tests for portal-theme constants.
 * Importing the module exercises all constant assignments.
 */

import { describe, expect, it } from 'vitest';
import { NAV_STYLES, QUICK_LINK_STYLES } from '../portal-theme';

describe('portal-theme', () => {
  it('exposes the launched branded navigation styles directly', () => {
    expect(NAV_STYLES.wrapper).toContain('from-[#1a1e36]');
    expect(NAV_STYLES.linkActive).toContain('text-white');
  });

  it('exposes the launched branded quick-link styles directly', () => {
    expect(QUICK_LINK_STYLES.card).toContain('bg-white/[0.07]');
  });
});
