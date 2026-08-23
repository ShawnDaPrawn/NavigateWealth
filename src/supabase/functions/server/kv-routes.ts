/**
 * Generic KV reader (SECURITY-AUDIT S4)
 * =====================================
 *
 * This router exposes ONE route that returns any KV value by key. That is an
 * unusually powerful capability: the store holds client profiles, security
 * records, e-sign state and — until the platform certificate finishes moving to
 * an environment secret — the PDF signing private key and its passphrase.
 *
 * Three controls, because the first one alone was not enough:
 *
 *   1. **Super-admin, not admin.** The route previously required `admin`, and
 *      the audit's finding was precisely that: an `admin` is not the same
 *      principal as the owner, and any one of them could read the signing key
 *      and forge signatures indistinguishable from genuine ones. This is a
 *      break-glass debugging tool, so it takes the strongest role available.
 *   2. **A denylist for secret-bearing namespaces.** Role checks protect
 *      against the wrong person; they do nothing about the wrong key. Anything
 *      matching a secret namespace is refused outright, so the signing key is
 *      not readable through this route by ANY caller, super-admin included.
 *      Defence in depth, and it survives a future role mistake.
 *   3. **An audit entry per read.** A break-glass tool that leaves no record is
 *      how a key exfiltration becomes unattributable after the fact.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { requireSuperAdmin } from './auth-mw.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const app = new Hono();
const log = createModuleLogger('kv');

/**
 * Key prefixes this route will never return, whatever the caller's role.
 *
 * Matched case-insensitively against the START of the requested key. Add a
 * prefix here whenever a namespace starts holding a credential; the test suite
 * asserts each entry stays refused.
 */
const SECRET_KEY_PREFIXES = [
  'esign_config:', // platform signing certificate (private key + passphrase)
  'esign_signing_key',
  'smtp_config:',
  'api_credentials:',
  'integration_secrets:',
  'provider_portal_credentials:',
];

function isSecretKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return SECRET_KEY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

// SECURITY: a generic KV reader exposes the entire datastore. It must never be
// reachable unauthenticated, and `admin` is not a strong enough principal for
// it — see the header note.
app.use('*', requireSuperAdmin);

// Root route - helpful for debugging
app.get('/', (c) => {
  return c.json({
    message: 'KV Store API',
    usage: 'GET /:key to retrieve a value',
    example: '/kv-store/user_profile%3A123%3Aclient_keys',
  });
});

// GET /:key - Get a value from the KV store
app.get('/:key', async (c) => {
  try {
    const key = c.req.param('key')!;

    if (!key) {
      return c.json({ error: 'Missing key' }, 400);
    }

    const actorId = (c.get('userId') as string | undefined) ?? 'unknown';
    const actorRole = (c.get('userRole') as string | undefined) ?? 'unknown';

    if (isSecretKey(key)) {
      log.warn('Refused KV read of a secret-bearing key', { key, actorId });
      await AdminAuditService.record({
        actorId,
        actorRole,
        category: 'security',
        action: 'kv_secret_read_denied',
        summary: `Denied read of secret-bearing KV key "${key}"`,
        severity: 'critical',
        entityType: 'kv_key',
        entityId: key,
      });
      return c.json(
        {
          error: 'This key holds credentials and cannot be read through the KV API',
          code: 'FORBIDDEN_SECRET_KEY',
        },
        403,
      );
    }

    log.info(`Fetching key: ${key}`);

    const value = await kv.get(key);

    if (value === null || value === undefined) {
      log.warn(`Key not found: ${key}`);
      return c.json({ error: 'Key not found', key }, 404);
    }

    // Recorded AFTER the value is known to exist, so the log reflects reads that
    // actually returned data rather than probes for keys that do not exist.
    await AdminAuditService.record({
      actorId,
      actorRole,
      category: 'security',
      action: 'kv_read',
      summary: `Read KV key "${key}" through the generic KV API`,
      severity: 'warning',
      entityType: 'kv_key',
      entityId: key,
    });

    log.info(`Key found: ${key}`);
    return c.json({ key, value });
  } catch (e) {
    log.error('Error fetching from KV:', e);
    return c.json({ error: 'Failed to fetch value', details: String(e) }, 500);
  }
});

export default app;
