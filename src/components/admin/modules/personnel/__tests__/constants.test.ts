import { describe, it, expect } from 'vitest';
import {
  ROLE_LABELS,
  ROLE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  FSCA_STATUS_LABELS,
  FSCA_STATUS_COLORS,
  COMMISSION_ENTITY_LABELS,
  DEFAULT_COMMISSION_SPLIT,
  DEFAULT_FILTERS,
  PERMISSIONED_MODULES,
} from '../constants';

describe('personnel role constants', () => {
  it('ROLE_LABELS covers all standard roles', () => {
    expect(ROLE_LABELS.adviser).toBeTruthy();
    expect(ROLE_LABELS.admin).toBeTruthy();
    expect(ROLE_LABELS.compliance).toBeTruthy();
    expect(ROLE_LABELS.viewer).toBeTruthy();
  });

  it('ROLE_COLORS returns CSS class strings for each role', () => {
    Object.values(ROLE_COLORS).forEach((v) => expect(v.length).toBeGreaterThan(0));
  });

  it('active status has green color, suspended has red', () => {
    expect(STATUS_COLORS.active).toContain('green');
    expect(STATUS_COLORS.suspended).toContain('red');
  });
});

describe('personnel status constants', () => {
  it('STATUS_LABELS covers active, suspended, pending', () => {
    expect(STATUS_LABELS.active).toBeTruthy();
    expect(STATUS_LABELS.suspended).toBeTruthy();
    expect(STATUS_LABELS.pending).toBeTruthy();
  });
});

describe('FSCA status constants', () => {
  it('has at least one FSCA status', () => {
    expect(Object.keys(FSCA_STATUS_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(FSCA_STATUS_COLORS).length).toBeGreaterThan(0);
  });
});

describe('commission constants', () => {
  it('COMMISSION_ENTITY_LABELS is a non-empty record', () => {
    expect(Object.keys(COMMISSION_ENTITY_LABELS).length).toBeGreaterThan(0);
  });

  it('DEFAULT_COMMISSION_SPLIT is a number between 0 and 100', () => {
    expect(DEFAULT_COMMISSION_SPLIT).toBeGreaterThan(0);
    expect(DEFAULT_COMMISSION_SPLIT).toBeLessThanOrEqual(100);
  });
});

describe('personnel filter and module constants', () => {
  it('DEFAULT_FILTERS is an object', () => {
    expect(typeof DEFAULT_FILTERS).toBe('object');
  });

  it('PERMISSIONED_MODULES is an array', () => {
    expect(Array.isArray(PERMISSIONED_MODULES)).toBe(true);
  });
});
