/**
 * MCP server for the password manager (Streamable HTTP, JSON responses).
 *
 * Callers are AI agents connected under Password Manager → AI agents, with an
 * `nwvc_` token from OAuth (Claude custom connector, ChatGPT app) or a bearer
 * token. The way an agent works:
 *
 *   1. search_logins (or list_services) to find the login for the job;
 *   2. get_skills to read how to do it — the service's shared skills, then the
 *      login's own; for Navigate Wealth also the platform map;
 *   3. get_login for the username and password, and sign in itself.
 *
 * Tools that hand out secrets are left out of tools/list for an agent that may
 * never receive passwords.
 */
import { Hono, type Context, type Next } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import type { Service, VaultSummary } from '../../../shared/password-manager.ts';
import { renderPlatformGuide } from '../../../shared/platform-guide.ts';
import {
  allSummaries,
  entries,
  recordExposure,
  revealSecret,
  summary,
  type VaultEntry,
} from './repositories/password-vault.ts';
import { approvals, type StoredConnection } from './repositories/vault-store.ts';
import { authenticateVaultConnection, VAULT_TOKEN_PREFIX } from './vault-connections.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { isHostedAssistantOrigin } from './broker-ops-origin.ts';
import { canSee, passwordMode, reachesService } from './vault-policy.ts';
import { consume, publicApproval, requestApproval } from './vault-approvals.ts';
import { recordEvent } from './vault-events.ts';
import { allServices, allSkills, renderSkillsFor, skillsFor } from './vault-skills.ts';
import { totp } from './vault-totp.ts';

const log = createModuleLogger('vault-mcp');
const app = new Hono<{ Variables: { conn: StoredConnection } }>();
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
  const header = c.req.header('Authorization') ?? '';
  const auth = await authenticateVaultConnection(header);
  // Never the token itself: only whether one came and its scheme and kind.
  log.info('Vault MCP request', {
    method: c.req.method,
    scheme: header.split(' ')[0] || null,
    vaultToken: header.startsWith('Bearer ' + VAULT_TOKEN_PREFIX),
    outcome: auth.ok ? 'ok' : auth.reason,
    protocolVersion: c.req.header('MCP-Protocol-Version') ?? null,
    accept: c.req.header('Accept') ?? null,
    origin: c.req.header('Origin') ?? null,
  });
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
  const unauthorized = (message: string, status: 401 | 403 = 401) => {
    c.header(
      'WWW-Authenticate',
      'Bearer resource_metadata="https://www.navigatewealth.co/.well-known/oauth-protected-resource/mcp/password-vault"',
    );
    return c.json({ error: message }, status);
  };
  if (!auth.ok)
    return auth.reason === 'paused'
      ? unauthorized('This agent is paused by a super admin.', 403)
      : unauthorized('Invalid or expired token');
  c.set('conn', auth.row);
  await next();
}
app.use('*', requireVaultConnection);

// ── Tools ────────────────────────────────────────────────────────────────────
const loginId = z.uuid();
const reason = z.string().trim().min(1).max(500);
type Tool = {
  name: string;
  description: string;
  schema: z.ZodType;
  secret: boolean;
};
const tools: Tool[] = [
  {
    name: 'list_services',
    description:
      'The systems you can work in (for example Navigate Wealth, Allan Gray, GoAML), how many logins each has and the skills shared by all its logins. Start here when you do not know which login a task needs.',
    schema: z.object({}).strict(),
    secret: false,
  },
  {
    name: 'search_logins',
    description:
      'Find saved logins by name, website, username or service. Returns no passwords. Each result lists its skills and whether you may get its password.',
    schema: z
      .object({
        query: z.string().max(100).optional(),
        service_id: z.string().max(60).optional(),
      })
      .strict(),
    secret: false,
  },
  {
    name: 'get_skills',
    description:
      'Everything you need to know to work with one login, as Markdown: the skills shared by every login of its service, then the skills for this login only (which win where they differ). For Navigate Wealth it also includes the platform map. Read this before you start a task.',
    schema: z.object({ login_id: loginId }).strict(),
    secret: false,
  },
  {
    name: 'get_platform_guide',
    description:
      'A map of the Navigate Wealth admin panel: each module, what it is for and its address.',
    schema: z.object({}).strict(),
    secret: false,
  },
  {
    name: 'get_approval_status',
    description: 'Whether a password request that waited for a person was approved or denied.',
    schema: z.object({ approval_id: z.uuid() }).strict(),
    secret: false,
  },
  {
    name: 'get_login',
    description:
      'The website, username and password for a login, plus the current one-time code if it has one, so you can sign in. Say why you need it. Use it only on the sign-in page; never repeat it in chat. If a person must approve, you get waiting_for_approval: check get_approval_status, then call again with approval_id.',
    schema: z.object({ login_id: loginId, reason, approval_id: z.uuid().optional() }).strict(),
    secret: true,
  },
  {
    name: 'get_one_time_code',
    description:
      'A fresh 6-digit authenticator code for a login, when the site asks for one after you signed in. Say why you need it.',
    schema: z.object({ login_id: loginId, reason, approval_id: z.uuid().optional() }).strict(),
    secret: true,
  },
];
const toolsFor = (conn: StoredConnection) =>
  tools.filter((t) => !t.secret || conn.passwords !== 'never');

