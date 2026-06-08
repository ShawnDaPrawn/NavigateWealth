/**
 * Tests for sanitizeLogData — pure recursive sanitization function.
 */

import { describe, expect, it } from 'vitest';
import { sanitizeLogData } from '../logger-utils';

describe('sanitizeLogData', () => {
  it('returns null unchanged', () => {
    expect(sanitizeLogData(null)).toBeNull();
  });

  it('returns undefined unchanged', () => {
    expect(sanitizeLogData(undefined)).toBeUndefined();
  });

  it('returns primitive strings unchanged', () => {
    expect(sanitizeLogData('hello')).toBe('hello');
  });

  it('returns primitive numbers unchanged', () => {
    expect(sanitizeLogData(42)).toBe(42);
  });

  it('returns booleans unchanged', () => {
    expect(sanitizeLogData(true)).toBe(true);
  });

  it('converts Date to ISO string', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    expect(sanitizeLogData(date)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('converts Error to plain object with name/message/stack', () => {
    const err = new Error('boom');
    const result = sanitizeLogData(err) as Record<string, unknown>;
    expect(result.name).toBe('Error');
    expect(result.message).toBe('boom');
    expect(typeof result.stack).toBe('string');
  });

  it('redacts password field', () => {
    const result = sanitizeLogData({ password: 'secret123' }) as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts token field', () => {
    const result = sanitizeLogData({ token: 'abc.def.ghi' }) as Record<string, unknown>;
    expect(result.token).toBe('[REDACTED]');
  });

  it('redacts secret field', () => {
    const result = sanitizeLogData({ apiSecret: 'xyz' }) as Record<string, unknown>;
    expect(result.apiSecret).toBe('[REDACTED]');
  });

  it('redacts authorization field', () => {
    const result = sanitizeLogData({ authorization: 'Bearer token' }) as Record<string, unknown>;
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('preserves non-sensitive fields', () => {
    const result = sanitizeLogData({ userId: '123', action: 'login' }) as Record<string, unknown>;
    expect(result.userId).toBe('123');
    expect(result.action).toBe('login');
  });

  it('sanitizes nested objects', () => {
    const result = sanitizeLogData({ user: { password: 'secret', name: 'Alice' } }) as Record<
      string,
      unknown
    >;
    const user = result.user as Record<string, unknown>;
    expect(user.password).toBe('[REDACTED]');
    expect(user.name).toBe('Alice');
  });

  it('sanitizes arrays recursively', () => {
    const result = sanitizeLogData([{ token: 't1' }, { name: 'Bob' }]) as Record<string, unknown>[];
    expect(result[0].token).toBe('[REDACTED]');
    expect(result[1].name).toBe('Bob');
  });

  it('handles circular references without throwing', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => sanitizeLogData(obj)).not.toThrow();
    const result = sanitizeLogData(obj) as Record<string, unknown>;
    expect(result.self).toBe('[Circular]');
  });

  it('returns empty object for empty input object', () => {
    expect(sanitizeLogData({})).toEqual({});
  });
});
