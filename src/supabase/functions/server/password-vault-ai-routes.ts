/**
 * Super admin routes for the AI side of the password manager. Mounted inside
 * password-vault-routes.ts, after its unlock gate.
 */
import { Hono, type Context } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { Buffer } from 'node:buffer';
import { requireSuperAdmin } from './auth-mw.ts';
import { body, validateBody } from './validate.ts';
import { allSummaries, entries, summary } from './repositories/password-vault.ts';
import { connections, runs, settings, workflows } from './repositories/vault-store.ts';
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
  createWorkflow,
  listForCredential,
  publish,
  updateWorkflow,
  versions,
  workflowInput,
} from './vault-workflows.ts';
import { afterDecision, cancelRun, listRuns, publicRun, trustSuggestions } from './vault-runs.ts';

const mode = z.enum(['auto', 'ask_on_fail', 'ask', 'deny']);
const checkMode = z.enum(['block', 'ask', 'log', 'off']);
const money = z.number().min(0).max(1_000_000_000).nullable();
export const autonomyInput = z.object({
  level: z.enum(['supervised', 'checks', 'full', 'custom']),
  actions: z.object({
    reveal: mode,
    ask_first_logins: mode,
    read_workflow: mode,
    change_workflow: mode,
    money_workflow: mode,
  }),
  checks: z.object({
    roa_document: checkMode,
    identity_match: checkMode,
    per_instruction_limit: checkMode,
    daily_limit: checkMode,
    duplicate_24h: checkMode,
    page_matches: checkMode,
  }),
  workflowOverrides: z.record(z.uuid(), mode),
  limits: z.object({
    perInstruction: money,
    perDay: money,
    signInsPerHour: z.number().int().min(1).max(10000).nullable(),
  }),
  holdMinutes: z.number().int().min(0).max(1440),
  approver: z.enum(['owner_then_super', 'any_super', 'two_people']),
});
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
  }, 'Enter the HTTPS callback URL the AI tool shows, or leave it empty for a bearer token');
const connectionInput = z.object({
  name: z.string().trim().min(1).max(80),
  personUserId: z.uuid().nullable(),
  personName: z.string().trim().max(120),
  tool: z.enum(['claude', 'chatgpt', 'other']),
  collectionIds: z.array(z.string().min(1).max(40)).min(1).max(50),
  tagFilter: z.string().trim().max(60).nullable(),
  level: z.enum(['find', 'use', 'reveal', 'full']),
  autonomy: autonomyInput,
  redirectUri: callback,
  expiresInDays: z.number().int().min(1).max(365),
});
const connectionPatch = connectionInput
  .pick({
    name: true,
    collectionIds: true,
    tagFilter: true,
    level: true,
    autonomy: true,
    personName: true,
  })
  .extend({ status: z.enum(['active', 'paused']) })
  .partial();
const workflowEdit = z.object({ revision: z.uuid(), workflow: workflowInput });

const app = new Hono();
app.use('*', requireSuperAdmin);
app.use('*', requireUnlocked);
const me = (c: Context) => ({
  actorKind: 'person' as const,
  actorId: c.get('userId') as string,
  actorName: (c.get('userEmail') as string | undefined) ?? 'Super admin',
});
const none = { credentialId: null, credentialName: null };

// ── Connections ──────────────────────────────────────────────────────────────
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
    action: 'Created connection',
    detail:
      issued.connection.name +
      ' · ' +
      issued.connection.level +
      ' · ' +
      issued.connection.autonomy.level,
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
  if (!updated) return c.json({ error: 'Connection not found' }, 404);
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Changed connection',
    detail: updated.name + ' · ' + updated.status + ' · ' + updated.autonomy.level,
    outcome: 'ok',
  });
  return c.json(publicConnection(updated));
});
app.post('/connections/:cid/revoke', async (c) => {
  const id = c.req.param('cid')!;
  let updated = null;
  for (let attempt = 0; attempt < 3 && !updated; attempt++) {
    const row = await connections.get(id);
    if (!row) return c.json({ error: 'Connection not found' }, 404);
    const dead = await sha256Hex(
      Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),
    );
    updated = await updateConnection(row, { status: 'revoked', tokenHash: dead, tokenExpires: 0 });
  }
  if (!updated) return c.json({ error: 'This connection is busy. Try again.' }, 409);
  const seen = (await allSummaries())
    .map((r) => r.summary)
    .flatMap((s) => {
      const last = s.seenByAi.filter((e) => e.connectionId === id).at(-1);
      return last ? [{ credentialId: s.id, name: s.name, at: last.at }] : [];
    });
  await recordEvent({
    ...me(c),
    ...none,
    action: 'Revoked connection',
    detail: updated.name + ' · had seen ' + seen.length + ' passwords',
    outcome: 'ok',
  });
  return c.json({ seen });
});
app.get('/connections/:cid/trust', async (c) => {
  const row = await connections.get(c.req.param('cid')!);
  if (!row) return c.json({ error: 'Connection not found' }, 404);
  return c.json({ items: await trustSuggestions(row) });
});

