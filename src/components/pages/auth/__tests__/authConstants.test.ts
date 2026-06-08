import { describe, expect, it } from 'vitest';
import { AUTH_STATS, LOGIN_FEATURES, SIGNUP_FEATURES, COUNTRY_CODES } from '../authConstants';

describe('auth/authConstants', () => {
  it('AUTH_STATS has at least one stat with value and label', () => {
    expect(AUTH_STATS.length).toBeGreaterThan(0);
    AUTH_STATS.forEach((stat) => {
      expect(typeof stat.value).toBe('string');
      expect(typeof stat.label).toBe('string');
    });
  });

  it('LOGIN_FEATURES has at least one feature with iconSlug, title, and description', () => {
    expect(LOGIN_FEATURES.length).toBeGreaterThan(0);
    LOGIN_FEATURES.forEach((feature) => {
      expect(typeof feature.iconSlug).toBe('string');
      expect(typeof feature.title).toBe('string');
      expect(typeof feature.description).toBe('string');
    });
  });

  it('SIGNUP_FEATURES is a non-empty array', () => {
    expect(SIGNUP_FEATURES.length).toBeGreaterThan(0);
  });

  it('COUNTRY_CODES is a non-empty array', () => {
    expect(Array.isArray(COUNTRY_CODES)).toBe(true);
    expect(COUNTRY_CODES.length).toBeGreaterThan(0);
  });

  it('COUNTRY_CODES entries have code, flag, name, and priority', () => {
    COUNTRY_CODES.forEach((country) => {
      expect(typeof country.code).toBe('string');
      expect(country.code).toMatch(/^\+/);
      expect(typeof country.name).toBe('string');
      expect(typeof country.priority).toBe('boolean');
    });
  });

  it('COUNTRY_CODES includes South Africa as a priority country', () => {
    const za = COUNTRY_CODES.find((c) => c.name === 'South Africa');
    expect(za).toBeDefined();
    expect(za!.code).toBe('+27');
    expect(za!.priority).toBe(true);
  });
});
