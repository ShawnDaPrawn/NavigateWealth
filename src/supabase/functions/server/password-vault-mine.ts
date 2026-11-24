/**
 * Collection owners (any signed-in staff member whose collection this is) keep
 * their own logins current without being able to read them: list names and
 * dates, replace a password, add a login. They can also decide approvals
 * raised by their own AI connections when the connection allows it.
 */
import { Hono, type Context } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import type { OwnedLogin } from '../../../shared/password-manager.ts';
import { requireAuth } from './auth-mw.ts';
import { body, validateBody } from './validate.ts';
import {
  allSummaries,
  collections,
  encryptFields,
  entries,
  replace,
  revealSecret,
  sealSecret,
  passwordFingerprint,
  sealMetadataPatch,
  isWeak,
  type VaultEntry,
} from './repositories/password-vault.ts';
import { approvals, connections, ownerHistory } from './repositories/vault-store.ts';
import { decide, ownerMayDecide, publicApproval, current } from './vault-approvals.ts';
import { afterDecision } from './vault-runs.ts';
import { recordEvent } from './vault-events.ts';

const app = new Hono();
app.use('*', requireAuth);
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
app.onError((_e, c) => c.json({ error: 'The password manager is unavailable.' }, 503));

const replaceInput = z.object({ password: z.string().min(1).max(8192) });
const addInput = z.object({
  name: z.string().trim().max(200),
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => {
      try {
        const u = new URL(v);
        return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password;
      } catch {
        return false;
      }
    }, 'Enter the website address'),
  username: z.string().max(512),
  password: z.string().min(1).max(8192),
});
const me = (c: Context) => ({
  actorKind: 'person' as const,
  actorId: c.get('userId') as string,
  actorName: (c.get('userEmail') as string | undefined) ?? 'Collection owner',
});

async function ownedCollections(userId: string) {
  return (await collections.listAll('password vault: collections owned by a user')).filter(
    (col) => col.ownerUserId === userId,
  );
}

async function ownedEntry(userId: string, id: string): Promise<VaultEntry | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const entry = await entries.get(id);
  if (!entry?.collectionId) return null;
  const mine = await ownedCollections(userId);
  return mine.some((col) => col.id === entry.collectionId) ? entry : null;
}

app.get('/', async (c) => {
  const mine = new Set((await ownedCollections(c.get('userId') as string)).map((col) => col.id));
  const items: OwnedLogin[] = (await allSummaries())
    .map((r) => r.summary)
    .filter((s) => mine.has(s.collectionId))
    .map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      username: s.username,
      passwordChangedAt: s.passwordChangedAt,
      due: s.health.stale || s.health.exposed,
    }));
  return c.json({ items, hasCollection: mine.size > 0 });
});

app.post('/', validateBody(addInput), async (c) => {
  const [col] = await ownedCollections(c.get('userId') as string);
  if (!col) return c.json({ error: 'You have no collection in the password manager yet.' }, 404);
  const input = body(c, addInput);
  const id = crypto.randomUUID();
  const row: VaultEntry = {
    id,
    revision: crypto.randomUUID(),
    connection: null,
    passwordChangedAt: new Date().toISOString(),
    exposure: [],
    // New logins from owners start as "Find only" until a super admin sets AI access.
    ...(await encryptFields(id, { ...input, notes: '', collectionId: col.id, aiAccess: 'find' })),
  };
  await entries.put(id, row);
  await recordEvent({
    ...me(c),
    action: 'Added own login',
    credentialId: id,
    credentialName: input.name || new URL(input.url).hostname,
    detail: col.name,
    outcome: 'ok',
  });
  return c.json({ id }, 201);
});

app.put('/:id/password', validateBody(replaceInput), async (c) => {
  const userId = c.get('userId') as string;
  const { password } = body(c, replaceInput);
  for (let attempt = 0; attempt < 3; attempt++) {
    const entry = await ownedEntry(userId, c.req.param('id')!);
    if (!entry) return c.json({ error: 'Login not found' }, 404);
    const secret = await revealSecret(entry);
    // Keep the previous password for a week in case the new one fails.
    await ownerHistory.put(entry.id, {
      secret: entry.secret,
      keyRef: entry.keyRef,
      until: Date.now() + 7 * 86400000,
    });
    const next: VaultEntry = {
      ...entry,
      secret: await sealSecret(entry, { ...secret, password }),
      metadata: await sealMetadataPatch(entry, {
        fingerprint: await passwordFingerprint(password),
        weak: isWeak(password),
      }),
      passwordChangedAt: new Date().toISOString(),
      revision: crypto.randomUUID(),
    };
    if (await replace(next, entry.revision)) {
      await recordEvent({
        ...me(c),
        action: 'Replaced own password',
        credentialId: entry.id,
        credentialName: null,
        detail: 'Write-only update by the collection owner',
        outcome: 'ok',
      });
      return c.json({ success: true, passwordChangedAt: next.passwordChangedAt });
    }
  }
  return c.json({ error: 'This login changed meanwhile. Try again.' }, 409);
});

// ── Approvals for the owner's own AI connections ─────────────────────────────
app.get('/approvals', async (c) => {
  const userId = c.get('userId') as string;
  const mine = (await connections.listAll('password vault: owner connections')).filter((conn) =>
    ownerMayDecide(conn, userId),
  );
  const ids = new Set(mine.map((conn) => conn.id));
  const rows = (await approvals.listAll('password vault: owner approvals'))
    .filter((a) => ids.has(a.connectionId) && current(a).state === 'pending')
    .map(publicApproval);
  return c.json({ items: rows });
});
for (const decision of ['approve', 'deny'] as const)
  app.post('/approvals/:aid/' + decision, async (c) => {
    const userId = c.get('userId') as string;
    const row = await approvals.get(c.req.param('aid')!);
    if (!row || !ownerMayDecide(await connections.get(row.connectionId), userId))
      return c.json({ error: 'Request not found' }, 404);
    const result = await decide(row.id, userId, decision);
    if (typeof result === 'string')
      return c.json({ error: 'This request is no longer waiting.' }, 409);
    if (result.runId && result.state !== 'pending')
      await afterDecision(result.runId, result.state === 'approved');
    await recordEvent({
      ...me(c),
      action: decision === 'approve' ? 'Approved' : 'Denied',
      credentialId: result.credentialId,
      credentialName: result.credentialName,
      detail: result.connectionName + ' · ' + result.detail,
      outcome: decision === 'approve' ? 'ok' : 'denied',
    });
    return c.json(publicApproval(result));
  });
export default app;
