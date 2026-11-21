import { Hono, type Context, type Next } from 'npm:hono';
import { z } from 'npm:zod@4.6.5';
import { entries, reveal, summary, type VaultEntry } from './repositories/password-vault.ts';
import { sha256Hex } from './sha256.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const app = new Hono<{ Variables: { vaultEntry: VaultEntry } }>();
const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const rpc = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number().int()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});
const tool = {
  name: 'get_credential',
  description:
    'Retrieve the URL, username and password assigned to this connection. The response contains a secret.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
};
async function requireVaultConnection(c: Context, next: Next) {
  c.header('Cache-Control', 'no-store');
  const origin = c.req.header('Origin');
  if (
    origin &&
    !(Deno.env.get('NW_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .includes(origin)
  )
    return c.json({ error: 'Origin not allowed' }, 403);
  const match = /^Bearer (nwv_([a-f0-9-]{36})\.[A-Za-z0-9_-]{43})$/i.exec(
    c.req.header('Authorization') ?? '',
  );
  const entry = match && (await entries.get(match[2]));
  if (
    !entry?.connection ||
    !(Date.parse(entry.connection.expiresAt) > Date.now()) ||
    !constantTimeEqual(await sha256Hex(match![1]), entry.connection.hash)
  ) {
    c.header('WWW-Authenticate', 'Bearer realm="Navigate Wealth password vault"');
    return c.json({ error: 'Invalid or expired vault token' }, 401);
  }
  c.set('vaultEntry', entry);
  await next();
}
app.use('*', requireVaultConnection);
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
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: versions.includes(String(params?.protocolVersion))
          ? params?.protocolVersion
          : versions[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'navigate-wealth-password-vault', version: '1.0.0' },
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: [tool] });
    case 'tools/call': {
      const args = z
        .object({ name: z.literal(tool.name), arguments: z.object({}).strict().optional() })
        .safeParse(params);
      if (!args.success) return fail(id, -32602, 'Unknown tool or invalid arguments');
      const entry = c.get('vaultEntry');
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
      return ok({ content: [{ type: 'text', text: JSON.stringify({ url, username, password }) }] });
    }
    default:
      return fail(id, -32601, 'Method not found');
  }
});
app.all('/', (c) => {
  c.header('Allow', 'POST');
  return c.body(null, 405);
});
export default app;
