/**
 * Unverified reads of `iat` and `session_id` from a token that was just checked.
 * ==============================================================================
 *
 * `enforceAccountSecurity` fails OPEN when `iat` is null (a password change
 * must not lock out a caller that genuinely cannot read a claim) and fails
 * CLOSED when `session_id` is missing (a second sign-in must not inherit
 * another session's two-factor verification). Both decisions are only as
 * good as this decode.
 *
 * GoTrue tokens are base64url, with the padding stripped. If the `-`/`_`
 * translation or the padding restore breaks, every real `iat` becomes null
 * and a revoked session keeps working, and every real `session_id` becomes
 * null and every two-factor user is locked out. The policy tests pass the
 * numbers in directly, so they would stay green through that.
 */
import { describe, expect, it } from 'vitest';
import { readTokenIssuedAt, readTokenSessionId } from '../jwt-claims.ts';

/** A JWT whose payload is `payload`. The signature is never checked. */
function token(payload: unknown): string {
  const segment = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${segment({ alg: 'none' })}.${segment(payload)}.sig`;
}

describe('readTokenIssuedAt', () => {
  it('reads a numeric iat from a base64url payload whose padding was stripped', () => {
    // ">>>" encodes with "+" and trailing "=". Both have to be undone or the
    // payload does not parse and the claim comes back null.
    const standard = btoa(JSON.stringify({ iat: 1_700_000_000, session_id: '>>>' }));
    expect(standard).toContain('+');
    expect(standard.endsWith('=')).toBe(true);

    expect(readTokenIssuedAt(token({ iat: 1_700_000_000, session_id: '>>>' }))).toBe(1_700_000_000);
  });

  it('reads an iat from a payload that uses the other base64url character', () => {
    // "???" encodes with "/". Translating only "+" would still drop this one.
    const standard = btoa(JSON.stringify({ iat: 1_700_000_001, session_id: '???' }));
    expect(standard).toContain('/');

    expect(readTokenIssuedAt(token({ iat: 1_700_000_001, session_id: '???' }))).toBe(1_700_000_001);
  });

  it('keeps an iat of zero, which is a real issued-at and not "missing"', () => {
    // A falsy check here would fail open: zero is "cannot tell", and a token
    // carrying it would survive a password change.
    expect(readTokenIssuedAt(token({ iat: 0 }))).toBe(0);
  });

  it('does not coerce a claim that is not a finite number', () => {
    // Number("1700000000") would succeed. The claim GoTrue issues is a
    // number; a string, a boolean, null, or a list is "cannot tell".
    expect(readTokenIssuedAt(token({ iat: '1700000000' }))).toBeNull();
    expect(readTokenIssuedAt(token({ iat: true }))).toBeNull();
    expect(readTokenIssuedAt(token({ iat: null }))).toBeNull();
    expect(readTokenIssuedAt(token({ iat: [1_700_000_000] }))).toBeNull();
    expect(readTokenIssuedAt(token({ sub: 'user-1' }))).toBeNull();
  });

  it('returns null, and does not throw, when the token is not a JWT object', () => {
    expect(readTokenIssuedAt(undefined)).toBeNull();
    expect(readTokenIssuedAt('')).toBeNull();
    expect(readTokenIssuedAt('not-a-jwt')).toBeNull();
    expect(readTokenIssuedAt('only.two')).toBeNull();
    expect(readTokenIssuedAt('a.b.c.d')).toBeNull();
    expect(readTokenIssuedAt(token([1, 2, 3]))).toBeNull();
    expect(readTokenIssuedAt(token('just-a-string'))).toBeNull();
    expect(readTokenIssuedAt('aaa.!!!not-base64!!!.ccc')).toBeNull();
  });

  it('still reads the payload when a Bearer prefix is stuck to the header segment', () => {
    // "Bearer <jwt>" is three dot-separated parts: the prefix rides on the
    // header, and the claims stay in the middle. Rejecting a header that is
    // not itself base64 would turn that into a null iat, and revocation
    // fails open on null.
    const jwt = token({ iat: 1_700_000_000, session_id: 'sess-A' });
    expect(readTokenIssuedAt(`Bearer ${jwt}`)).toBe(1_700_000_000);
    expect(readTokenSessionId(`Bearer ${jwt}`)).toBe('sess-A');
  });
});

describe('readTokenSessionId', () => {
  it('reads the session id from the same base64url payload as the iat', () => {
    expect(readTokenSessionId(token({ iat: 1_700_000_000, session_id: '>>>' }))).toBe('>>>');
    expect(readTokenSessionId(token({ iat: 1_700_000_001, session_id: '???' }))).toBe('???');
  });

  it('treats a blank session id as missing, so it cannot match a stored blank key', () => {
    expect(readTokenSessionId(token({ session_id: '' }))).toBeNull();
    expect(readTokenSessionId(token({ sub: 'user-1' }))).toBeNull();
  });

  it('does not coerce a non-string session id', () => {
    expect(readTokenSessionId(token({ session_id: 42 }))).toBeNull();
    expect(readTokenSessionId(token({ session_id: null }))).toBeNull();
    expect(readTokenSessionId(token({ session_id: ['sess-A'] }))).toBeNull();
  });

  it('returns the id unchanged, including surrounding spaces', () => {
    // The lookup is an exact key. Trimming here would make a padded claim
    // match a real session.
    expect(readTokenSessionId(token({ session_id: ' sess-A ' }))).toBe(' sess-A ');
  });

  it('returns null, and does not throw, for the same malformed tokens as iat', () => {
    expect(readTokenSessionId(undefined)).toBeNull();
    expect(readTokenSessionId('')).toBeNull();
    expect(readTokenSessionId('not-a-jwt')).toBeNull();
    expect(readTokenSessionId(token([1]))).toBeNull();
    expect(readTokenSessionId('aaa.!!!not-base64!!!.ccc')).toBeNull();
  });
});
