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
// refuses input for LOCKOUT_MS. State is persisted to localStorage so a
// page reload does not reset the counter. This is best-effort only — a
// client can always clear its own storage; throttling that cannot be
// reset requires server-side verification.
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;

const THROTTLE_STORAGE_KEY = 'nw.locked.gate';

interface ThrottleState {
  attempts: number;
  lockoutUntil: number;
}

function loadThrottleState(): ThrottleState {
  try {
    const raw = localStorage.getItem(THROTTLE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThrottleState>;
      return {
        attempts: Number(parsed.attempts) || 0,
        lockoutUntil: Number(parsed.lockoutUntil) || 0,
      };
    }
  } catch {
    // Storage unavailable or corrupt — fall through to a clean state.
  }
  return { attempts: 0, lockoutUntil: 0 };
}

function saveThrottleState(state: ThrottleState): void {
  try {
    localStorage.setItem(THROTTLE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — throttle degrades to in-memory for this load.
    memoryThrottleState = state;
  }
}

// Fallback when localStorage is unavailable (e.g. blocked by the browser).
let memoryThrottleState: ThrottleState | null = null;

function getThrottleState(): ThrottleState {
  return memoryThrottleState ?? loadThrottleState();
}

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
  return Math.max(0, getThrottleState().lockoutUntil - Date.now());
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
    saveThrottleState({ attempts: 0, lockoutUntil: 0 });
    return { ok: true };
  }

  const attempts = getThrottleState().attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    saveThrottleState({ attempts: 0, lockoutUntil: Date.now() + LOCKOUT_MS });
    return { ok: false, reason: 'locked-out', remainingMs: LOCKOUT_MS };
  }
  saveThrottleState({ attempts, lockoutUntil: 0 });
  return { ok: false, reason: 'invalid', attemptsLeft: MAX_ATTEMPTS - attempts };
}