async function visible(conn: StoredConnection, id: string) {
  const entry = await entries.get(id);
  const item = entry && (await summary(entry));
  if (!entry || !item || !canSee(conn, item)) throw new ToolError('Unknown login.');
  return { entry, item };
}

const PASSWORD_WORDS = { go: 'allowed', ask: 'needs_approval', deny: 'not_allowed' } as const;

async function servicesById() {
  return new Map((await allServices()).map((s) => [s.id, s] as const));
}

async function secretFlow(
  conn: StoredConnection,
  kind: 'reveal' | 'otp',
  args: { login_id: string; reason: string; approval_id?: string },
) {
  const { entry, item } = await visible(conn, args.login_id);
  const actor = {
    actorKind: 'connection' as const,
    actorId: conn.id,
    actorName: conn.name,
    credentialId: item.id,
    credentialName: item.name,
  };
  const what = kind === 'otp' ? 'one-time code' : 'password';
  const mode = passwordMode(conn, item);
  if (mode === 'deny') {
    await recordEvent({
      ...actor,
      action: 'Refused',
      detail: 'Asked for the ' + what + ' without permission',
      outcome: 'denied',
    });
    throw new ToolError('You may not receive the ' + what + ' for this login.');
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
      { action: kind, credentialId: item.id, credentialName: item.name, reason: args.reason },
      15,
    );
    await recordEvent({
      ...actor,
      action: 'Asked for the ' + what,
      detail: '“' + args.reason + '” · waiting for approval',
      outcome: 'pending',
    });
    return {
      status: 'waiting_for_approval',
      approval_id: a.id,
      expires_at: a.expiresAt,
      message:
        'A person must approve this in Navigate Wealth. Tell the person you are working for, check get_approval_status, then call again with approval_id.',
    };
  }
  const secret = await revealSecret(entry);
  if (kind === 'otp') {
    if (!secret.otpSecret) throw new ToolError('This login has no one-time code saved.');
    await recordEvent({
      ...actor,
      action: 'Received one-time code',
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
    action: 'Received password',
    detail: '“' + args.reason + '”',
    outcome: 'ok',
  });
  return {
    website: item.url,
    username: item.username,
    password: secret.password,
    ...(secret.otpSecret ? { one_time_code: await totp(secret.otpSecret) } : {}),
  };
}

