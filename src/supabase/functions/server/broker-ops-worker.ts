import { checkpointLabels } from '../../../shared/broker-operations.ts';
import { providerOrigins } from './broker-ops-origins.ts';
import { Hono } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { requirePortalWorker } from './integrations-portal-guards.ts';
import { entries, summary, reveal } from './repositories/password-vault.ts';
import { runs, changeRun, active, db, checkpoints, clients } from './repositories/broker-ops.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { publicRun, type StoredRun } from './repositories/broker-ops.ts';

const app = new Hono<{ Variables: { job: StoredRun } }>();
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const denied = requirePortalWorker(c);
  if (denied) return denied;
  await next();
});
app.use('/:id/*', async (c, next) => {
  const r = await runs.get(c.req.param('id')!);
  if (!r || !active(publicRun(r).state)) return c.json({ error: 'Job is no longer active' }, 409);
  if (
    !c.req.path.endsWith('/claim') &&
    (!r.lease || !constantTimeEqual(r.lease, c.req.header('X-Run-Lease') ?? ''))
  )
    return c.json({ error: 'Invalid worker lease' }, 403);
  if (r.actor.startsWith('assistant:')) {
    const client = await clients.get(r.actor.slice('assistant:'.length));
    if (!client || Date.parse(client.expiresAt) <= Date.now()) {
      await changeRun(r, {
        state: 'cancelled',
        message: 'The requesting assistant connection was revoked or expired.',
      });
      return c.json({ error: 'Connection is inactive' }, 409);
    }
  }
  c.set('job', r);
  await next();
});
app.post('/:id/claim', async (c) => {
  const r = c.get('job');
  if (r.state !== 'queued') return c.json({ error: 'Already claimed' }, 409);
  const entry = await entries.get(r.accountId);
  const a = entry && (await summary(entry));
  if (
    !entry ||
    !a?.portal ||
    a.portal.provider !== r.provider ||
    a.url !== r.loginUrl ||
    a.portal.expectedIdentity !== r.identity ||
    a.portal.homeUrl !== r.homeUrl ||
    !a.portal.brokers.some((b) => b.brokerId === r.brokerId && b.code === r.code)
  ) {
    await changeRun(r, { state: 'failed', message: 'Account links changed. Start a new run.' });
    return c.json({ error: 'Account changed' }, 409);
  }
  const lease = crypto.randomUUID();
  if (
    !(await changeRun(r, {
      lease,
      state: 'running',
      message: 'Opening the provider sign-in page.',
    }))
  )
    return c.json({ error: 'Already claimed' }, 409);
  const p = providerOrigins[r.provider];
  const { password } = await reveal(entry);
  return c.json({
    lease,
    loginOrigin: p.loginOrigin,
    origins: [p.loginOrigin, ...p.portalOrigins],
    loginUrl: r.loginUrl,
    homeUrl: r.homeUrl,
    username: a.username,
    password,
    identity: r.identity,
    code: r.code,
    month: r.month,
    kind: r.kind,
    selectors: r.workflow.selectors,
  });
});
const percent = z.number().min(0).max(100);
const checkpoint = z.object({
  stage: z.enum(['signin', 'approval', 'account', 'report']),
  origin: z.string().max(2048),
  controls: z
    .array(
      z.object({
        label: z.enum(checkpointLabels),
        x: percent,
        y: percent,
        width: percent,
        height: percent,
      }),
    )
    .max(40),
});
app.post('/:id/checkpoint', async (c) => {
  const row = c.get('job'),
    parsed = checkpoint.safeParse(await c.req.json().catch(() => null));
  const origins = providerOrigins[row.provider];
  if (
    !parsed.success ||
    ![origins.loginOrigin, ...origins.portalOrigins].some((o) => o === parsed.data.origin)
  )
    return c.json({ error: 'Invalid checkpoint' }, 400);
  await checkpoints.put(row.id, { ...parsed.data, updatedAt: new Date().toISOString() });
  return c.json({ ok: true });
});
app.get('/:id/status', (c) => c.json({ state: c.get('job').state }));
const event = z.object({
  event: z.enum(['mfa', 'verified', 'missing', 'failed']),
  identity: z.string().max(160).optional(),
  code: z.string().max(80).optional(),
  reason: z.enum(['portal', 'identity', 'scope', 'document', 'timeout']).optional(),
});
app.post('/:id/event', async (c) => {
  const r = c.get('job');
  const parsed = event.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid event' }, 400);
  const { event: kind, identity, code, reason } = parsed.data;
  if ((kind === 'verified' || kind === 'missing') && (identity !== r.identity || code !== r.code))
    return c.json({ error: 'Identity or broker mismatch' }, 409);
  const reasons = {
    portal: 'Provider page did not match the configured workflow.',
    identity: 'Could not verify the portal account.',
    scope: 'Could not verify the selected broker.',
    document: 'Could not verify the document for this broker and month.',
    timeout: 'The provider session timed out.',
  };
  const patch =
    kind === 'mfa'
      ? {
          state: 'awaiting_mfa' as const,
          message: r.mfaPrompt || 'Complete the provider approval, then resume.',
        }
      : kind === 'failed'
        ? { state: 'failed' as const, message: reasons[reason ?? 'portal'] }
        : kind === 'missing'
          ? {
              state: 'missing' as const,
              message: 'No matching statement was available.',
              verifiedIdentity: identity,
              verifiedAt: r.verifiedAt ?? new Date().toISOString(),
            }
          : {
              state: r.kind === 'test_login' ? ('completed' as const) : ('running' as const),
              verifiedIdentity: identity,
              verifiedAt: r.verifiedAt ?? new Date().toISOString(),
              message: 'Verified account identity and broker code.',
            };
  const next = await changeRun(r, patch);
  return next ? c.json({ state: next.state }) : c.json({ error: 'Job changed' }, 409);
});
app.post('/:id/document', async (c) => {
  const r = c.get('job');
  if (r.kind !== 'monthly_statement' || r.state !== 'running' || r.verifiedIdentity !== r.identity)
    return c.json({ error: 'Unverified run' }, 409);
  const form = await c.req.formData();
  const file = form.get('file');
  if (
    form.get('code') !== r.code ||
    form.get('month') !== r.month ||
    !(file instanceof File) ||
    file.size > 10 * 1024 * 1024 ||
    (await file.slice(0, 5).text()) !== '%PDF-'
  )
    return c.json({ error: 'Invalid broker document' }, 400);
  const path =
      r.brokerId +
      '/' +
      r.provider +
      '/' +
      r.month +
      '/' +
      r.id +
      '-' +
      crypto.randomUUID() +
      '.pdf',
    storage = db().storage.from('broker-portal-reports');
  const { error } = await storage.upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) return c.json({ error: 'Could not file document' }, 503);
  const next = await changeRun(r, {
    state: 'completed',
    document: path,
    message: 'Statement filed against the verified broker.',
  });
  if (!next) {
    const current = await runs.get(r.id);
    if (current?.document !== path) await storage.remove([path]);
    return c.json({ error: 'Job changed' }, 409);
  }
  return c.json({ stored: true });
});
export default app;
