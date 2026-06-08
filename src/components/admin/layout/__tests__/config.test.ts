import { describe, expect, it } from 'vitest';
import { moduleConfig, moduleGroups, operationsModules, alwaysShowCounterModules } from '../config';

describe('admin/layout/config', () => {
  it('moduleConfig has dashboard and clients entries', () => {
    expect(moduleConfig.dashboard).toBeDefined();
    expect(moduleConfig.clients).toBeDefined();
    expect(moduleConfig.esign).toBeDefined();
  });

  it('each moduleConfig entry has a label and icon', () => {
    Object.values(moduleConfig).forEach((entry) => {
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.icon).toBeDefined();
    });
  });

  it('moduleGroups is a non-empty array', () => {
    expect(Array.isArray(moduleGroups)).toBe(true);
    expect(moduleGroups.length).toBeGreaterThan(0);
  });

  it('each module group has a label and modules array', () => {
    moduleGroups.forEach((group) => {
      expect(typeof group.label).toBe('string');
      expect(Array.isArray(group.modules)).toBe(true);
    });
  });

  it('operationsModules is a non-empty array of module keys', () => {
    expect(Array.isArray(operationsModules)).toBe(true);
    expect(operationsModules.length).toBeGreaterThan(0);
    operationsModules.forEach((mod) => {
      expect(moduleConfig[mod]).toBeDefined();
    });
  });

  it('alwaysShowCounterModules is defined', () => {
    expect(Array.isArray(alwaysShowCounterModules)).toBe(true);
  });
});
