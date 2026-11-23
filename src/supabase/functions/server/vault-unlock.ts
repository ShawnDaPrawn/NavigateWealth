/**
 * The vault opens only for a session that has just passed two-factor (the
 * platform's existing email-code flow records the verifying session), then
 * stays open while it is used and locks after 15 idle minutes.
 */
import type { Context, Next } from 'npm:hono';
import type { VaultLockState } from '../../../shared/password-manager.ts';
import { readTokenSessionId } from './jwt-claims.ts';
import { stripBearerPrefix } from './bearer-token.ts';
import { sessionTwoFactorVerifiedAt } from './repositories/two-factor-session-repository.ts';
import { createKvRepository } from './repositories/kv-repository.ts';
import { unlocks } from './repositories/vault-store.ts';

export const IDLE_MS = 15 * 60 * 1000;
export const FRESH_VERIFY_MS = 5 * 60 * 1000;
const security = createKvRepository<{ twoFactorEnabled?: boolean }>('security:');

function identity(c: Context) {
  const userId = c.get('userId') as string | undefined;
  const sessionId = readTokenSessionId(stripBearerPrefix(c.req.header('Authorization')));
  return userId && sessionId ? { userId, sessionId, key: userId + ':' + sessionId } : null;
}

export async function lockState(c: Context): Promise<VaultLockState> {
  const id = identity(c);
  const twoFactorEnabled = Boolean(id && (await security.get(id.userId))?.twoFactorEnabled);
  const record = id ? await unlocks.get(id.key) : null;
  const unlocked = Boolean(twoFactorEnabled && record && Date.now() - record.lastActive < IDLE_MS);
  return {
    unlocked,
    twoFactorEnabled,
    expiresAt: unlocked ? new Date(record!.lastActive + IDLE_MS).toISOString() : null,
  };
}

/** Opens the vault when this session verified two-factor in the last five minutes. */
export async function unlock(c: Context): Promise<VaultLockState | 'verify' | 'no2fa'> {
  const id = identity(c);
  if (!id || !(await security.get(id.userId))?.twoFactorEnabled) return 'no2fa';
  const verifiedAt = await sessionTwoFactorVerifiedAt(id.userId, id.sessionId);
  if (!verifiedAt || Date.now() - verifiedAt > FRESH_VERIFY_MS) return 'verify';
  await unlocks.put(id.key, { lastActive: Date.now() });
  return lockState(c);
}

export async function lock(c: Context) {
  const id = identity(c);
  if (id) await unlocks.remove(id.key);
}

/** Middleware: 423 until the vault is unlocked; keeps an open vault alive while used. */
export async function requireUnlocked(c: Context, next: Next) {
  const id = identity(c);
  const record = id ? await unlocks.get(id.key) : null;
  if (!id || !record || Date.now() - record.lastActive >= IDLE_MS)
    return c.json({ error: 'The password manager is locked.', code: 'VAULT_LOCKED' }, 423);
  if (Date.now() - record.lastActive > 60_000)
    await unlocks.put(id.key, { lastActive: Date.now() });
  await next();
}