async function call(conn: StoredConnection, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'list_services': {
      const [svc, logins, skills] = await Promise.all([allServices(), allSummaries(), allSkills()]);
      return svc
        .filter((s) => reachesService(conn, s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          website: s.website,
          about: s.description,
          logins: logins.filter((l) => l.summary.serviceId === s.id && canSee(conn, l.summary))
            .length,
          shared_skills: skills
            .filter((k) => k.serviceId === s.id && k.credentialId === null)
            .map((k) => ({ name: k.name, when_to_use: k.whenToUse })),
        }));
    }
    case 'search_logins': {
      const q = String(args.query ?? '').toLowerCase();
      const [byId, all, skills] = await Promise.all([servicesById(), allSummaries(), allSkills()]);
      const serviceName = (s: VaultSummary) => byId.get(s.serviceId)?.name ?? '';
      const rows = all
        .map((r) => r.summary)
        .filter(
          (s) =>
            canSee(conn, s) &&
            (!args.service_id || s.serviceId === args.service_id) &&
            (!q || [s.name, s.url, s.username, serviceName(s)].join(' ').toLowerCase().includes(q)),
        );
      return {
        results: rows.slice(0, 50).map((s) => {
          const { shared, own } = skillsFor(s, skills);
          return {
            id: s.id,
            name: s.name,
            service: serviceName(s),
            service_id: s.serviceId,
            website: s.url,
            username: s.username,
            has_one_time_code: s.hasOtp,
            password: PASSWORD_WORDS[passwordMode(conn, s)],
            skills: [...shared, ...own].map((k) => ({
              name: k.name,
              when_to_use: k.whenToUse,
              for: k.credentialId ? 'this login' : 'every ' + serviceName(s) + ' login',
            })),
          };
        }),
        more: rows.length > 50,
      };
    }
    case 'get_skills': {
      const { item } = await visible(conn, String(args.login_id));
      const [byId, skills] = await Promise.all([servicesById(), allSkills()]);
      const service: Pick<Service, 'id' | 'name' | 'description'> = byId.get(item.serviceId) ?? {
        id: item.serviceId,
        name: 'Unknown service',
        description: '',
      };
      await recordEvent({
        actorKind: 'connection',
        actorId: conn.id,
        actorName: conn.name,
        credentialId: item.id,
        credentialName: item.name,
        action: 'Read skills',
        detail: '',
        outcome: 'ok',
      });
      return renderSkillsFor(item, service, skills);
    }
    case 'get_platform_guide':
      return renderPlatformGuide();
    case 'get_approval_status': {
      const a = await approvals.get(String(args.approval_id));
      if (!a || a.connectionId !== conn.id) throw new ToolError('Unknown approval.');
      const p = publicApproval(a);
      return { state: p.state, expires_at: p.expiresAt };
    }
    case 'get_login':
      return secretFlow(
        conn,
        'reveal',
        args as { login_id: string; reason: string; approval_id?: string },
      );
    case 'get_one_time_code':
      return secretFlow(
        conn,
        'otp',
        args as { login_id: string; reason: string; approval_id?: string },
      );
    default:
      throw new ToolError('Unknown tool.');
  }
}

const INSTRUCTIONS =
  'Navigate Wealth password manager: the firm’s saved logins and the skills that explain how to do work in each system. To do a task: find the right login with search_logins (or list_services), read get_skills for it and follow those instructions, then use get_login to sign in yourself. Never repeat a password in chat. When a skill or the person’s request is unclear, ask before acting.';

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
  const conn = c.get('conn');
  if (method === 'initialize')
    return ok({
      protocolVersion: versions.includes(String(params?.protocolVersion))
        ? params?.protocolVersion
        : versions[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'navigate-wealth-password-manager', version: '3.0.0' },
      instructions: INSTRUCTIONS,
    });
  if (method === 'ping') return ok({});
  if (method === 'tools/list')
    return ok({
      tools: toolsFor(conn).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: z.toJSONSchema(t.schema, { target: 'draft-7', unrepresentable: 'any' }),
        annotations: { readOnlyHint: true },
      })),
    });
  if (method !== 'tools/call') return fail(id, -32601, 'Method not found');
  const tool = toolsFor(conn).find((t) => t.name === params?.name);
  const args = tool?.schema.safeParse(params?.arguments ?? {});
  if (!tool || !args?.success) return fail(id, -32602, 'Unknown tool or invalid arguments');
  try {
    const value = await call(conn, tool.name, args.data as Record<string, unknown>);
    // Skills and the platform map are Markdown for the agent to read, not data.
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return ok({ content: [{ type: 'text', text }] });
  } catch (e) {
    return ok({
      isError: true,
      content: [
        {
          type: 'text',
          text: e instanceof ToolError ? e.message : 'The password manager is unavailable.',
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
