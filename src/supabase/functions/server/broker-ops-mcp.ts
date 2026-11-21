import { isHostedAssistantOrigin } from './broker-ops-origin.ts';
import { Hono } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { jobInput } from './broker-ops-model.ts';
import { startJob, discover, control, OperationError, siteOrigin } from './broker-ops-jobs.ts';
import { authenticateConnection } from './broker-ops-auth.ts';
import { runs, batches, publicRun, workflows } from './repositories/broker-ops.ts';
const app = new Hono<{ Variables: { connection: string } }>();
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const origin = c.req.header('Origin');
  if (
    origin &&
    origin !== siteOrigin &&
    !isHostedAssistantOrigin(origin) &&
    !(Deno.env.get('NW_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((v) => v.trim())
      .includes(origin)
  )
    return c.json({ error: 'Untrusted origin' }, 403);
  const client = await authenticateConnection(c.req.header('Authorization') ?? '');
  if (!client) {
    c.header(
      'WWW-Authenticate',
      'Bearer resource_metadata="' +
        siteOrigin +
        '/.well-known/oauth-protected-resource/mcp/broker-operations"',
    );
    return c.json({ error: 'Authentication required' }, 401);
  }
  c.set('connection', client);
  await next();
});
const id = z.object({ jobId: z.uuid() }).strict();
const status = z
  .object({
    jobId: z.uuid().optional(),
    batchId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()
  .refine((v) => Boolean(v.jobId) !== Boolean(v.batchId), 'Supply either jobId or batchId');
const accountQuery = z
  .object({ after: z.uuid().optional(), search: z.string().max(100).optional() })
  .strict();
const definitions = [
  [
    'find_portal_accounts',
    'List linked accounts and brokers. Continue with nextCursor, including when a filtered page is empty.',
    accountQuery,
    true,
  ],
  [
    'list_workflows',
    'List the available provider reporting workflows.',
    z.object({}).strict(),
    true,
  ],
  [
    'start_portal_job',
    'Start one run per selected broker. Reuse requestId on a network retry. Use a fresh requestId when explicitly retrying a failed broker.',
    jobInput,
    false,
  ],
  ['get_job_status', 'Read progress for a job or all brokers in a batch.', status, true],
  [
    'resume_job',
    'Recheck the live session after the operator approves MFA with the provider.',
    id,
    false,
  ],
  [
    'get_job_results',
    'Return verified outcomes and filed document references by broker.',
    status,
    true,
  ],
  ['cancel_job', 'Stop a pending run.', id, false],
] as const;
async function call(name: string, args: unknown, actor: string) {
  switch (name) {
    case 'find_portal_accounts': {
      const input = accountQuery.parse(args),
        p = await discover(input.after);
      const search = input.search?.trim().toLowerCase();
      return {
        ...p,
        accounts: search
          ? p.accounts.filter((a) => JSON.stringify(a).toLowerCase().includes(search))
          : p.accounts,
      };
    }
    case 'list_workflows':
      return (await workflows.listAll('MCP workflow discovery')).map(
        ({ id, name, kind, provider }) => ({ id, name, kind, provider }),
      );
    case 'start_portal_job':
      return startJob(jobInput.parse(args), actor);
    case 'cancel_job':
    case 'resume_job':
      return control(id.parse(args).jobId, name === 'cancel_job' ? 'cancel' : 'resume', actor);
    case 'get_job_status':
    case 'get_job_results': {
      const { jobId, batchId } = status.parse(args);
      let ids: string[];
      if (jobId) ids = [jobId];
      else {
        const b = await batches.get(batchId!);
        if (b?.actor !== actor) throw new OperationError('Unknown batch.');
        ids = b.ids;
      }
      return {
        runs: await Promise.all(
          ids.map(async (key) => {
            const r = await runs.get(key);
            if (!r || r.actor !== actor) throw new OperationError('Unknown job.');
            return { ...publicRun(r), operatorUrl: siteOrigin + '/admin?brokerRun=' + r.id };
          }),
        ),
      };
    }
    default:
      throw new OperationError('Unknown tool.');
  }
}
const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const rpc = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  id: z.union([z.string(), z.number().int()]).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});
app.post('/', async (c) => {
  const version = c.req.header('MCP-Protocol-Version');
  if (version && !versions.includes(version))
    return c.json({ error: 'Unsupported protocol version' }, 400);
  if (!c.req.header('Content-Type')?.startsWith('application/json'))
    return c.json({ error: 'Expected JSON' }, 415);
  const input = rpc.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return c.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } },
      400,
    );
  const { method, id, params } = input.data;
  if (id === undefined) return c.body(null, 202);
  const ok = (result: unknown) => c.json({ jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string) =>
    c.json({ jsonrpc: '2.0', id, error: { code, message } });
  if (method === 'initialize')
    return ok({
      protocolVersion: versions.includes(String(params?.protocolVersion))
        ? params?.protocolVersion
        : versions[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'navigate-wealth-broker-operations', version: '1.0.0' },
    });
  if (method === 'ping') return ok({});
  if (method === 'tools/list')
    return ok({
      tools: definitions.map(([name, description, schema, readOnlyHint]) => ({
        name,
        description,
        inputSchema: z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }),
        annotations: { readOnlyHint },
      })),
    });
  if (method !== 'tools/call') return fail(-32601, 'Unknown method');
  const tool = definitions.find(([name]) => name === params?.name);
  if (!tool || !tool[2].safeParse(params?.arguments ?? {}).success)
    return fail(-32602, 'Unknown tool or invalid arguments');
  try {
    const value = await call(tool[0], params?.arguments ?? {}, 'assistant:' + c.get('connection'));
    return ok({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  } catch (e) {
    return ok({
      isError: true,
      content: [
        {
          type: 'text',
          text: e instanceof OperationError ? e.message : 'The reporting service is unavailable.',
        },
      ],
    });
  }
});
app.all('/', (c) => {
  c.header('Allow', 'POST');
  return c.body(null, 405);
});
export default app;
