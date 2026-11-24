/**
 * MCP server for the password manager (Streamable HTTP, JSON responses).
 *
 * Two kinds of caller:
 *  - AI connections (`nwvc_` tokens, OAuth or bearer): scoped to collections,
 *    with an access level and an autonomy policy. Tools above the level are
 *    left out of tools/list.
 *  - Legacy single-credential tokens (`nwv_`): one tool, `get_credential`
 *    with no arguments, until they expire.
 */
import { Hono, type Context, type Next } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import type { VaultSummary } from '../../../shared/password-manager.ts';
import {
  allSummaries,
  collections,
  entries,
  ensureBrokerage,
  publicCollection,
  recordExposure,
  reveal,
  revealSecret,
  summary,
  type VaultEntry,
} from './repositories/password-vault.ts';
import { approvals, workflows, type StoredConnection } from './repositories/vault-store.ts';
import { sha256Hex } from './sha256.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { authenticateVaultConnection } from './vault-connections.ts';
import { isHostedAssistantOrigin } from './broker-ops-origin.ts';
import { allows, canSee, effectiveLevel, modeFor } from './vault-policy.ts';
import { consume, publicApproval, requestApproval } from './vault-approvals.ts';
import { recordEvent } from './vault-events.ts';
import { liveSnapshot, listForCredential, renderSkill } from './vault-workflows.ts';
import {
  actSession,
  completeRun,
  getRun,
  listRuns,
  readSession,
  runFor,
  RunError,
  startRun,
} from './vault-runs.ts';
import { HostUnavailable } from './vault-browser-host.ts';
import { totp } from './vault-totp.ts';

type Caller =
  { kind: 'legacy'; entry: VaultEntry } | { kind: 'connection'; conn: StoredConnection };
const app = new Hono<{ Variables: { caller: Caller } }>();
const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const rpc = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number().int()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});
class ToolError extends Error {}

