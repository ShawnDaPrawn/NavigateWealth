/**
 * Session revocation on credential change.
 * =========================================
 *
 * WHY THIS EXISTS
 * ---------------
 * Changing a password is the thing a user does when they believe someone else
 * has their credentials. Before this module, it did not end that someone
 * else's session: `auth.admin.updateUserById(userId, { password })` and the
 * client's `auth.updateUser({ password })` both rotate the credential and
 * leave every issued token alive until it expires on its own. The rotation
 * that was supposed to evict the attacker evicted nobody.
 *
 * TWO HALVES, BECAUSE NEITHER IS SUFFICIENT ALONE
 * -----------------------------------------------
 * 1. `revokeGoTrueSessions` — kills the REFRESH tokens at the identity
 *    provider, so a session cannot renew itself once its short-lived access
 *    token expires. This is the real revocation, and it is the half that
 *    keeps working if this application is bypassed entirely.
 *
 *    It needs an access token: GoTrue's `admin.signOut(jwt, scope)` addresses
 *    a session, not a user id. So it can only run on the self-service path,
 *    where the caller IS the account holder and presented their own token.
 *    An administrator resetting someone else's password has no such token.
 *
 * 2. `stampSessionsValidFrom` — writes a watermark onto `security:{userId}`.
 *    `enforceAccountSecurity` (auth-mw.ts) refuses any access token minted
 *    before it, so tokens already in an attacker's hands stop working on the
 *    next request rather than at their natural expiry. This half covers the
 *    admin-reset path, and it closes the up-to-one-hour window that half 1
 *    leaves open even where half 1 runs.
 *
 * Callers do both wherever they can, and half 2 wherever they cannot.
 *
 * NEITHER HALF MAY FAIL THE REQUEST
 * ---------------------------------
 * The password has already been changed by the time these run. Throwing here
 * would report failure for an operation that succeeded, and send the user back
 * to retry a change that has already taken effect — with the old password that
 * no longer works. Both functions swallow their errors and log loudly instead,
 * and both return a boolean so the caller can report partial success.
 *
 * @module server/session-revocation
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { readTokenIssuedAt } from './jwt-claims.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('session-revocation');

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Scope accepted by GoTrue's admin sign-out. */
export type RevocationScope = 'global' | 'others';

/**
 * Write the "no token issued before now is valid" watermark for a user.
 *
 * Merges into the existing `security:{userId}` record rather than replacing
 * it — that record also carries `suspended`, `deleted` and the 2FA state, and
 * a blind overwrite here would silently un-suspend an account as a side effect
 * of changing its password.
 *
 * @returns true when the stamp was persisted.
 */
export async function stampSessionsValidFrom(
  userId: string,
  at: Date = new Date(),
): Promise<boolean> {
  try {
    const existing = ((await kv.get(`security:${userId}`)) ?? {}) as Record<string, unknown>;
    await kv.set(`security:${userId}`, {
      ...existing,
      sessionsValidFrom: at.toISOString(),
      passwordLastChanged: at.toISOString(),
    });
    return true;
  } catch (error) {
    log.error('Failed to stamp sessionsValidFrom — sessions NOT revoked', {
      userId,
      error: getErrMsg(error),
    });
    return false;
  }
}

/**
 * Revoke refresh tokens at GoTrue for the session identified by `accessToken`.
 *
 * `scope: 'others'` keeps the presenting session alive and ends every other
 * one — the right choice when a signed-in user changes their own password and
 * should not be bounced out of the tab they are working in.
 *
 * `scope: 'global'` ends that session too.
 *
 * @returns true when GoTrue accepted the revocation.
 */
export async function revokeGoTrueSessions(
  accessToken: string,
  scope: RevocationScope = 'others',
): Promise<boolean> {
  try {
    const { error } = await getSupabase().auth.admin.signOut(accessToken, scope);
    if (error) {
      log.warn('GoTrue session revocation returned an error', {
        scope,
        error: error.message,
      });
      return false;
    }
    return true;
  } catch (error) {
    log.warn('GoTrue session revocation threw', { scope, error: getErrMsg(error) });
    return false;
  }
}

/**
 * Where the watermark goes when the caller is the account holder.
 *
 * NOT `now`. The caller is holding a token that was minted before this
 * request, so a `now` watermark would refuse their very next call and sign
 * them out of the change they just performed successfully. The line is drawn
 * at their own token's `iat` instead: "every session older than the one that
 * authorised this change is finished, and that one is not."
 *
 * Falls back to `now` when the `iat` cannot be read, because the alternative —
 * writing no watermark at all — leaves the stolen session alive, and being
 * signed out is the far cheaper failure of the two.
 */
function selfServiceWatermark(accessToken: string | undefined): Date {
  const issuedAt = readTokenIssuedAt(accessToken);
  return issuedAt === null ? new Date() : new Date(issuedAt * 1000);
}

/**
 * The whole policy in one call, for a credential change on `userId`.
 *
 * `actor: 'self'`  — the caller IS the account holder and presented
 *                    `accessToken`. Their session survives; every older one
 *                    dies, at GoTrue and at this application's front door.
 * `actor: 'admin'` — someone else changed this user's password. No token for
 *                    the target exists, so GoTrue cannot be asked to revoke;
 *                    the watermark goes at `now` and ends every session the
 *                    user has, which is the intent of an administrative reset.
 */
export async function revokeSessionsAfterCredentialChange(options: {
  userId: string;
  actor: 'self' | 'admin';
  accessToken?: string;
  scope?: RevocationScope;
}): Promise<{ stamped: boolean; goTrueRevoked: boolean; validFrom: string }> {
  const { userId, actor, accessToken, scope = 'others' } = options;

  const validFrom = actor === 'self' ? selfServiceWatermark(accessToken) : new Date();

  const stamped = await stampSessionsValidFrom(userId, validFrom);
  const goTrueRevoked =
    actor === 'self' && accessToken ? await revokeGoTrueSessions(accessToken, scope) : false;

  log.info('Sessions revoked after credential change', {
    userId,
    actor,
    stamped,
    goTrueRevoked,
    validFrom: validFrom.toISOString(),
  });

  return { stamped, goTrueRevoked, validFrom: validFrom.toISOString() };
}
