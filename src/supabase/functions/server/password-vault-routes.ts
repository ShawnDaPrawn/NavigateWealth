import { Hono, type Context } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { Buffer } from 'node:buffer';
import { BROKERAGE_COLLECTION_ID, type CredentialInput } from '../../../shared/password-manager.ts';
import { requireSuperAdmin } from './auth-mw.ts';
import { body, validateBody } from './validate.ts';
import {
  allSummaries,
  collections,
  createCollection,
  encryptFields,
  ensureBrokerage,
  entries,
  passwordFingerprint,
  publicCollection,
  replace,
  revealSecret,
  summary,
  VaultInputError,
  type VaultEntry,
} from './repositories/password-vault.ts';
import { workflows } from './repositories/vault-store.ts';
import { sha256Hex } from './sha256.ts';
import { profile, allowedUrl } from './broker-ops-model.ts';
import { verifyBrokerLinks } from './repositories/broker-ops.ts';
import { lock, lockState, requireUnlocked, unlock } from './vault-unlock.ts';
import { recordEvent } from './vault-events.ts';
import { isValidOtpSecret, totp } from './vault-totp.ts';
import aiRoutes from './password-vault-ai-routes.ts';

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
    kind: z.enum(['login', 'api_key', 'note', 'recovery_codes']).optional(),
    collectionId: z.string().max(40).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    category: z.string().trim().max(60).optional(),
    aiAccess: z.enum(['never', 'find', 'use', 'reveal']).optional(),
    askFirst: z.boolean().optional(),
    rotateMonths: z.number().int().min(0).max(60).optional(),
    otpSecret: z
      .string()
      .max(200)
      .refine((v) => !v || isValidOtpSecret(v), 'Enter the setup key exactly as the site shows it')
      .optional(),
  })
  .refine(
    (input) => !input.portal || allowedUrl(input.url, input.portal.provider, true),
    'Login URL must match the selected provider',
  );
const batch = z.object({ entries: z.array(credential).min(1).max(100) });
const revision = z.object({ revision: z.uuid() });
const edit = revision.extend({
  credential,
  clearPortal: z.boolean().optional(),
  clearOtp: z.boolean().optional(),
});
const move = revision.extend({ collectionId: z.string().min(1).max(40) });
const collectionInput = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['brokerage', 'person']),
  ownerUserId: z.uuid().nullable(),
  ownerName: z.string().trim().max(120),
});

const app = new Hono();
app.use('*', requireSuperAdmin);
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
app.onError((err, c) =>
  err instanceof VaultInputError
    ? c.json({ error: err.message }, 400)
    : c.json(
        { error: 'Vault unavailable. Check the vault encryption key and storage configuration.' },
        503,
      ),
);
const missing = (c: Context) => c.json({ error: 'Credential not found' }, 404);
const conflict = (c: Context) =>
  c.json({ error: 'This credential changed. Refresh the list and try again.' }, 409);
const me = (c: Context) => ({
  actorKind: 'person' as const,
  actorId: c.get('userId') as string,
  actorName: (c.get('userEmail') as string | undefined) ?? 'Super admin',
});

// ── Lock state: before the unlock gate ───────────────────────────────────────
app.get('/status', async (c) => c.json(await lockState(c)));
app.post('/unlock', async (c) => {
  const result = await unlock(c);
  if (result === 'no2fa')
    return c.json(
      {
        error: 'Turn on two-factor for your account to open the password manager.',
        code: 'TWO_FACTOR_REQUIRED',
      },
      403,
    );
  if (result === 'verify')
    return c.json({ error: 'Enter a fresh two-factor code first.', code: 'VERIFY_REQUIRED' }, 428);
  await recordEvent({
    ...me(c),
    action: 'Unlocked vault',
    credentialId: null,
    credentialName: null,
    detail: 'Two-factor code',
    outcome: 'ok',
  });
  return c.json(result);
});
app.post('/lock', async (c) => {
  await lock(c);
  return c.json({ success: true });
});
app.use('*', requireUnlocked);

// ── AI connections, approvals, workflows, runs, activity ─────────────────────
app.route('/', aiRoutes);

