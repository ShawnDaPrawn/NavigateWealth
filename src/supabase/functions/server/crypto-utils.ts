/**
 * Shared cryptographic helpers.
 *
 * Centralizes two primitives that were previously re-implemented (or missing)
 * across the server, so secret comparisons and one-time-code generation are
 * consistently safe:
 *   - constantTimeEqual: timing-safe string comparison for secrets/tokens/hashes.
 *   - secureRandomDigits: CSPRNG-backed numeric codes (OTPs) with no modulo bias.
 */

/**
 * Constant-time string comparison. Returns false on length mismatch or type
 * mismatch. Use for ALL secret/token/hash comparisons to avoid leaking
 * information through early-exit timing (CWE-208).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generate a cryptographically secure numeric string of the given length.
 * Uses crypto.getRandomValues with rejection sampling so every digit is
 * uniformly distributed (no modulo bias). Replaces Math.random()-based codes,
 * which are predictable and unsuitable for security tokens (CWE-338).
 */
export function secureRandomDigits(length: number): string {
  const digits = '0123456789';
  // Largest multiple of 10 that fits in a byte (250); reject 250–255 to keep
  // the distribution uniform.
  const limit = 256 - (256 % digits.length);
  const buf = new Uint8Array(1);
  let out = '';
  while (out.length < length) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) {
      out += digits[buf[0] % digits.length];
    }
  }
  return out;
}
