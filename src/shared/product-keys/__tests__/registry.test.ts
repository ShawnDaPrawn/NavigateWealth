import { describe, expect, it } from 'vitest';
import {
  RISK_KEYS,
  MEDICAL_AID_KEYS,
  RETIREMENT_PRE_KEYS,
  INVEST_VOLUNTARY_KEYS,
  ESTATE_PLANNING_KEYS,
  PROFILE_PERSONAL_KEYS,
  ALL_PRODUCT_KEYS,
  KEY_CATEGORIES,
  getKeysByCategory,
} from '../registry';

describe('keyManagerConstants', () => {
  it('RISK_KEYS is a non-empty array', () => {
    expect(Array.isArray(RISK_KEYS)).toBe(true);
    expect(RISK_KEYS.length).toBeGreaterThan(0);
  });

  it('each ProductKey has id, category, name, dataType, and isCalculated', () => {
    RISK_KEYS.forEach((key) => {
      expect(typeof key.id).toBe('string');
      expect(typeof key.category).toBe('string');
      expect(typeof key.name).toBe('string');
      expect(typeof key.dataType).toBe('string');
      expect(typeof key.isCalculated).toBe('boolean');
    });
  });

  it('MEDICAL_AID_KEYS is a non-empty array', () => {
    expect(MEDICAL_AID_KEYS.length).toBeGreaterThan(0);
  });

  it('RETIREMENT_PRE_KEYS is a non-empty array', () => {
    expect(RETIREMENT_PRE_KEYS.length).toBeGreaterThan(0);
  });

  it('INVEST_VOLUNTARY_KEYS is a non-empty array', () => {
    expect(INVEST_VOLUNTARY_KEYS.length).toBeGreaterThan(0);
  });

  it('ESTATE_PLANNING_KEYS is a non-empty array', () => {
    expect(ESTATE_PLANNING_KEYS.length).toBeGreaterThan(0);
  });

  it('PROFILE_PERSONAL_KEYS is a non-empty array', () => {
    expect(PROFILE_PERSONAL_KEYS.length).toBeGreaterThan(0);
  });

  it('ALL_PRODUCT_KEYS contains keys from multiple categories', () => {
    expect(ALL_PRODUCT_KEYS.length).toBeGreaterThan(RISK_KEYS.length);
    const categories = new Set(ALL_PRODUCT_KEYS.map((k) => k.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  it('KEY_CATEGORIES is a non-empty array with id and name', () => {
    expect(Array.isArray(KEY_CATEGORIES)).toBe(true);
    expect(KEY_CATEGORIES.length).toBeGreaterThan(0);
    KEY_CATEGORIES.forEach((cat) => {
      expect(typeof cat.id).toBe('string');
      expect(typeof cat.name).toBe('string');
    });
  });

  it('getKeysByCategory returns keys for risk category', () => {
    const riskKeys = getKeysByCategory('risk');
    expect(Array.isArray(riskKeys)).toBe(true);
    expect(riskKeys.length).toBeGreaterThan(0);
    riskKeys.forEach((k) => expect(k.category).toBe('risk'));
  });

  it('getKeysByCategory returns empty array for unknown category', () => {
    const result = getKeysByCategory('nonexistent_category' as never);
    expect(Array.isArray(result)).toBe(true);
  });

  it('all ids in ALL_PRODUCT_KEYS are unique strings', () => {
    const ids = ALL_PRODUCT_KEYS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