// ── Collections ──────────────────────────────────────────────────────────────
app.get('/collections', async (c) => {
  await ensureBrokerage();
  const [rows, all] = await Promise.all([
    collections.listAll('password vault: collections'),
    allSummaries(),
  ]);
  return c.json({
    items: rows
      .map((row) => ({
        ...publicCollection(row),
        count: all.filter((r) => r.summary.collectionId === row.id).length,
      }))
      .sort((a, b) =>
        a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'brokerage' ? -1 : 1,
      ),
  });
});
app.post('/collections', validateBody(collectionInput), async (c) => {
  const row = await createCollection(body(c, collectionInput));
  await recordEvent({
    ...me(c),
    action: 'Created collection',
    credentialId: null,
    credentialName: null,
    detail: row.name,
    outcome: 'ok',
  });
  return c.json(publicCollection(row), 201);
});
app.put('/collections/:cid', validateBody(collectionInput.omit({ kind: true })), async (c) => {
  const row = await collections.get(c.req.param('cid')!);
  if (!row) return c.json({ error: 'Collection not found' }, 404);
  const next = { ...row, ...body(c, collectionInput.omit({ kind: true })) };
  await collections.put(row.id, next);
  return c.json(publicCollection(next));
});
app.delete('/collections/:cid', async (c) => {
  const id = c.req.param('cid')!;
  if (id === BROKERAGE_COLLECTION_ID)
    return c.json({ error: 'The Brokerage collection cannot be deleted.' }, 400);
  if ((await allSummaries()).some((r) => r.summary.collectionId === id))
    return c.json({ error: 'Move or delete this collection’s logins first.' }, 409);
  await collections.remove(id);
  return c.json({ success: true });
});

// ── Credentials ──────────────────────────────────────────────────────────────
const reserved = new Set([
  'collections',
  'connections',
  'approvals',
  'workflows',
  'runs',
  'events',
]);
app.use('/:id/*', async (c, next) => {
  const id = c.req.param('id')!;
  if (!reserved.has(id) && !z.uuid().safeParse(id).success) return missing(c);
  await next();
});

async function assertCollection(id: string | undefined) {
  if (!id || id === BROKERAGE_COLLECTION_ID) return;
  if (!(await collections.get(id))) throw new VaultInputError('Unknown collection');
}

/** Everything needed to re-seal an entry, with any field replaced by `patch`. */
async function asInput(
  entry: VaultEntry,
  patch: Partial<CredentialInput> = {},
): Promise<CredentialInput> {
  const [s, secret] = await Promise.all([summary(entry), revealSecret(entry)]);
  return {
    name: s.name,
    url: s.url,
    username: s.username,
    password: secret.password,
    notes: secret.notes,
    portal: s.portal,
    kind: s.kind,
    collectionId: s.collectionId,
    tags: s.tags,
    category: s.category,
    aiAccess: s.aiAccess,
    askFirst: s.askFirst,
    rotateMonths: s.rotateMonths,
    otpSecret: secret.otpSecret,
    ...patch,
  };
}

