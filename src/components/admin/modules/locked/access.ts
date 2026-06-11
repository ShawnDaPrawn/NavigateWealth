/**
 * Locked module access control.
 *
 * The access code is NEVER stored in this codebase or shipped to the
 * browser in plaintext. Only its SHA-256 digest lives here; whatever the
 * user types is hashed locally and compared against the digest. The code
 * can therefore only be changed by editing ACCESS_CODE_SHA256 below
 * (hash the new code with: printf '%s' 'NewCode' | sha256sum).
 *
 * The unlocked state is held in component memory only — it is never
 * written to localStorage, sessionStorage, cookies, or the URL, so
 * navigating away from the tab or refreshing the page re-locks it.
 */

// SHA-256 digest (hex) of the current access code.
const ACCESS_CODE_SHA256 = '1266f8ee2561d7b4e653ae40a4d217d56e9decc7d5cf9a48ac7eb243b7460a19';

// Brute-force throttle: after MAX_ATTEMPTS consecutive failures the gate
// refuses input for LOCKOUT_MS. Tracked at module scope so remounting the
// component (navigating away and back) does not reset the counter.
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;

let failedAttempts = 0;
let lockoutUntil = 0;

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Timing-safe comparison of two equal-length hex strings. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Milliseconds remaining in the current lockout window (0 when not locked out). */
export function getLockoutRemaining(): number {
  return Math.max(0, lockoutUntil - Date.now());
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  | { ok: false; reason: 'locked-out'; remainingMs: number };

export async function verifyAccessCode(input: string): Promise<VerifyResult> {
  const remainingMs = getLockoutRemaining();
  if (remainingMs > 0) {
    return { ok: false, reason: 'locked-out', remainingMs };
  }

  const hash = await sha256Hex(input);
  if (constantTimeEqual(hash, ACCESS_CODE_SHA256)) {
    failedAttempts = 0;
    return { ok: true };
  }

  failedAttempts += 1;
  if (failedAttempts >= MAX_ATTEMPTS) {
    failedAttempts = 0;
    lockoutUntil = Date.now() + LOCKOUT_MS;
    return { ok: false, reason: 'locked-out', remainingMs: LOCKOUT_MS };
  }
  return { ok: false, reason: 'invalid', attemptsLeft: MAX_ATTEMPTS - failedAttempts };
}
