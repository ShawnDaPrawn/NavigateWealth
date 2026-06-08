/**
 * Tests for getKeyCategoryForProductCategory and getAvailableKeysForCategory.
 */

import { describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetKeysByCategory = vi.fn();

vi.mock('../keyManagerConstants', () => ({
  getKeysByCategory: (...args: unknown[]) => mockGetKeysByCategory(...args),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  getKeyCategoryForProductCategory,
  getAvailableKeysForCategory,
} from '../keyMappingHelpers';

// ── getKeyCategoryForProductCategory ─────────────────────────────────────────

describe('getKeyCategoryForProductCategory', () => {
  it('maps risk_planning to risk', () => {
    expect(getKeyCategoryForProductCategory('risk_planning')).toBe('risk');
  });

  it('maps medical_aid to medical_aid', () => {
    expect(getKeyCategoryForProductCategory('medical_aid')).toBe('medical_aid');
  });

  it('maps retirement_planning to retirement_pre', () => {
    expect(getKeyCategoryForProductCategory('retirement_planning')).toBe('retirement_pre');
  });

  it('maps retirement_pre to retirement_pre', () => {
    expect(getKeyCategoryForProductCategory('retirement_pre')).toBe('retirement_pre');
  });

  it('maps retirement_post to retirement_post', () => {
    expect(getKeyCategoryForProductCategory('retirement_post')).toBe('retirement_post');
  });

  it('maps investments to invest_voluntary', () => {
    expect(getKeyCategoryForProductCategory('investments')).toBe('invest_voluntary');
  });

  it('maps investments_guaranteed to invest_guaranteed', () => {
    expect(getKeyCategoryForProductCategory('investments_guaranteed')).toBe('invest_guaranteed');
  });

  it('maps employee_benefits_risk to employee_benefits_risk', () => {
    expect(getKeyCategoryForProductCategory('employee_benefits_risk')).toBe(
      'employee_benefits_risk',
    );
  });

  it('maps tax_planning to tax', () => {
    expect(getKeyCategoryForProductCategory('tax_planning')).toBe('tax');
  });

  it('maps estate_planning to estate_planning', () => {
    expect(getKeyCategoryForProductCategory('estate_planning')).toBe('estate_planning');
  });
});

// ── getAvailableKeysForCategory ───────────────────────────────────────────────

describe('getAvailableKeysForCategory', () => {
  it('returns empty array when category has no key mapping', () => {
    const result = getAvailableKeysForCategory('unknown_category' as never);
    expect(result).toEqual([]);
  });

  it('calls getKeysByCategory with the mapped category', () => {
    mockGetKeysByCategory.mockReturnValue([]);
    getAvailableKeysForCategory('risk_planning');
    expect(mockGetKeysByCategory).toHaveBeenCalledWith('risk');
  });

  it('filters out calculated keys', () => {
    mockGetKeysByCategory.mockReturnValue([
      { key: 'k1', isCalculated: false },
      { key: 'k2', isCalculated: true },
      { key: 'k3', isCalculated: false },
    ]);
    const result = getAvailableKeysForCategory('risk_planning');
    expect(result).toHaveLength(2);
    expect(result.every((k) => !k.isCalculated)).toBe(true);
  });

  it('returns all keys when none are calculated', () => {
    mockGetKeysByCategory.mockReturnValue([
      { key: 'k1', isCalculated: false },
      { key: 'k2', isCalculated: false },
    ]);
    const result = getAvailableKeysForCategory('risk_planning');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when all keys are calculated', () => {
    mockGetKeysByCategory.mockReturnValue([
      { key: 'k1', isCalculated: true },
      { key: 'k2', isCalculated: true },
    ]);
    const result = getAvailableKeysForCategory('risk_planning');
    expect(result).toHaveLength(0);
  });
});