app.get('/', async (c) => {
  const collection = c.req.query('collection');
  const rows = (await allSummaries()).map((r) => r.summary);
  return c.json({
    items: rows.filter((s) => !collection || s.collectionId === collection),
    nextCursor: null,
  });
});
app.post('/', validateBody(batch), async (c) => {
  const incoming = body(c, batch).entries;
  if (
    !(
      await Promise.all(incoming.map((i) => (i.portal ? verifyBrokerLinks(i.portal) : true)))
    ).every(Boolean)
  )
    return c.json({ error: 'Select an existing broker' }, 400);
  for (const i of incoming) await assertCollection(i.collectionId);
  const now = new Date().toISOString();
  const rows = await Promise.all(
    incoming.map(async (input) => {
      const id = crypto.randomUUID();
      const row: VaultEntry = {
        id,
        revision: crypto.randomUUID(),
        connection: null,
        passwordChangedAt: now,
        exposure: [],
        ...(await encryptFields(id, input)),
      };
      return [id, row] as const;
    }),
  );
  await entries.putMany(rows);
  await recordEvent({
    ...me(c),
    action: 'Added logins',
    credentialId: rows.length === 1 ? rows[0][0] : null,
    credentialName:
      rows.length === 1 ? incoming[0].name || new URL(incoming[0].url).hostname : null,
    detail: rows.length + ' added',
    outcome: 'ok',
  });
  return c.json({ count: rows.length }, 201);
});
app.post('/:id/reveal', async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  const [s, secret] = await Promise.all([summary(entry), revealSecret(entry)]);
  await recordEvent({
    ...me(c),
    action: 'Showed password',
    credentialId: entry.id,
    credentialName: s.name,
    detail: 'From the vault',
    outcome: 'ok',
  });
  return c.json({ ...s, password: secret.password, notes: secret.notes });
});
app.post('/:id/otp', async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  const secret = await revealSecret(entry);
  if (!secret.otpSecret) return c.json({ error: 'No one-time code saved for this login.' }, 404);
  return c.json(await totp(secret.otpSecret));
});
app.put('/:id', validateBody(edit), async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  const input = body(c, edit);
  if (input.credential.portal && !(await verifyBrokerLinks(input.credential.portal)))
    return c.json({ error: 'Select an existing broker' }, 400);
  const before = await asInput(entry);
  const changedPassword =
    (await passwordFingerprint(input.credential.password)) !==
    (await passwordFingerprint(before.password));
  const updated: VaultEntry = {
    ...entry,
    ...(await encryptFields(entry.id, {
      ...input.credential,
      collectionId: before.collectionId,
      otpSecret: input.clearOtp ? undefined : input.credential.otpSecret || before.otpSecret,
      portal: input.credential.portal ?? (input.clearPortal ? undefined : before.portal),
    })),
    passwordChangedAt: changedPassword
      ? new Date().toISOString()
      : (entry.passwordChangedAt ?? null),
    revision: crypto.randomUUID(),
  };
  if (!(await replace(updated, input.revision))) return conflict(c);
  await recordEvent({
    ...me(c),
    action: changedPassword ? 'Changed password' : 'Edited login',
    credentialId: entry.id,
    credentialName: input.credential.name || before.name,
    detail: '',
    outcome: 'ok',
  });
  return c.json({ success: true });
});
app.post('/:id/move', validateBody(move), async (c) => {
  const entry = await entries.get(c.req.param('id')!);
  if (!entry) return missing(c);
  const { collectionId, revision: expected } = body(c, move);
  await assertCollection(collectionId);
  const input = await asInput(entry, { collectionId });
  const updated: VaultEntry = {
    ...entry,
    ...(await encryptFields(entry.id, input)),
    revision: crypto.randomUUID(),
  };
  if (!(await replace(updated, expected))) return conflict(c);
  await recordEvent({
    ...me(c),
    action: 'Moved login',
    credentialId: entry.id,
    credentialName: input.name,
    detail: 'To ' + ((await collections.get(collectionId))?.name ?? collectionId),
    outcome: 'ok',
  });
  return c.json({ success: true });
});
app.delete('/:id', async (c) => {
  const id = c.req.param('id')!;
  if (!z.uuid().safeParse(id).success) return missing(c);
  const entry = await entries.get(id);
  await entries.remove(id);
  const owned = (await workflows.listAll('password vault: workflows of a deleted login')).filter(
    (w) => w.credentialId === id,
  );
  if (owned.length) await workflows.removeMany(owned.map((w) => w.id));
  await recordEvent({
    ...me(c),
    action: 'Deleted login',
    credentialId: id,
    credentialName: entry ? (await summary(entry)).name : null,
    detail: '',
    outcome: 'ok',
  });
  return c.json({ success: true });
});

// ── Legacy single-login MCP tokens (kept until they expire) ──────────────────
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
  await recordEvent({
    ...me(c),
    action: 'Created single-login token',
    credentialId: entry.id,
    credentialName: null,
    detail: '',
    outcome: 'ok',
  });
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
  await recordEvent({
    ...me(c),
    action: 'Revoked single-login token',
    credentialId: entry.id,
    credentialName: null,
    detail: '',
    outcome: 'ok',
  });
  return c.json({ success: true });
});
export default app;
