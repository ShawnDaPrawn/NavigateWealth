/**
 * Super admin routes for services, skills, AI agents (connections), approvals
 * and activity. Mounted inside password-vault-routes.ts, after its unlock gate.
 */
import { Hono, type Context } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { Buffer } from 'node:buffer';
import { NAVIGATE_WEALTH_SERVICE_ID } from '../../../shared/password-manager.ts';
import { requireSuperAdmin } from './auth-mw.ts';
import { body, validateBody } from './validate.ts';
import { allSummaries, entries, summary } from './repositories/password-vault.ts';
import { connections, services, settings, skills } from './repositories/vault-store.ts';
import { sha256Hex } from './sha256.ts';
import { requireUnlocked } from './vault-unlock.ts';
import {
  issueConnection,
  patchConnection,
  publicConnection,
  updateConnection,
} from './vault-connections.ts';
import { decide, listApprovals, publicApproval } from './vault-approvals.ts';
import { recordEvent, listEvents } from './vault-events.ts';
import {
  allServices,
  allSkills,
  createService,
  createSkill,
  serviceExists,
  serviceInput,
  skillInput,
  updateSkill,
} from './vault-skills.ts';

const callback = z
  .string()
  .max(2048)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password && !u.hash;
    } catch {
      return false;
    }
  }, 'Enter the HTTPS callback URL the AI tool shows, or leave it empty for a token');
const serviceIds = z.array(z.string().min(1).max(60)).min(1).max(200).nullable();
const passwords = z.enum(['never', 'ask', 'allowed']);
const connectionInput = z.object({
  name: z.string().trim().min(1, 'Name the agent').max(80),
  tool: z.enum(['claude', 'chatgpt', 'other']),
  serviceIds,
  passwords,
  writesSkills: z.boolean().default(false),
  redirectUri: callback,
  expiresInDays: z.number().int().min(1).max(365),
});
const connectionPatch = z
  .object({
    name: connectionInput.shape.name,
    serviceIds,
    passwords,
    status: z.enum(['active', 'paused']),
    writesSkills: z.boolean(),
  })
  .partial();
const skillEdit = z.object({ revision: z.uuid(), skill: skillInput });

const app = new Hono();
app.use('*', requireSuperAdmin);
app.use('*', requireUnlocked);
const me = (c: Context) => ({
  actorKind: 'person' as const,
  actorId: c.get('userId') as string,
  actorName: (c.get('userEmail') as string | undefined) ?? 'Super admin',
});
const none = { credentialId: null, credentialName: null };

// ── Services ─────────────────────────────────────────────────────────────────
app.get('/services', async (c) => {
  const [rows, logins, all] = await Promise.all([allServices(), allSummaries(), allSkills()]);
  return c.json({
    items: rows.map((s) => ({
      ...s,
      logins: logins.filter((l) => l.summary.serviceId === s.id).length,
      skills: all.filter((k) => k.serviceId === s.id && k.credentialId === null).length,
    })),
  });
});
app.post('/services', validateBody(serviceInput), async (c) => {
  const input = body(c, serviceInput);
  const existing = await allServices();
  if (existing.some((s) => s.name.toLowerCase() === input.name.toLowerCase()))
    return c.json({ error: 'A service with this name already exists.' }, 409);
  const row = await createService(input);
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Added service',
    detail: row.name,
    outcome: 'ok',
  });
  return c.json(row, 201);
});
app.put('/services/:sid', validateBody(serviceInput), async (c) => {
  const row = (await allServices()).find((s) => s.id === c.req.param('sid'));
  if (!row) return c.json({ error: 'Service not found' }, 404);
  const input = body(c, serviceInput);
  // The built-in service keeps its name; its address and description can change.
  const next = { ...row, ...input, name: row.builtIn ? row.name : input.name };
  await services.put(row.id, next);
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Edited service',
    detail: next.name,
    outcome: 'ok',
  });
  return c.json(next);
});
app.delete('/services/:sid', async (c) => {
  const id = c.req.param('sid')!;
  if (id === NAVIGATE_WEALTH_SERVICE_ID)
    return c.json({ error: 'Navigate Wealth is built in and cannot be deleted.' }, 400);
  const row = await services.get(id);
  if (!row) return c.json({ error: 'Service not found' }, 404);
  if ((await allSummaries()).some((r) => r.summary.serviceId === id))
    return c.json({ error: 'Delete or move this service’s logins first.' }, 409);
  const own = (await allSkills()).filter((s) => s.serviceId === id);
  if (own.length) await skills.removeMany(own.map((s) => s.id));
  await services.remove(id);
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Deleted service',
    detail: row.name + (own.length ? ' and ' + own.length + ' skills' : ''),
    outcome: 'ok',
  });
  return c.json({ success: true });
});

// ── Skills ───────────────────────────────────────────────────────────────────

/** A login-only skill belongs to its login's service, whatever the client sent. */
async function placed(input: z.infer<typeof skillInput>) {
  if (input.credentialId) {
    const entry = await entries.get(input.credentialId);
    if (!entry) return null;
    return { ...input, serviceId: (await summary(entry)).serviceId };
  }
  return (await serviceExists(input.serviceId)) ? input : null;
}

