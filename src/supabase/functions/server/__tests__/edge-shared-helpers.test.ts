/**
 * Small shared helpers that replaced copies spread across the Edge Function.
 * ========================================================================
 *
 * Each of these used to be written out inline in several files. The copies
 * were identical, so these tests pin the one behaviour they all had:
 *
 *   - authErrorResponse: the e-sign catch-block response (70 call sites).
 *   - sha256Hex: idempotency body hashes, SES SigV4 and stored OTP hashes.
 *   - retryAfterSeconds: the Retry-After value on every rate-limited answer.
 *   - stripBearerPrefix: the lenient Authorization-header read (10 call sites).
 */
import { describe, expect, it } from 'vitest';
import { AuthError } from '../auth-mw.ts';
import { authErrorResponse } from '../esign-auth-error-response.ts';
import { sha256Hex } from '../sha256.ts';
import { retryAfterSeconds } from '../retry-after.ts';
import { stripBearerPrefix } from '../bearer-token.ts';

describe('authErrorResponse', () => {
  it("answers with an AuthError's own status and message", async () => {
    const res = authErrorResponse(new AuthError('Envelope not found', 404), 'Failed');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual({ error: 'Envelope not found' });
  });

  it('answers 500 with the message for any other Error', async () => {
    const res = authErrorResponse(new Error('kv down'), 'Failed');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'kv down' });
  });

  it('uses the fallback when the thrown value is not an Error', async () => {
    const res = authErrorResponse('boom', 'Failed to list documents');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to list documents' });
  });
});

describe('sha256Hex', () => {
  it('returns the lowercase hex SHA-256 of a UTF-8 string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('retryAfterSeconds', () => {
  const now = 1_700_000_000_000;

  it('rounds the time left up to whole seconds', () => {
    expect(retryAfterSeconds(new Date(now + 1_200), now)).toBe(2);
    expect(retryAfterSeconds(new Date(now + 60_000), now)).toBe(60);
  });

  it('never answers less than one second, even once the window has passed', () => {
    expect(retryAfterSeconds(new Date(now + 10), now)).toBe(1);
    expect(retryAfterSeconds(new Date(now - 5_000), now)).toBe(1);
  });
});

describe('stripBearerPrefix', () => {
  it('removes a leading Bearer in any letter case, with any whitespace after it', () => {
    expect(stripBearerPrefix('Bearer abc.def')).toBe('abc.def');
    expect(stripBearerPrefix('bearer abc')).toBe('abc');
    expect(stripBearerPrefix('BEARER \tabc')).toBe('abc');
  });

  it('returns a header without the prefix whole, so a bare token still works', () => {
    expect(stripBearerPrefix('abc.def')).toBe('abc.def');
    expect(stripBearerPrefix('Basic dXNlcg==')).toBe('Basic dXNlcg==');
  });

  it('leaves trimming and a missing header to the caller', () => {
    expect(stripBearerPrefix('Bearer abc  ')).toBe('abc  ');
    expect(stripBearerPrefix(undefined)).toBeUndefined();
    expect(stripBearerPrefix('')).toBe('');
  });
});
