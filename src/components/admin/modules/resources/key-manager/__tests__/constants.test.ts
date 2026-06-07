import { describe, it, expect } from 'vitest';
import {
  CATEGORY_ICONS,
  DATA_TYPE_COLORS,
  KEY_MODULES,
  KEY_USAGE_MAP,
  PROFILE_CATEGORIES,
  PRODUCT_CATEGORIES,
} from '../constants';

describe('CATEGORY_ICONS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(CATEGORY_ICONS).length).toBeGreaterThan(0);
  });

  it('every icon value is defined (truthy icon component)', () => {
    Object.values(CATEGORY_ICONS).forEach((icon) => {
      expect(icon).toBeDefined();
    });
  });

  it('includes risk, medical_aid, retirement_pre, estate_planning, and tax categories', () => {
    expect(CATEGORY_ICONS.risk).toBeDefined();
    expect(CATEGORY_ICONS.medical_aid).toBeDefined();
    expect(CATEGORY_ICONS.retirement_pre).toBeDefined();
    expect(CATEGORY_ICONS.estate_planning).toBeDefined();
    expect(CATEGORY_ICONS.tax).toBeDefined();
  });
});

describe('DATA_TYPE_COLORS', () => {
  it('is a non-empty object with string values', () => {
    expect(Object.keys(DATA_TYPE_COLORS).length).toBeGreaterThan(0);
    Object.values(DATA_TYPE_COLORS).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('covers currency, number, percentage, text, date, and boolean types', () => {
    expect(DATA_TYPE_COLORS.currency).toContain('green');
    expect(DATA_TYPE_COLORS.number).toContain('blue');
    expect(DATA_TYPE_COLORS.percentage).toBeTruthy();
    expect(DATA_TYPE_COLORS.text).toBeTruthy();
    expect(DATA_TYPE_COLORS.date).toBeTruthy();
    expect(DATA_TYPE_COLORS.boolean).toBeTruthy();
  });
});

describe('KEY_MODULES', () => {
  it('is a non-empty object with string values', () => {
    expect(Object.keys(KEY_MODULES).length).toBeGreaterThan(0);
    Object.values(KEY_MODULES).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('includes FNA modules and core modules', () => {
    expect(KEY_MODULES.RISK_FNA).toBeTruthy();
    expect(KEY_MODULES.MEDICAL_FNA).toBeTruthy();
    expect(KEY_MODULES.RETIREMENT_FNA).toBeTruthy();
    expect(KEY_MODULES.CLIENT_DASHBOARD).toBeTruthy();
    expect(KEY_MODULES.COMPLIANCE).toBeTruthy();
  });
});

describe('KEY_USAGE_MAP', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(KEY_USAGE_MAP).length).toBeGreaterThan(0);
  });

  it('every value is a non-empty array of module names', () => {
    Object.values(KEY_USAGE_MAP).forEach((modules) => {
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
    });
  });

  it('risk_life_cover maps to RISK_FNA and CLIENT_DASHBOARD', () => {
    expect(KEY_USAGE_MAP.risk_life_cover).toContain(KEY_MODULES.RISK_FNA);
    expect(KEY_USAGE_MAP.risk_life_cover).toContain(KEY_MODULES.CLIENT_DASHBOARD);
  });

  it('tax_annual_income maps to TAX_PLANNING_FNA and COMPLIANCE', () => {
    expect(KEY_USAGE_MAP.tax_annual_income).toContain(KEY_MODULES.TAX_PLANNING_FNA);
    expect(KEY_USAGE_MAP.tax_annual_income).toContain(KEY_MODULES.COMPLIANCE);
  });
});

describe('PROFILE_CATEGORIES and PRODUCT_CATEGORIES', () => {
  it('PROFILE_CATEGORIES is a non-empty array containing profile_ prefixed values', () => {
    expect(PROFILE_CATEGORIES.length).toBeGreaterThan(0);
    PROFILE_CATEGORIES.forEach((cat) => {
      expect(cat.startsWith('profile_')).toBe(true);
    });
  });

  it('PRODUCT_CATEGORIES is a non-empty array containing non-profile values', () => {
    expect(PRODUCT_CATEGORIES.length).toBeGreaterThan(0);
    PRODUCT_CATEGORIES.forEach((cat) => {
      expect(cat.startsWith('profile_')).toBe(false);
    });
  });

  it('PROFILE_CATEGORIES contains profile_personal, profile_contact, profile_banking', () => {
    expect(PROFILE_CATEGORIES).toContain('profile_personal');
    expect(PROFILE_CATEGORIES).toContain('profile_contact');
    expect(PROFILE_CATEGORIES).toContain('profile_banking');
  });

  it('PRODUCT_CATEGORIES contains risk, medical_aid, and tax', () => {
    expect(PRODUCT_CATEGORIES).toContain('risk');
    expect(PRODUCT_CATEGORIES).toContain('medical_aid');
    expect(PRODUCT_CATEGORIES).toContain('tax');
  });
});
