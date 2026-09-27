/**
 * Two-factor verifications, recorded per SIGN-IN rather than per account.
 * ======================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * The account-security gate used to read one field, `last2faVerifiedAt`, off
 * `security:{userId}`, and let ANY token for that account through for three
 * hours after it. The verification belonged to the account, not to the sign-in
 * that performed it. So an attacker holding a stolen password signed in, and
 * — if the real account holder had passed 2FA at any point in the previous
 * three hours, which on a working day is nearly always — was never asked for a
 * code at all. Two-factor protected only accounts whose owners were not using
 * them.
 *
 * Verifications are now keyed by GoTrue's `session_id` claim, which identifies
 * one sign-in and survives token refreshes. A new sign-in starts unverified
 * whatever any other session did. The three-hour window still applies, within
 * a session.
 *
 * SHAPE
 * -----
 * One record per user — `2fa_sessions:{userId}` — mapping session id to the
 * ISO time it verified. Entries past the grace window are pruned on every
 * write, so the record stays as small as the user's live sessions.
 *
 * @module server/repositories/two-factor-session-repository
 */
import { createKvRepository } from './kv-repository.ts';

/** How long one successful verification keeps a session unlocked. */
export const TWO_FACTOR_GRACE_MS = 3 * 60 * 60 * 1000;

/** GoTrue session id → ISO timestamp of that session's last verification. */
export type TwoFactorSessionMap = Record<string, string>;

export const TWO_FACTOR_SESSION_NAMESPACE = '2fa_sessions:';

const sessions = createKvRepository<TwoFactorSessionMap>(TWO_FACTOR_SESSION_NAMESPACE);

/**
 * When `sessionId` last passed 2FA for `userId`, in epoch ms, or null.
 * Throws when the store cannot be read — the caller decides how to fail.
 */
export async function sessionTwoFactorVerifiedAt(
  userId: string,
  sessionId: string,
): Promise<number | null> {
  const record = await sessions.get(userId);
  const stamp = record?.[sessionId];
  if (typeof stamp !== 'string') return null;
  const at = Date.parse(stamp);
  return Number.isFinite(at) ? at : null;
}

/** Record that `sessionId` has just passed 2FA, pruning expired entries. */
export async function recordSessionTwoFactor(
  userId: string,
  sessionId: string,
  at: Date = new Date(),
): Promise<void> {
  const existing = (await sessions.get(userId)) ?? {};
  const next: TwoFactorSessionMap = {};
  for (const [id, stamp] of Object.entries(existing)) {
    const when = Date.parse(stamp);
    if (Number.isFinite(when) && at.getTime() - when < TWO_FACTOR_GRACE_MS) next[id] = stamp;
  }
  next[sessionId] = at.toISOString();
  await sessions.put(userId, next);
}

/** Forget every verified session for `userId` (e.g. when 2FA is switched off). */
export async function clearSessionTwoFactor(userId: string): Promise<void> {
  await sessions.remove(userId);
}
