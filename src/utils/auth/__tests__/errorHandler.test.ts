import { describe, it, expect } from 'vitest';
import { parseAuthError, AuthError } from '../errorHandler';
import { AUTH_ERRORS } from '../constants';

describe('AuthError', () => {
  it('sets name to AuthError', () => {
    const err = new AuthError('bad');
    expect(err.name).toBe('AuthError');
    expect(err.message).toBe('bad');
  });

  it('stores code and originalError', () => {
    const original = new Error('original');
    const err = new AuthError('msg', 'some_code', original);
    expect(err.code).toBe('some_code');
    expect(err.originalError).toBe(original);
  });
});

describe('parseAuthError', () => {
  it('returns the same AuthError when given an AuthError', () => {
    const ae = new AuthError('already wrapped');
    expect(parseAuthError(ae)).toBe(ae);
  });

  it('maps rate-limiting message to rate_limited code', () => {
    const result = parseAuthError(new Error('Too many login attempts'));
    expect(result.code).toBe('rate_limited');
  });

  it('maps "rate" keyword to rate_limited code', () => {
    const result = parseAuthError(new Error('rate limit exceeded'));
    expect(result.code).toBe('rate_limited');
  });

  it('maps duplicate email error', () => {
    const result = parseAuthError(new Error('User already registered'));
    expect(result.code).toBe('duplicate_email');
    expect(result.message).toBe(AUTH_ERRORS.DUPLICATE_EMAIL);
  });

  it('maps "already exists" to duplicate_email', () => {
    const result = parseAuthError(new Error('Email already exists'));
    expect(result.code).toBe('duplicate_email');
  });

  it('maps email not confirmed error', () => {
    const result = parseAuthError(new Error('Email not confirmed'));
    expect(result.code).toBe('email_not_verified');
    expect(result.message).toBe(AUTH_ERRORS.EMAIL_NOT_VERIFIED);
  });

  it('maps invalid credentials error', () => {
    const result = parseAuthError(new Error('Invalid login credentials'));
    expect(result.code).toBe('invalid_credentials');
    expect(result.message).toBe(AUTH_ERRORS.INVALID_CREDENTIALS);
  });

  it('maps "User not found" to invalid_credentials', () => {
    const result = parseAuthError(new Error('User not found'));
    expect(result.code).toBe('invalid_credentials');
  });

  it('maps invalid_grant to invalid_credentials', () => {
    const result = parseAuthError(new Error('invalid_grant'));
    expect(result.code).toBe('invalid_credentials');
  });

  it('maps network errors', () => {
    const result = parseAuthError(new Error('Failed to fetch'));
    expect(result.code).toBe('network_error');
  });

  it('maps NetworkError to network_error', () => {
    const result = parseAuthError(new Error('NetworkError when attempting to fetch'));
    expect(result.code).toBe('network_error');
  });

  it('maps ERR_CONNECTION_REFUSED to network_error', () => {
    const result = parseAuthError(new Error('ERR_CONNECTION_REFUSED'));
    expect(result.code).toBe('network_error');
  });

  it('falls back to unknown_error for unrecognized message', () => {
    const result = parseAuthError(new Error('Something went wrong unexpectedly'));
    expect(result.code).toBe('unknown_error');
    expect(result.message).toBe('Something went wrong unexpectedly');
  });

  it('uses UNKNOWN_ERROR constant when message is empty', () => {
    const result = parseAuthError(new Error(''));
    expect(result.code).toBe('unknown_error');
    expect(result.message).toBe(AUTH_ERRORS.UNKNOWN_ERROR);
  });

  it('handles object with message property (non-Error)', () => {
    const result = parseAuthError({ message: 'User not found' });
    expect(result.code).toBe('invalid_credentials');
  });

  it('handles non-Error, non-object input (produces unknown_error)', () => {
    const result = parseAuthError('raw string error');
    expect(result.code).toBe('unknown_error');
  });

  it('handles null/undefined gracefully', () => {
    const result = parseAuthError(null);
    expect(result).toBeInstanceOf(AuthError);
    expect(result.code).toBe('unknown_error');
  });
});
