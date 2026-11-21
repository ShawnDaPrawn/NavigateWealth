import { Hono, type Context } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { Buffer } from 'node:buffer';
import { requireSuperAdmin } from './auth-mw.ts';
import { body, validateBody } from './validate.ts';
import { entries, encryptFields, replace, reveal, summary } from './repositories/password-vault.ts';
import { sha256Hex } from './sha256.ts';
import { AdminAuditService } from './admin-audit-service.ts';

import { profile, allowedUrl } from './broker-ops-model.ts';
import { verifyBrokerLinks } from './repositories/broker-ops.ts';
const credential = z
  .object({
    name: z.string().trim().max(200),
    url: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
        } catch {
          return false;
        }
      }, 'Enter an HTTP or HTTPS URL without embedded login details'),
    username: z.string().max(512),
    password: z.string().min(1).max(8192),
    notes: z.string().max(8192),
    portal: profile.optional(),
  })
  .refine(
    (input) => !input.portal || allowedUrl(input.url, input.portal.provider, true),
    'Login URL must match the selected provider',
  );
const batch = z.object({ entries: z.array(credential).min(1).max(100) });
const revision = z.object({ revision: z.uuid() });
const edit = revision.extend({ credential, clearPortal: z.boolean().optional() });
const app = new Hono();
app.use('*', requireSuperAdmin);
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
app.onError((_err, c) =>
  c.json(
    { error: 'Vault unavailable. Check the vault encryption key and storage configuration.' },
    503,
  ),
);
const missing = (c: Context) => c.json({ error: 'Credential not found' }, 404);
const conflict = (c: Context) =>
  c.json({ error: 'This credential changed. Refresh the list and try again.' }, 409);
function audit(c: Context, action: string, id?: string) {
  return AdminAuditService.record({
    category: 'security',
    actorId: c.get('userId'),
    actorRole: 'super_admin',
    action: 'password_vault_' + action,
    summary: 'Password vault ' + action,
    entityType: 'vault_entry',
    entityId: id,
  });
}

app.use('/:id/*', async (c, next) => {
  if (!z.uuid().safeParse(c.req.param('id')).success) return missing(c);
  await next();
});

app.get('/', async (c) => {
  const after = c.req.query('after');
  if (after && !z.uuid().safeParse(after).success) return c.json({ error: 'Invalid cursor' }, 400);
  const page = await entries.list({
    limit: 50,
    startAfter: after ? entries.key(after) : undefined,
  });
  return c.json({
    items: await Promise.all(page.items.map(summary)),
    nextCursor: page.nextCursor ? page.items.at(-1)?.id : null,
  });
});
app.post('/', validateBody(batch), async (c) => {
  const incoming = body(c, batch).entries;
  if (
    !(
      await Promise.all(
        incoming.map((input) => (input.portal ? verifyBrokerLinks(input.portal) : true)),
      )
    ).every(Boolean)
  )
    return c.json({ error: 'Select an existing broker' }, 400);
  const rows = await Promise.all(
    body(c, batch).entries.map(async (input) => {
      const id = crypto.randomUUID();
      return [
        id,
        {
          id,
          revision: crypto.randomUUID(),
          connection: null,
          ...(await encryptFields(id, input)),
        },
      ] as const;
    }),
  );
  await entries.putMany(rows);
  await audit(c, 'created');
  return c.json({ count: rows.length }, 201);
});
app.post('/:id/reveal', async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  const secret = await reveal(entry);
  await audit(c, 'revealed', entry.id);
  return c.json({ ...(await summary(entry)), ...secret });
});
app.put('/:id', validateBody(edit), async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  const input = body(c, edit);
  if (input.credential.portal && !(await verifyBrokerLinks(input.credential.portal)))
    return c.json({ error: 'Select an existing broker' }, 400);
  const updated = {
    ...entry,
    ...(await encryptFields(entry.id, {
      ...input.credential,
      portal:
        input.credential.portal ?? (input.clearPortal ? undefined : (await summary(entry)).portal),
    })),
    revision: crypto.randomUUID(),
  };
  if (!(await replace(updated, input.revision))) return conflict(c);
  await audit(c, 'updated', entry.id);
  return c.json({ success: true });
});
app.delete('/:id', async (c) => {
  if (!z.uuid().safeParse(c.req.param('id')).success) return missing(c);
  await entries.remove(c.req.param('id'));
  await audit(c, 'deleted', c.req.param('id'));
  return c.json({ success: true });
});
app.post('/:id/connect', validateBody(revision), async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  const token =
    'nwv_' +
    entry.id +
    '.' +
    Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const connection = {
    hash: await sha256Hex(token),
    expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
  };
  if (
    !(await replace(
      { ...entry, connection, revision: crypto.randomUUID() },
      body(c, revision).revision,
    ))
  )
    return conflict(c);
  await audit(c, 'connected', entry.id);
  return c.json({ token, expiresAt: connection.expiresAt }, 201);
});
app.post('/:id/revoke', validateBody(revision), async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  if (
    !(await replace(
      { ...entry, connection: null, revision: crypto.randomUUID() },
      body(c, revision).revision,
    ))
  )
    return conflict(c);
  await audit(c, 'revoked', entry.id);
  return c.json({ success: true });
});
export default app;
