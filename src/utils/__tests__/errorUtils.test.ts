import { describe, expect, it, vi } from 'vitest';
import {
  APIError,
  getErrorCode,
  getErrorMessage,
  getUserErrorMessage,
  isAbortError,
  isAPIError,
  isBackendErrorResponse,
  isError,
  isPostgrestError,
  isWebLockStealAbort,
  logError,
} from '../errorUtils';

const postgrest = { code: '23505', message: 'duplicate key', details: 'detail' };

describe('type guards', () => {
  it('isPostgrestError requires code + message + details', () => {
    expect(isPostgrestError(postgrest)).toBe(true);
    expect(isPostgrestError({ code: 'x', message: 'y' })).toBe(false);
    expect(isPostgrestError(null)).toBe(false);
  });

  it('isAPIError / isError', () => {
    expect(isAPIError(new APIError('boom', 400, 'BAD'))).toBe(true);
    expect(isAPIError(new Error('x'))).toBe(false);
    expect(isError(new Error('x'))).toBe(true);
    expect(isError('x')).toBe(false);
  });

  it('isBackendErrorResponse requires a string error field', () => {
    expect(isBackendErrorResponse({ error: 'nope' })).toBe(true);
    expect(isBackendErrorResponse({ error: 500 })).toBe(false);
    expect(isBackendErrorResponse({})).toBe(false);
  });

  it('isAbortError detects AbortError by name', () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    expect(isAbortError(e)).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
  });

  it('isWebLockStealAbort detects the steal-coordination rejection', () => {
    expect(
      isWebLockStealAbort({
        name: 'AbortError',
        message: 'Lock broken by another request with the steal option',
      }),
    ).toBe(true);
    expect(isWebLockStealAbort({ name: 'AbortError', message: 'unrelated' })).toBe(false);
    expect(isWebLockStealAbort('nope')).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('extracts the message from each supported shape', () => {
    expect(getErrorMessage({ error: 'backend says no' })).toBe('backend says no');
    expect(getErrorMessage(new Error('thrown'))).toBe('thrown');
    expect(getErrorMessage(postgrest)).toBe('duplicate key');
    expect(getErrorMessage('a plain string')).toBe('a plain string');
    expect(getErrorMessage({ message: 'loose object' })).toBe('loose object');
    expect(getErrorMessage(42)).toBe('An unknown error occurred');
  });
});

describe('getErrorCode', () => {
  it('extracts a code where present, else undefined', () => {
    expect(getErrorCode({ error: 'x', code: 'C1' })).toBe('C1');
    expect(getErrorCode(postgrest)).toBe('23505');
    expect(getErrorCode(new APIError('x', 400, 'BAD'))).toBe('BAD');
    expect(getErrorCode({ code: 'LOOSE' })).toBe('LOOSE');
    expect(getErrorCode({})).toBeUndefined();
  });
});

describe('getUserErrorMessage', () => {
  it('maps technical errors to friendly copy', () => {
    expect(getUserErrorMessage(new Error('Network request failed'))).toContain(
      'Network connection issue',
    );
    expect(getUserErrorMessage(new Error('Unauthorized'))).toContain('session has expired');
    expect(getUserErrorMessage(new Error('Resource not found'))).toContain('could not be found');
    expect(getUserErrorMessage(new Error('Request timeout'))).toContain('took too long');
  });

  it('hides messages containing technical jargon behind a generic message', () => {
    expect(getUserErrorMessage(new Error('cannot read property of undefined'))).toContain(
      'An unexpected error occurred',
    );
  });

  it('passes through an already user-friendly message', () => {
    expect(getUserErrorMessage(new Error('Please enter a valid email address'))).toBe(
      'Please enter a valid email address',
    );
  });
});

describe('logError', () => {
  it('is silent outside development', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    logError(new Error('should not log'), 'ctx');
    expect(spy).not.toHaveBeenCalled();
    process.env.NODE_ENV = original;
    spy.mockRestore();
  });

  it('logs message + stack in development', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    logError(new APIError('boom', 500, 'X'), 'ctx');
    expect(spy).toHaveBeenCalled();
    process.env.NODE_ENV = original;
    spy.mockRestore();
  });
});