// ── Approvals ────────────────────────────────────────────────────────────────
app.get('/approvals', async (c) =>
  c.json({ items: await listApprovals(c.req.query('state') === 'all' ? 'all' : 'pending') }),
);
for (const decision of ['approve', 'deny'] as const)
  app.post('/approvals/:aid/' + decision, async (c) => {
    const result = await decide(c.req.param('aid')!, c.get('userId') as string, decision);
    if (result === 'not_found') return c.json({ error: 'Request not found' }, 404);
    if (result === 'closed') return c.json({ error: 'This request is no longer waiting.' }, 409);
    if (result === 'already') return c.json({ error: 'You already approved this request.' }, 409);
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

// ── Workflows ────────────────────────────────────────────────────────────────
app.get('/workflows', async (c) => {
  const credential = c.req.query('credential');
  const rows = await workflows.listAll('password vault: all workflows');
  return c.json({ items: rows.filter((w) => !credential || w.credentialId === credential) });
});
app.get('/:id/workflows', async (c) => {
  const id = c.req.param('id')!;
  if (!z.uuid().safeParse(id).success) return c.json({ error: 'Credential not found' }, 404);
  return c.json({ items: await listForCredential(id) });
});
app.post('/:id/workflows', validateBody(workflowInput), async (c) => {
  const id = c.req.param('id')!;
  const entry = z.uuid().safeParse(id).success ? await entries.get(id) : null;
  if (!entry) return c.json({ error: 'Credential not found' }, 404);
  const row = await createWorkflow(id, body(c, workflowInput), c.get('userId') as string);
  await recordEvent({
    ...me(c),
    action: 'Created workflow',
    credentialId: id,
    credentialName: (await summary(entry)).name,
    detail: row.name,
    outcome: 'ok',
  });
  return c.json(row, 201);
});
app.put('/workflows/:wid', validateBody(workflowEdit), async (c) => {
  const row = await workflows.get(c.req.param('wid')!);
  if (!row) return c.json({ error: 'Workflow not found' }, 404);
  const input = body(c, workflowEdit);
  const next = await updateWorkflow(row, input.workflow, input.revision, c.get('userId') as string);
  if (!next) return c.json({ error: 'This workflow changed. Reload it and try again.' }, 409);
  return c.json(next);
});
app.post('/workflows/:wid/publish', async (c) => {
  const row = await workflows.get(c.req.param('wid')!);
  if (!row) return c.json({ error: 'Workflow not found' }, 404);
  if (row.kind === 'skill' && !row.steps.length)
    return c.json({ error: 'Add at least one step before publishing.' }, 400);
  const next = await publish(row, c.get('userId') as string);
  if (!next) return c.json({ error: 'This workflow changed. Reload it and try again.' }, 409);
  await recordEvent({
    ...me(c),
    action: 'Published workflow',
    credentialId: row.credentialId,
    credentialName: null,
    detail: row.name + ' · version ' + row.version,
    outcome: 'ok',
  });
  return c.json(next);
});
app.get('/workflows/:wid/versions', async (c) =>
  c.json({ items: await versions(c.req.param('wid')!) }),
);
app.delete('/workflows/:wid', async (c) => {
  const row = await workflows.get(c.req.param('wid')!);
  if (!row) return c.json({ error: 'Workflow not found' }, 404);
  await workflows.remove(row.id);
  await recordEvent({
    ...me(c),
    action: 'Deleted workflow',
    credentialId: row.credentialId,
    credentialName: null,
    detail: row.name,
    outcome: 'ok',
  });
  return c.json({ success: true });
});

// ── Runs and activity ────────────────────────────────────────────────────────
app.get('/runs', async (c) =>
  c.json({
    items: await listRuns({
      connection: c.req.query('connection'),
      workflow: c.req.query('workflow'),
    }),
  }),
);
app.get('/runs/:rid', async (c) => {
  const row = await runs.get(c.req.param('rid')!);
  return row ? c.json(publicRun(row)) : c.json({ error: 'Run not found' }, 404);
});
app.post('/runs/:rid/cancel', async (c) => {
  const run = await cancelRun(c.req.param('rid')!);
  if (!run) return c.json({ error: 'Run not found' }, 404);
  await recordEvent({
    ...me(c),
    action: 'Cancelled run',
    credentialId: run.credentialId,
    credentialName: run.credentialName,
    detail: run.workflowName,
    outcome: 'ok',
  });
  return c.json(run);
});
app.get('/events', async (c) => {
  const after = c.req.query('after');
  const kind = c.req.query('actorKind');
  return c.json(
    await listEvents(
      after && /^[0-9]{13}-[0-9a-f]{8}$/.test(after) ? after : undefined,
      kind && ['person', 'connection', 'runner'].includes(kind) ? kind : undefined,
    ),
  );
});
export default app;