app.get('/skills', async (c) => c.json({ items: await allSkills() }));
app.post('/skills', validateBody(skillInput), async (c) => {
  const input = await placed(body(c, skillInput));
  if (!input) return c.json({ error: 'Choose a service or login that exists.' }, 400);
  const row = await createSkill(input, (c.get('userEmail') as string | undefined) ?? 'Super admin');
  await recordEvent({ ...me(c), ...none, action: 'Added skill', detail: row.name, outcome: 'ok' });
  return c.json(row, 201);
});
app.put('/skills/:kid', validateBody(skillEdit), async (c) => {
  const row = await skills.get(c.req.param('kid')!);
  if (!row) return c.json({ error: 'Skill not found' }, 404);
  const edit = body(c, skillEdit);
  const input = await placed(edit.skill);
  if (!input) return c.json({ error: 'Choose a service or login that exists.' }, 400);
  const next = await updateSkill(
    row,
    input,
    edit.revision,
    (c.get('userEmail') as string | undefined) ?? 'Super admin',
  );
  if (!next) return c.json({ error: 'Someone else changed this skill. Reload it first.' }, 409);
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Edited skill',
    detail: next.name,
    outcome: 'ok',
  });
  return c.json(next);
});
app.delete('/skills/:kid', async (c) => {
  const row = await skills.get(c.req.param('kid')!);
  if (!row) return c.json({ error: 'Skill not found' }, 404);
  await skills.remove(row.id);
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Deleted skill',
    detail: row.name,
    outcome: 'ok',
  });
  return c.json({ success: true });
});

// ── AI agents ────────────────────────────────────────────────────────────────
app.get('/connections', async (c) => {
  const rows = await connections.listAll('password vault: connections');
  return c.json({
    items: rows.map(publicConnection).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    aiPaused: (await settings.get('global'))?.aiPaused ?? false,
  });
});
app.post('/connections', validateBody(connectionInput), async (c) => {
  const issued = await issueConnection(body(c, connectionInput));
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Connected agent',
    detail: issued.connection.name,
    outcome: 'ok',
  });
  return c.json(issued, 201);
});
app.post('/connections/pause-all', async (c) => {
  await settings.put('global', { aiPaused: true });
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Paused all AI access',
    detail: '',
    outcome: 'ok',
  });
  return c.json({ aiPaused: true });
});
app.post('/connections/resume-all', async (c) => {
  await settings.put('global', { aiPaused: false });
  await recordEvent({ ...me(c), ...none, action: 'Resumed AI access', detail: '', outcome: 'ok' });
  return c.json({ aiPaused: false });
});
app.put('/connections/:cid', validateBody(connectionPatch), async (c) => {
  const updated = await patchConnection(c.req.param('cid')!, body(c, connectionPatch));
  if (!updated) return c.json({ error: 'Agent not found' }, 404);
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Changed agent',
    detail: updated.name + (updated.status === 'paused' ? ' · paused' : ''),
    outcome: 'ok',
  });
  return c.json(publicConnection(updated));
});
app.post('/connections/:cid/revoke', async (c) => {
  const id = c.req.param('cid')!;
  let updated = null;
  for (let attempt = 0; attempt < 3 && !updated; attempt++) {
    const row = await connections.get(id);
    if (!row) return c.json({ error: 'Agent not found' }, 404);
    const dead = await sha256Hex(
      Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),
    );
    updated = await updateConnection(row, { status: 'revoked', tokenHash: dead, tokenExpires: 0 });
  }
  if (!updated) return c.json({ error: 'This agent is busy. Try again.' }, 409);
  const seen = (await allSummaries())
    .map((r) => r.summary)
    .flatMap((s) => {
      const last = s.seenByAi.filter((e) => e.connectionId === id).at(-1);
      return last ? [{ credentialId: s.id, name: s.name, at: last.at }] : [];
    });
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Disconnected agent',
    detail: updated.name + ' · had received ' + seen.length + ' passwords',
    outcome: 'ok',
  });
  return c.json({ seen });
});

// ── Approvals ────────────────────────────────────────────────────────────────
app.get('/approvals', async (c) =>
  c.json({ items: await listApprovals(c.req.query('state') === 'all' ? 'all' : 'pending') }),
);
for (const decision of ['approve', 'deny'] as const)
  app.post('/approvals/:aid/' + decision, async (c) => {
    const result = await decide(
      c.req.param('aid')!,
      (c.get('userEmail') as string | undefined) ?? (c.get('userId') as string),
      decision,
    );
    if (result === 'not_found') return c.json({ error: 'Request not found' }, 404);
    if (result === 'closed') return c.json({ error: 'This request is no longer waiting.' }, 409);
    await recordEvent({
      ...me(c),
      action: decision === 'approve' ? 'Approved password request' : 'Denied password request',
      credentialId: result.credentialId,
      credentialName: result.credentialName,
      detail: result.connectionName,
      outcome: decision === 'approve' ? 'ok' : 'denied',
    });
    return c.json(publicApproval(result));
  });

// ── Activity ─────────────────────────────────────────────────────────────────
app.get('/events', async (c) => {
  const after = c.req.query('after');
  const kind = c.req.query('actorKind');
  return c.json(
    await listEvents(
      after && /^[0-9]{13}-[0-9a-f]{8}$/.test(after) ? after : undefined,
      kind && ['person', 'connection'].includes(kind) ? kind : undefined,
    ),
  );
});
export default app;
