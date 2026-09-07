import { describe, expect, it } from 'vitest';
import {
  moduleConfig,
  moduleGroups,
  operationsModules,
  alwaysShowCounterModules,
  formatSidebarBadgeCount,
  formatPendingSummary,
} from '../config';

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

describe('formatSidebarBadgeCount', () => {
  it('returns the raw count up to 99', () => {
    expect(formatSidebarBadgeCount(0)).toBe('0');
    expect(formatSidebarBadgeCount(1)).toBe('1');
    expect(formatSidebarBadgeCount(99)).toBe('99');
  });

  it('caps counts above 99 so the compact badge never overflows', () => {
    expect(formatSidebarBadgeCount(100)).toBe('99+');
    expect(formatSidebarBadgeCount(1234)).toBe('99+');
  });

  it('never renders a negative count', () => {
    expect(formatSidebarBadgeCount(-5)).toBe('0');
  });
});

describe('formatPendingSummary', () => {
  it('describes an empty queue in words', () => {
    expect(formatPendingSummary(0)).toBe('nothing pending');
  });

  it('reports the exact count when items are pending', () => {
    expect(formatPendingSummary(1)).toBe('1 pending');
    expect(formatPendingSummary(124)).toBe('124 pending');
  });

  it('uses the exact count for large numbers instead of the capped badge value', () => {
    expect(formatPendingSummary(1234)).toBe((1234).toLocaleString() + ' pending');
  });
});
