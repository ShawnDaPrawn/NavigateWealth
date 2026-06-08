/**
 * Tests for env.ts — environment configuration utilities.
 */

import { describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  validateEnv,
  getEnv,
  isDevelopment,
  isProduction,
  getEnvironment,
  logEnvironmentInfo,
} from '../env';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateEnv / getEnv', () => {
  it('returns an object with at minimum DEV, PROD, and MODE fields', () => {
    const env = validateEnv();
    expect(typeof env.DEV).toBe('boolean');
    expect(typeof env.PROD).toBe('boolean');
    expect(typeof env.MODE).toBe('string');
  });

  it('getEnv returns the same result as validateEnv', () => {
    expect(getEnv()).toEqual(validateEnv());
  });

  it('MODE defaults to a non-empty string', () => {
    const env = getEnv();
    expect(env.MODE.length).toBeGreaterThan(0);
  });

  it('DEV and PROD are not both true simultaneously', () => {
    const env = getEnv();
    expect(env.DEV && env.PROD).toBe(false);
  });
});

describe('isDevelopment', () => {
  it('returns a boolean', () => {
    expect(typeof isDevelopment()).toBe('boolean');
  });
});

describe('isProduction', () => {
  it('returns a boolean', () => {
    expect(typeof isProduction()).toBe('boolean');
  });

  it('returns false in test environment', () => {
    expect(isProduction()).toBe(false);
  });
});

describe('getEnvironment', () => {
  it('returns one of the valid environment strings', () => {
    const env = getEnvironment();
    expect(['development', 'production', 'staging']).toContain(env);
  });

  it('returns development in test environment', () => {
    expect(getEnvironment()).toBe('development');
  });
});

describe('logEnvironmentInfo', () => {
  it('does not throw', () => {
    expect(() => logEnvironmentInfo()).not.toThrow();
  });
});
