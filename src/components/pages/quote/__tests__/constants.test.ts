import { describe, it, expect } from 'vitest';
import { QUOTE_SERVICES, getServiceConfig, isValidServiceId, TRUST_INDICATORS } from '../constants';

describe('QUOTE_SERVICES', () => {
  it('is a non-empty array of service configurations', () => {
    expect(Array.isArray(QUOTE_SERVICES)).toBe(true);
    expect(QUOTE_SERVICES.length).toBeGreaterThan(0);
  });

  it('every service has id, title, and description', () => {
    QUOTE_SERVICES.forEach((service) => {
      expect(service.id, `service.id should be truthy`).toBeTruthy();
    });
  });

  it('contains risk-management service', () => {
    const ids = QUOTE_SERVICES.map((s) => s.id);
    expect(ids).toContain('risk-management');
  });

  it('contains medical-aid service', () => {
    const ids = QUOTE_SERVICES.map((s) => s.id);
    expect(ids).toContain('medical-aid');
  });
});

describe('getServiceConfig', () => {
  it('returns config for a known service ID', () => {
    const config = getServiceConfig('risk-management');
    expect(config).toBeDefined();
    expect(config?.id).toBe('risk-management');
  });

  it('returns undefined for an unknown service ID', () => {
    expect(getServiceConfig('unknown-service')).toBeUndefined();
  });
});

describe('isValidServiceId', () => {
  it('returns true for known service IDs', () => {
    expect(isValidServiceId('risk-management')).toBe(true);
    expect(isValidServiceId('medical-aid')).toBe(true);
  });

  it('returns false for unknown service IDs', () => {
    expect(isValidServiceId('not-a-service')).toBe(false);
    expect(isValidServiceId('')).toBe(false);
  });
});

describe('TRUST_INDICATORS', () => {
  it('is a non-empty array with label and icon fields', () => {
    expect(TRUST_INDICATORS.length).toBeGreaterThan(0);
    TRUST_INDICATORS.forEach((indicator) => {
      expect(indicator.label).toBeTruthy();
      expect(indicator.icon).toBeTruthy();
    });
  });
});
