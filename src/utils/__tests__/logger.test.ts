/**
 * Tests for the logger singleton.
 * Spies on console methods to verify structured/pretty output.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../shared/utils/logger-utils', () => ({
  sanitizeLogData: (data: unknown) => data,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { logger } from '../logger';

// ── Helpers ───────────────────────────────────────────────────────────────────

let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleGroupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
  consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('logger', () => {
  it('exports a logger singleton', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('logger.info calls a console method', () => {
    logger.info('Test info message');
    const allCalls = [consoleLogSpy.mock.calls.length, consoleGroupSpy.mock.calls.length];
    expect(allCalls.some((n) => n > 0)).toBe(true);
  });

  it('logger.warn calls a console method', () => {
    logger.warn('Test warning');
    const allCalls = [consoleWarnSpy.mock.calls.length, consoleGroupSpy.mock.calls.length];
    expect(allCalls.some((n) => n > 0)).toBe(true);
  });

  it('logger.error calls a console method', () => {
    logger.error('Something went wrong', new Error('oops'));
    const allCalls = [consoleErrorSpy.mock.calls.length, consoleGroupSpy.mock.calls.length];
    expect(allCalls.some((n) => n > 0)).toBe(true);
  });

  it('logger.info accepts optional context', () => {
    expect(() => logger.info('With context', { userId: '123' })).not.toThrow();
  });

  it('logger.warn accepts optional context', () => {
    expect(() => logger.warn('With context', { action: 'test' })).not.toThrow();
  });

  it('logger.error accepts optional context and error', () => {
    expect(() => logger.error('Error occurred', new Error('test'), { userId: '42' })).not.toThrow();
  });

  it('logger.debug does not throw', () => {
    expect(() => logger.debug('Debug message')).not.toThrow();
  });
});
