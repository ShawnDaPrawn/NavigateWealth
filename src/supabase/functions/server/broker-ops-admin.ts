import { Hono } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { requireSuperAdmin } from './auth-mw.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { body, validateBody } from './validate.ts';
import {
  brokers,
  checkpoints,
  clients,
  clientInfo,
  workflows,
  runs,
  latestRuns,
  accountHistory,
  db,
  publicRun,
} from './repositories/broker-ops.ts';
import { control, startJob, OperationError } from './broker-ops-jobs.ts';
import { clientInput, issueClient, approve, checkConsent, oauthInput } from './broker-ops-auth.ts';
import { jobInput, workflowInput } from './broker-ops-model.ts';
import { getDefaultPortalFlow } from './portal-default-flows.ts';
import { providerOrigins } from './broker-ops-origins.ts';
const app = new Hono();
app.use('*', requireSuperAdmin);
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
  if (c.req.method !== 'GET' && c.res.ok)
    await AdminAuditService.record({
      actorId: c.get('userId'),
      actorRole: 'super_admin',
      category: 'security',
      action: 'broker_ops_management',
      summary: 'Updated broker operations',
      entityType: c.req.path.split('/')[1],
    });
});
app.onError((e, c) =>
  e instanceof OperationError
    ? c.json({ error: e.message }, 400)
    : c.json({ error: 'Broker operations unavailable.' }, 503),
);
app.get('/setup', async (c) => {
  const [directory, flows, connections] = await Promise.all([
    brokers.listAll('Super admin broker directory'),
    workflows.listAll('Reporting workflow directory'),
    clients.listAll('Super admin connection management'),
  ]);
  const loginDefaults = Object.fromEntries(
    Object.entries(providerOrigins).map(([key, p]) => {
      const flow = getDefaultPortalFlow({ name: p.name }, key, {
        defaultPortalBrainGoal: () => '',
      });
      return [
        key,
        {
          username: flow.login.usernameSelector,
          password: flow.login.passwordSelector,
          submit: flow.login.submitSelector,
        },
      ];
    }),
  );
  return c.json({
    brokers: directory,
    workflows: flows,
    connections: connections.map(clientInfo),
    loginDefaults,
  });
});
const brokerInput = z.object({ name: z.string().trim().min(1).max(160) });
app.post('/brokers', validateBody(brokerInput), async (c) => {
  const row = { id: crypto.randomUUID(), ...body(c, brokerInput) };
  await brokers.put(row.id, row);
  return c.json(row, 201);
});
app.post('/workflows', validateBody(workflowInput), async (c) => {
  const row = { id: crypto.randomUUID(), ...body(c, workflowInput) };
  await workflows.put(row.id, row);
  return c.json(row, 201);
});
app.put('/workflows/:id', validateBody(workflowInput), async (c) => {
  const id = c.req.param('id')!;
  if (!(await workflows.get(id))) return c.json({ error: 'Unknown workflow' }, 404);
  const row = { id, ...body(c, workflowInput) };
  await workflows.put(id, row);
  return c.json(row);
});
app.post('/connections', validateBody(clientInput), async (c) => {
  const d = body(c, clientInput);
  return c.json(await issueClient(d.name, d.redirectUri), 201);
});
app.delete('/connections/:id', async (c) => {
  await clients.remove(c.req.param('id'));
  return c.json({ ok: true });
});
app.post('/consent/details', validateBody(oauthInput), async (c) =>
  c.json(clientInfo(await checkConsent(body(c, oauthInput)))),
);
app.post('/consent/approve', validateBody(oauthInput), async (c) =>
  c.json({ redirect: await approve(body(c, oauthInput)) }),
);
app.get('/runs', async (c) => {
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .safeParse(c.req.query('page') ?? 0);
  if (!page.success) return c.json({ error: 'Invalid page' }, 400);
  return c.json({
    runs: await latestRuns(
      c.req.query('brokerId') || undefined,
      c.req.query('month') || undefined,
      page.data,
    ),
  });
});
app.get('/accounts/:id/history', async (c) => c.json(await accountHistory(c.req.param('id'))));
app.get('/runs/:id', async (c) => {
  const row = await runs.get(c.req.param('id'));
  return row ? c.json(publicRun(row)) : c.json({ error: 'Unknown run' }, 404);
});
app.post('/runs', validateBody(jobInput), async (c) =>
  c.json(await startJob(body(c, jobInput), 'admin:' + c.get('userId')), 201),
);
app.get('/runs/:id/checkpoint', async (c) =>
  c.json({ checkpoint: await checkpoints.get(c.req.param('id')) }),
);
app.post('/runs/:id/cancel', async (c) => c.json(await control(c.req.param('id'), 'cancel')));
app.post('/runs/:id/resume', async (c) => c.json(await control(c.req.param('id'), 'resume')));
app.post('/runs/:id/document', async (c) => {
  const r = await runs.get(c.req.param('id'));
  if (!r || publicRun(r).state !== 'completed' || !r.document)
    return c.json({ error: 'No filed document' }, 404);
  const { data, error } = await db()
    .storage.from('broker-portal-reports')
    .createSignedUrl(r.document, 60, { download: true });
  if (error || !data) throw new Error('Document unavailable');
  return c.json({ url: data.signedUrl });
});
export default app;
