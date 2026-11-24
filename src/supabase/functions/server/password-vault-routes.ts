import { Hono, type Context } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import type { CredentialInput } from '../../../shared/password-manager.ts';
import { requireSuperAdmin } from './auth-mw.ts';
import { body, validateBody } from './validate.ts';
import {
  allSummaries,
  encryptFields,
  entries,
  passwordFingerprint,
  replace,
  revealSecret,
  summary,
  VaultInputError,
  type VaultEntry,
} from './repositories/password-vault.ts';
import { skills } from './repositories/vault-store.ts';
import { lock, lockState, requireUnlocked, unlock } from './vault-unlock.ts';
import { recordEvent } from './vault-events.ts';
import { isValidOtpSecret, totp } from './vault-totp.ts';
import { serviceExists } from './vault-skills.ts';
import aiRoutes from './password-vault-ai-routes.ts';

const credential = z.object({
  serviceId: z.string().min(1, 'Choose the service this login is for').max(60),
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
    }, 'Enter the website address, starting with https://'),
  username: z.string().max(512),
  password: z.string().min(1, 'Enter the password').max(8192),
  notes: z.string().max(8192),
  aiUse: z.enum(['off', 'ask', 'allowed']).optional(),
  rotateMonths: z.number().int().min(0).max(60).optional(),
  otpSecret: z
    .string()
    .max(200)
    .refine((v) => !v || isValidOtpSecret(v), 'Enter the setup key exactly as the site shows it')
    .optional(),
});
const batch = z.object({ entries: z.array(credential).min(1).max(100) });
const revision = z.object({ revision: z.uuid() });
const edit = revision.extend({
  // An empty password and absent notes keep what is saved, so editing a login
  // never means retyping its secrets.
  credential: credential.extend({
    password: z.string().max(8192),
    notes: z.string().max(8192).optional(),
  }),
  clearOtp: z.boolean().optional(),
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

// ── Services, skills, AI agents, approvals, activity ─────────────────────────
app.route('/', aiRoutes);

// ── Credentials ──────────────────────────────────────────────────────────────
const reserved = new Set(['connections', 'approvals', 'services', 'skills', 'events']);
app.use('/:id/*', async (c, next) => {
  const id = c.req.param('id')!;
  if (!reserved.has(id) && !z.uuid().safeParse(id).success) return missing(c);
  await next();
});

async function assertService(id: string) {
  if (!(await serviceExists(id))) throw new VaultInputError('Choose a service that exists');
}

/** Everything needed to re-seal an entry, with any field replaced by `patch`. */
async function asInput(
  entry: VaultEntry,
  patch: Partial<CredentialInput> = {},
): Promise<CredentialInput> {
  const [s, secret] = await Promise.all([summary(entry), revealSecret(entry)]);
  return {
    serviceId: s.serviceId,
    name: s.name,
    url: s.url,
    username: s.username,
    password: secret.password,
    notes: secret.notes,
    collectionId: s.collectionId,
    aiUse: s.aiUse,
    rotateMonths: s.rotateMonths,
    otpSecret: secret.otpSecret,
    ...patch,
  };
}

app.get('/', async (c) => {
  const service = c.req.query('service');
  const rows = (await allSummaries()).map((r) => r.summary);
  return c.json({
    items: rows
      .filter((s) => !service || s.serviceId === service)
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
});
app.post('/', validateBody(batch), async (c) => {
  const incoming = body(c, batch).entries;
  for (const id of new Set(incoming.map((i) => i.serviceId))) await assertService(id);
  const now = new Date().toISOString();
  const rows = await Promise.all(
    incoming.map(async (input) => {
      const id = crypto.randomUUID();
      const row: VaultEntry = {
        id,
        revision: crypto.randomUUID(),
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
  return c.json({ count: rows.length, ids: rows.map(([id]) => id) }, 201);
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
  await assertService(input.credential.serviceId);
  const before = await asInput(entry);
  const password = input.credential.password || before.password;
  const changedPassword =
    (await passwordFingerprint(password)) !== (await passwordFingerprint(before.password));
  const updated: VaultEntry = {
    ...entry,
    ...(await encryptFields(entry.id, {
      ...input.credential,
      password,
      notes: input.credential.notes ?? before.notes,
      collectionId: before.collectionId,
      otpSecret: input.clearOtp ? undefined : input.credential.otpSecret || before.otpSecret,
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
app.delete('/:id', async (c) => {
  const id = c.req.param('id')!;
  if (!z.uuid().safeParse(id).success) return missing(c);
  const entry = await entries.get(id);
  await entries.remove(id);
  const owned = (await skills.listAll('password vault: skills of a deleted login')).filter(
    (s) => s.credentialId === id,
  );
  if (owned.length) await skills.removeMany(owned.map((s) => s.id));
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

export default app;