async function requireVaultConnection(c: Context, next: Next) {
  c.header('Cache-Control', 'no-store');
  const origin = c.req.header('Origin');
  if (
    origin &&
    !(Deno.env.get('NW_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .includes(origin) &&
    !isHostedAssistantOrigin(origin)
  )
    return c.json({ error: 'Origin not allowed' }, 403);
  const header = c.req.header('Authorization') ?? '';
  const unauthorized = (message: string, status: 401 | 403 = 401) => {
    c.header(
      'WWW-Authenticate',
      'Bearer resource_metadata="https://www.navigatewealth.co/.well-known/oauth-protected-resource/mcp/password-vault"',
    );
    return c.json({ error: message }, status);
  };
  if (/^Bearer nwvc_/i.test(header)) {
    const auth = await authenticateVaultConnection(header);
    if (!auth.ok)
      return auth.reason === 'paused'
        ? unauthorized('This connection is paused by a super admin.', 403)
        : unauthorized('Invalid or expired vault token');
    c.set('caller', { kind: 'connection', conn: auth.row });
    return next();
  }
  const legacy = /^Bearer (nwv_([a-f0-9-]{36})\.[A-Za-z0-9_-]{43})$/i.exec(header);
  const entry = legacy && (await entries.get(legacy[2]));
  if (
    !entry?.connection ||
    !(Date.parse(entry.connection.expiresAt) > Date.now()) ||
    !constantTimeEqual(await sha256Hex(legacy![1]), entry.connection.hash)
  )
    return unauthorized('Invalid or expired vault token');
  c.set('caller', { kind: 'legacy', entry });
  await next();
}
app.use('*', requireVaultConnection);

// ── Tools ────────────────────────────────────────────────────────────────────
const credentialId = z.uuid();
const reason = z.string().trim().min(1).max(500);
type Tool = {
  name: string;
  description: string;
  schema: z.ZodType;
  level: 'find' | 'use' | 'reveal';
  readOnly: boolean;
};
const tools: Tool[] = [
  {
    name: 'list_collections',
    description: 'Collections this connection can see, with how many logins each holds.',
    schema: z.object({}).strict(),
    level: 'find',
    readOnly: true,
  },
  {
    name: 'search_credentials',
    description:
      'Find logins by name, website, username, tag or category. Returns no secrets. Each result says the most you may do with it (find, use or reveal).',
    schema: z
      .object({
        query: z.string().max(100).optional(),
        collection_id: z.string().max(40).optional(),
        tag: z.string().max(60).optional(),
      })
      .strict(),
    level: 'find',
    readOnly: true,
  },
  {
    name: 'list_workflows',
    description: 'Live workflows on a login: name, when to use it, risk and required inputs.',
    schema: z.object({ credential_id: credentialId }).strict(),
    level: 'find',
    readOnly: true,
  },
  {
    name: 'get_skill',
    description:
      'The live skill for a workflow: steps, inputs, guardrails and what to return. Read it before start_workflow.',
    schema: z.object({ workflow_id: z.uuid() }).strict(),
    level: 'find',
    readOnly: true,
  },
  {
    name: 'get_approval_status',
    description: 'Whether a request that waited for a person was approved, denied or expired.',
    schema: z.object({ approval_id: z.uuid() }).strict(),
    level: 'find',
    readOnly: true,
  },
  {
    name: 'start_workflow',
    description:
      'Run a workflow on its login. The platform signs in; you never see the password. Automated workflows queue on the reporting runner; skills open a session for session_read and session_act. request_id must be a fresh UUID; reuse it to recover the same run after a network error.',
    schema: z
      .object({
        workflow_id: z.uuid(),
        inputs: z.record(z.string(), z.unknown()),
        request_id: z.uuid(),
        reason: z.string().max(500).optional(),
      })
      .strict(),
    level: 'use',
    readOnly: false,
  },
  {
    name: 'get_run',
    description: 'Status, steps, checks and results of a run.',
    schema: z.object({ run_id: z.string().regex(/^[a-f0-9]{32}$/) }).strict(),
    level: 'use',
    readOnly: true,
  },
  {
    name: 'session_read',
    description:
      'The current page of a skill session as text and labelled controls. Password fields are never included.',
    schema: z.object({ run_id: z.string().regex(/^[a-f0-9]{32}$/) }).strict(),
    level: 'use',
    readOnly: true,
  },
  {
    name: 'session_act',
    description:
      'Act on the session page: click, fill, select, upload, goto or wait. Pass step_index for the skill step you are on. At a checkpoint the answer may be waiting_for_approval or held; repeat the same call once it is approved or the hold has passed.',
    schema: z
      .object({
        run_id: z.string().regex(/^[a-f0-9]{32}$/),
        action: z.enum(['click', 'fill', 'select', 'upload', 'goto', 'wait']),
        target: z.string().max(200).optional(),
        value: z.string().max(4000).optional(),
        step_index: z.number().int().min(0).max(59).optional(),
        reason: z.string().max(500).optional(),
      })
      .strict(),
    level: 'use',
    readOnly: false,
  },
  {
    name: 'complete_run',
    description: 'Finish a skill run with what the skill asks you to return. Closes the session.',
    schema: z
      .object({
        run_id: z.string().regex(/^[a-f0-9]{32}$/),
        summary: z.string().min(1).max(2000),
        data: z.unknown().optional(),
      })
      .strict(),
    level: 'use',
    readOnly: false,
  },
  {
    name: 'get_one_time_code',
    description: 'The current 6-digit authenticator code for a login. Give the reason you need it.',
    schema: z
      .object({ credential_id: credentialId, reason, approval_id: z.uuid().optional() })
      .strict(),
    level: 'reveal',
    readOnly: true,
  },
  {
    name: 'get_credential',
    description:
      'Website, username and password for a login. The response contains a secret, is recorded with your reason, and marks the login as seen by AI.',
    schema: z
      .object({ credential_id: credentialId, reason, approval_id: z.uuid().optional() })
      .strict(),
    level: 'reveal',
    readOnly: true,
  },
];
const LEVEL_ORDER = { find: 1, use: 2, reveal: 3 } as const;
const toolsFor = (conn: StoredConnection) =>
  tools.filter(
    (t) => LEVEL_ORDER[t.level] <= (conn.level === 'full' ? 3 : LEVEL_ORDER[conn.level]),
  );

async function visible(conn: StoredConnection, id: string) {
  const entry = await entries.get(id);
  const item = entry && (await summary(entry));
  if (!entry || !item || !canSee(conn, item)) throw new ToolError('Unknown login.');
  return { entry, item };
}

function brief(conn: StoredConnection, s: VaultSummary) {
  return {
    id: s.id,
    name: s.name,
    website: s.url,
    username: s.username,
    collection_id: s.collectionId,
    kind: s.kind,
    category: s.category,
    tags: s.tags,
    has_one_time_code: s.hasOtp,
    broker_reporting: Boolean(s.portal),
    you_may: effectiveLevel(conn, s),
  };
}

async function revealFlow(
  conn: StoredConnection,
  kind: 'reveal' | 'otp',
  args: { credential_id: string; reason: string; approval_id?: string },
) {
  const { entry, item } = await visible(conn, args.credential_id);
  const actor = {
    actorKind: 'connection' as const,
    actorId: conn.id,
    actorName: conn.name,
    credentialId: item.id,
    credentialName: item.name,
  };
  const what = kind === 'otp' ? 'one-time code' : 'password';
  if (!allows(effectiveLevel(conn, item), 'reveal')) {
    await recordEvent({
      ...actor,
      action: 'Denied',
      detail: 'Asked for the ' + what + ' without reveal access',
      outcome: 'denied',
    });
    throw new ToolError('This connection may not reveal this login. Use its workflows instead.');
  }
  const mode = modeFor(conn, 'reveal', item);
  if (mode === 'deny') {
    await recordEvent({
      ...actor,
      action: 'Denied',
      detail: 'Reveal is not allowed on this connection',
      outcome: 'denied',
    });
    throw new ToolError('Revealing is not allowed on this connection.');
  }
  if (
    mode === 'ask' &&
    !(
      args.approval_id &&
      (await consume(args.approval_id, {
        connectionId: conn.id,
        credentialId: item.id,
        action: kind,
      }))
    )
  ) {
    const a = await requestApproval(
      conn,
      {
        action: kind,
        credentialId: item.id,
        credentialName: item.name,
        workflowId: null,
        runId: null,
        reason: args.reason,
        detail: kind === 'otp' ? 'One-time code' : 'Username and password',
      },
      10,
    );
    await recordEvent({
      ...actor,
      action: 'Asked to reveal',
      detail: '“' + args.reason + '” · waiting for approval',
      outcome: 'pending',
    });
    return {
      status: 'waiting_for_approval',
      approval_id: a.id,
      expires_at: a.expiresAt,
      message:
        'A person must approve this. Call get_approval_status, then repeat this call with approval_id.',
    };
  }
  const secret = await revealSecret(entry);
  if (kind === 'otp') {
    if (!secret.otpSecret) throw new ToolError('This login has no one-time code saved.');
    await recordEvent({
      ...actor,
      action: 'Revealed one-time code',
      detail: '“' + args.reason + '”',
      outcome: 'ok',
    });
    return totp(secret.otpSecret);
  }
  let row: VaultEntry | null = entry;
  for (let i = 0; i < 3 && row; i++) {
    if (
      await recordExposure(row, {
        connectionId: conn.id,
        connectionName: conn.name,
        at: new Date().toISOString(),
      })
    )
      break;
    row = await entries.get(item.id);
  }
  await recordEvent({
    ...actor,
    action: 'Revealed password',
    detail: '“' + args.reason + '”',
    outcome: 'ok',
  });
  return { website: item.url, username: item.username, password: secret.password };
}

async function call(conn: StoredConnection, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'list_collections': {
      await ensureBrokerage();
      const [all, cols] = await Promise.all([
        allSummaries(),
        collections.listAll('password vault mcp: collections'),
      ]);
      return cols
        .filter((c) => conn.collectionIds.includes(c.id))
        .map((c) => ({
          ...publicCollection(c),
          logins: all.filter((r) => r.summary.collectionId === c.id && canSee(conn, r.summary))
            .length,
        }));
    }
    case 'search_credentials': {
      const q = String(args.query ?? '').toLowerCase();
      const rows = (await allSummaries())
        .map((r) => r.summary)
        .filter(
          (s) =>
            canSee(conn, s) &&
            (!args.collection_id || s.collectionId === args.collection_id) &&
            (!args.tag || s.tags.includes(String(args.tag))) &&
            (!q ||
              [s.name, s.url, s.username, s.category, ...s.tags]
                .join(' ')
                .toLowerCase()
                .includes(q)),
        );
      return { results: rows.slice(0, 50).map((s) => brief(conn, s)), more: rows.length > 50 };
    }
    case 'list_workflows': {
      await visible(conn, String(args.credential_id));
      return (await listForCredential(String(args.credential_id)))
        .filter((w) => w.liveVersion !== null)
        .map((w) => ({
          workflow_id: w.id,
          name: w.name,
          when_to_use: w.description,
          kind: w.kind,
          risk: w.risk,
          live_version: w.liveVersion,
        }));
    }
    case 'get_skill': {
      const wf = await workflows.get(String(args.workflow_id));
      if (!wf) throw new ToolError('Unknown workflow.');
      const { item } = await visible(conn, wf.credentialId);
      const snap = await liveSnapshot(wf);
      if (!snap) throw new ToolError('This workflow has no live version yet.');
      return {
        workflow_id: wf.id,
        version: snap.version,
        risk: snap.risk,
        inputs: snap.inputs,
        skill: renderSkill(snap, item.name),
      };
    }
    case 'get_approval_status': {
      const a = await approvals.get(String(args.approval_id));
      if (!a || a.connectionId !== conn.id) throw new ToolError('Unknown approval.');
      const p = publicApproval(a);
      return {
        state: p.state,
        approvals: p.approvals.length,
        required: p.requiredApprovals,
        expires_at: p.expiresAt,
      };
    }
    case 'start_workflow': {
      const perHour = conn.autonomy.limits.signInsPerHour;
      if (
        perHour !== null &&
        (await listRuns({ connection: conn.id })).filter(
          (r) => Date.now() - Date.parse(r.createdAt) < 3600000,
        ).length >= perHour
      )
        throw new ToolError('This connection reached its limit of ' + perHour + ' runs an hour.');
      return startRun(
        conn,
        args as {
          workflow_id: string;
          inputs: Record<string, unknown>;
          request_id: string;
          reason?: string;
        },
      );
    }
    case 'get_run':
      return getRun(await runFor(conn, String(args.run_id)));
    case 'session_read':
      return readSession(await runFor(conn, String(args.run_id)));
    case 'session_act':
      return actSession(
        conn,
        await runFor(conn, String(args.run_id)),
        args as unknown as Parameters<typeof actSession>[2],
      );
    case 'complete_run':
      return completeRun(conn, await runFor(conn, String(args.run_id)), {
        summary: String(args.summary),
        data: args.data,
      });
    case 'get_one_time_code':
      return revealFlow(
        conn,
        'otp',
        args as { credential_id: string; reason: string; approval_id?: string },
      );
    case 'get_credential':
      return revealFlow(
        conn,
        'reveal',
        args as { credential_id: string; reason: string; approval_id?: string },
      );
    default:
      throw new ToolError('Unknown tool.');
  }
}

const legacyTool = {
  name: 'get_credential',
  description:
    'Retrieve the URL, username and password assigned to this connection. The response contains a secret.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
};

async function callLegacy(entry: VaultEntry) {
  const { url, username } = await summary(entry);
  const { password } = await reveal(entry);
  await AdminAuditService.record({
    actorId: 'vault-connection:' + entry.id,
    actorRole: 'service',
    category: 'security',
    action: 'password_vault_mcp_read',
    summary: 'Service retrieved its assigned credential',
    entityType: 'vault_entry',
    entityId: entry.id,
  });
  return { url, username, password };
}

app.onError((_error, c) =>
  c.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Vault unavailable' } }, 500),
);
app.post('/', async (c) => {
  const fail = (
    id: string | number | null,
    code: number,
    message: string,
    status: 200 | 400 = 200,
  ) => c.json({ jsonrpc: '2.0', id, error: { code, message } }, status);
  const headerVersion = c.req.header('MCP-Protocol-Version');
  if (headerVersion && !versions.includes(headerVersion))
    return fail(null, -32600, 'Unsupported protocol version', 400);
  if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json'))
    return c.json({ error: 'Expected application/json' }, 415);
  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    return fail(null, -32700, 'Parse error', 400);
  }
  const parsed = rpc.safeParse(input);
  if (!parsed.success) return fail(null, -32600, 'Invalid request', 400);
  const { id, method, params } = parsed.data;
  if (id === undefined) return c.body(null, 202);
  const ok = (result: unknown) => c.json({ jsonrpc: '2.0', id, result });
  const caller = c.get('caller');
  if (method === 'initialize')
    return ok({
      protocolVersion: versions.includes(String(params?.protocolVersion))
        ? params?.protocolVersion
        : versions[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'navigate-wealth-password-vault', version: '2.0.0' },
      instructions:
        caller.kind === 'connection'
          ? 'Navigate Wealth password manager. Prefer workflows (start_workflow) over revealing passwords. Read a workflow’s skill with get_skill before running it, and pass step_index to session_act.'
          : undefined,
    });
  if (method === 'ping') return ok({});
  if (method === 'tools/list') {
    if (caller.kind === 'legacy') return ok({ tools: [legacyTool] });
    return ok({
      tools: toolsFor(caller.conn).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: z.toJSONSchema(t.schema, { target: 'draft-7', unrepresentable: 'any' }),
        annotations: { readOnlyHint: t.readOnly },
      })),
    });
  }
  if (method !== 'tools/call') return fail(id, -32601, 'Method not found');
  if (caller.kind === 'legacy') {
    const args = z
      .object({ name: z.literal(legacyTool.name), arguments: z.object({}).strict().optional() })
      .safeParse(params);
    if (!args.success) return fail(id, -32602, 'Unknown tool or invalid arguments');
    return ok({
      content: [{ type: 'text', text: JSON.stringify(await callLegacy(caller.entry)) }],
    });
  }
  const tool = toolsFor(caller.conn).find((t) => t.name === params?.name);
  const args = tool?.schema.safeParse(params?.arguments ?? {});
  if (!tool || !args?.success) return fail(id, -32602, 'Unknown tool or invalid arguments');
  try {
    const value = await call(caller.conn, tool.name, args.data as Record<string, unknown>);
    return ok({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  } catch (e) {
    const known = e instanceof ToolError || e instanceof RunError || e instanceof HostUnavailable;
    return ok({
      isError: true,
      content: [
        {
          type: 'text',
          text: known ? (e as Error).message : 'The password manager is unavailable.',
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
