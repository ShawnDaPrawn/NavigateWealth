// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { kvStore, request } from './helpers/contract-harness.ts';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../auth-mw.ts', async () => {
  const h = await import('./helpers/contract-harness.ts');
  return {
    requireSuperAdmin: h.makeRoleGate(['super_admin'], 'FORBIDDEN', 'client'),
    requireAuth: h.makeRoleGate(['super_admin', 'admin', 'adviser'], 'FORBIDDEN', 'adviser'),
  };
});
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: { record: vi.fn() } }));
vi.mock('../vault-unlock.ts', () => ({
  requireUnlocked: (_c: unknown, next: () => Promise<void>) => next(),
  lockState: async () => ({
    unlocked: true,
    twoFactorEnabled: true,
    twoFactorRequired: true,
    expiresAt: null,
  }),
  unlock: async () => ({
    unlocked: true,
    twoFactorEnabled: true,
    twoFactorRequired: true,
    expiresAt: null,
  }),
  lock: async () => undefined,
}));
const keyRpc = vi.hoisted(() => vi.fn());
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    rpc: keyRpc,
    from: () => ({
      insert: ({ key, value }: { key: string; value: unknown }) => {
        if (kvStore.has(key)) return { error: { code: '23505' } };
        kvStore.set(key, value);
        return { error: null };
      },
      update: ({ value }: { value: Record<string, unknown> }) => ({
        eq: (_k: string, key: string) => ({
          eq: (field: string, expected: string) => ({
            select: () => {
              const current = kvStore.get(key) as Record<string, unknown> | undefined;
              if (!current || current[field.replace('value->>', '')] !== expected)
                return { data: [], error: null };
              kvStore.set(key, value);
              return { data: [{ key }], error: null };
            },
          }),
        }),
      }),
    }),
  }),
}));
// Single-use redemption is a conditional delete in Postgres; here the KV mock stands in.
vi.mock('../repositories/broker-ops.ts', async (original) => {
  const real = await original<typeof import('../repositories/broker-ops.ts')>();
  return {
    ...real,
    takeGrant: async (id: string) => {
      const row = await real.grants.get(id);
      if (row) await real.grants.remove(id);
      return row;
    },
  };
});
import type { Skill } from '../../../../shared/password-manager.ts';
import vault from '../password-vault-routes.ts';
import mcp from '../password-vault-mcp.ts';
import consentRoutes from '../broker-ops-admin.ts';
import tokenEndpoint from '../broker-ops-token.ts';
import { createHash } from 'node:crypto';
import { vaultResourceUrl, vaultWebsiteResourceUrl } from '../vault-connections.ts';

const admin = async (path: string, method = 'GET', body?: unknown) => {
  const res = await request(vault, path, { method, body, as: 'super_admin' });
  return { status: res.status, json: await res.json() };
};
let rpcId = 0;
const rpc = (token: string, method: string, params?: unknown, headers = {}) =>
  mcp.request('/', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
const tool = async (token: string, name: string, args: Record<string, unknown> = {}) => {
  const res = await rpc(token, 'tools/call', { name, arguments: args });
  if (res.status !== 200) return { status: res.status } as const;
  const json = await res.json();
  if (json.error) return { status: 200, error: json.error } as const;
  const text = json.result.content[0].text as string;
  const isError = Boolean(json.result.isError);
  let value: unknown = null;
  if (!isError) {
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
  }
  return { status: 200, isError, text, value } as const;
};
const toolNames = async (token: string) =>
  (await (await rpc(token, 'tools/list')).json()).result.tools.map(
    (t: { name: string }) => t.name,
  ) as string[];

const login = (name: string, serviceId: string, aiUse: string) => ({
  serviceId,
  name,
  url: 'https://' + name.toLowerCase().replace(/\W+/g, '') + '.example.org/login',
  username: name.toLowerCase().replace(/\W+/g, '') + '-user',
  password: name + ' Secret-Password-1',
  notes: '',
  aiUse,
});
const skill = (name: string, serviceId: string, credentialId: string | null = null) => ({
  name,
  whenToUse: 'When asked to ' + name.toLowerCase(),
  instructions: 'Steps for ' + name,
  serviceId,
  credentialId,
});

async function seed() {
  const ag = (
    await admin('/services', 'POST', {
      name: 'Allan Gray',
      website: '',
      description: 'Investments.',
    })
  ).json;
  const goaml = (await admin('/services', 'POST', { name: 'GoAML', website: '', description: '' }))
    .json;
  await admin('/', 'POST', {
    entries: [
      login('Broker 1', ag.id, 'allowed'),
      login('Broker 2', ag.id, 'ask'),
      login('Hidden', ag.id, 'off'),
      login('Reporting', goaml.id, 'allowed'),
      login('Platform', 'navigate-wealth', 'allowed'),
    ],
  });
  const items = (await admin('/')).json.items as { id: string; name: string }[];
  const id = (n: string) => items.find((i) => i.name === n)!.id;
  await admin('/skills', 'POST', skill('Download a statement', ag.id));
  await admin('/skills', 'POST', skill('Broker 1 quirks', ag.id, id('Broker 1')));
  await admin('/skills', 'POST', skill('File a report', goaml.id));
  return {
    ag: ag.id as string,
    goaml: goaml.id as string,
    b1: id('Broker 1'),
    b2: id('Broker 2'),
    hidden: id('Hidden'),
    reporting: id('Reporting'),
    platform: id('Platform'),
  };
}
async function connect(passwords: string, serviceIds: string[] | null = null) {
  const issued = await admin('/connections', 'POST', {
    name: 'Claude — test',
    tool: 'claude',
    serviceIds,
    passwords,
    redirectUri: '',
    expiresInDays: 90,
  });
  expect(issued.status).toBe(201);
  return { token: issued.json.token as string, id: issued.json.connection.id as string };
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  keyRpc.mockResolvedValue({ data: randomBytes(32).toString('base64') });
  vi.stubGlobal('Deno', { env: { get: () => undefined } });
});

describe('password manager — services and skills', () => {
  it('always has Navigate Wealth, first, and it cannot be deleted', async () => {
    const svc = (await admin('/services')).json.items as { id: string; builtIn: boolean }[];
    expect(svc[0]).toMatchObject({ id: 'navigate-wealth', builtIn: true });
    expect((await admin('/services/navigate-wealth', 'DELETE')).status).toBe(400);
    const renamed = await admin('/services/navigate-wealth', 'PUT', {
      name: 'Something else',
      website: 'https://www.navigatewealth.co/admin',
      description: 'Ours.',
    });
    expect(renamed.json).toMatchObject({ name: 'Navigate Wealth', description: 'Ours.' });
  });

  it('refuses duplicate service names and deleting a service that still has logins', async () => {
    const s = await seed();
    expect(
      (await admin('/services', 'POST', { name: 'allan gray', website: '', description: '' }))
        .status,
    ).toBe(409);
    expect((await admin('/services/' + s.ag, 'DELETE')).status).toBe(409);
    await admin('/' + s.reporting, 'DELETE');
    expect((await admin('/services/' + s.goaml, 'DELETE')).status).toBe(200);
    const names = ((await admin('/skills')).json.items as { name: string }[]).map((k) => k.name);
    expect(names).not.toContain('File a report');
  });

  it('files a login-only skill under its login’s service, whatever the client sent', async () => {
    const s = await seed();
    const row = (await admin('/skills', 'POST', skill('Odd one', s.goaml, s.b2))).json;
    expect(row).toMatchObject({ serviceId: s.ag, credentialId: s.b2 });
    expect((await admin('/skills', 'POST', skill('Lost', 'no-such-service'))).status).toBe(400);
    const stale = await admin('/skills/' + row.id, 'PUT', {
      revision: '00000000-0000-4000-8000-000000000000',
      skill: skill('Changed', s.ag, s.b2),
    });
    expect(stale.status).toBe(409);
  });
});

describe('password manager — moving a login', () => {
  it('moves the login’s own skills with it, so deleting the old service keeps them', async () => {
    const s = await seed();
    const b1 = ((await admin('/')).json.items as { id: string; revision: string }[]).find(
      (i) => i.id === s.b1,
    )!;
    const moved = await admin('/' + s.b1, 'PUT', {
      revision: b1.revision,
      credential: { ...login('Broker 1', s.goaml, 'allowed'), password: '' },
    });
    expect(moved.status).toBe(200);
    const own = ((await admin('/skills')).json.items as Skill[]).find(
      (k) => k.name === 'Broker 1 quirks',
    )!;
    expect(own.serviceId).toBe(s.goaml);
    await admin('/' + s.b2, 'DELETE');
    await admin('/' + s.hidden, 'DELETE');
    expect((await admin('/services/' + s.ag, 'DELETE')).status).toBe(200);
    const names = ((await admin('/skills')).json.items as Skill[]).map((k) => k.name);
    expect(names).toContain('Broker 1 quirks');
    expect(names).not.toContain('Download a statement');
  });
});

describe('password manager — MCP for outside AI agents', () => {
  it('finds logins in reach and never lists hidden ones', async () => {
    await seed();
    const { token } = await connect('allowed');
    const found = await tool(token, 'search_logins');
    const names = (found.value as { results: { name: string }[] }).results.map((r) => r.name);
    expect(names.sort()).toEqual(['Broker 1', 'Broker 2', 'Platform', 'Reporting']);

    const narrow = await connect('allowed', ['navigate-wealth']);
    const services = (await tool(narrow.token, 'list_services')).value as { id: string }[];
    expect(services.map((s) => s.id)).toEqual(['navigate-wealth']);
    const only = (await tool(narrow.token, 'search_logins')).value as {
      results: { name: string }[];
    };
    expect(only.results.map((r) => r.name)).toEqual(['Platform']);
  });

  it('gives an agent the shared skills, then the login’s own, and the platform map for Navigate Wealth', async () => {
    const s = await seed();
    const { token } = await connect('never');
    const b1 = (await tool(token, 'get_skills', { login_id: s.b1 })).text!;
    expect(b1.indexOf('Download a statement')).toBeGreaterThan(-1);
    expect(b1.indexOf('Broker 1 quirks')).toBeGreaterThan(b1.indexOf('Download a statement'));
    expect(b1).not.toContain('File a report');
    expect(b1).not.toContain('Secret-Password');
    const b2 = (await tool(token, 'get_skills', { login_id: s.b2 })).text!;
    expect(b2).toContain('Download a statement');
    expect(b2).not.toContain('Broker 1 quirks');
    const platform = (await tool(token, 'get_skills', { login_id: s.platform })).text!;
    expect(platform).toContain('Navigate Wealth platform map');
    expect(platform).toContain('https://www.navigatewealth.co/admin?module=clients');
    expect((await tool(token, 'get_skills', { login_id: s.hidden })).isError).toBe(true);
  });

  it('leaves out the password tools for an agent that may never receive passwords', async () => {
    await seed();
    const { token } = await connect('never');
    const names = await toolNames(token);
    expect(names).toContain('get_skills');
    expect(names).not.toContain('get_login');
    expect(names).not.toContain('get_one_time_code');
    const all = await toolNames((await connect('allowed')).token);
    expect(all).toEqual(expect.arrayContaining(['get_login', 'get_one_time_code']));
  });

  it('hands over an allowed password and records that the agent saw it', async () => {
    const s = await seed();
    const { token } = await connect('allowed');
    const got = await tool(token, 'get_login', { login_id: s.b1, reason: 'Statement for October' });
    expect(got.value).toMatchObject({
      username: 'broker1-user',
      password: 'Broker 1 Secret-Password-1',
    });
    const item = (
      (await admin('/')).json.items as { id: string; health: { exposed: boolean } }[]
    ).find((i) => i.id === s.b1)!;
    expect(item.health.exposed).toBe(true);
  });

  it('makes an “ask me first” login wait for a person, then uses the approval once', async () => {
    const s = await seed();
    const { token } = await connect('allowed');
    const first = await tool(token, 'get_login', { login_id: s.b2, reason: 'Statement' });
    const waiting = first.value as { status: string; approval_id: string };
    expect(waiting.status).toBe('waiting_for_approval');
    expect(JSON.stringify(first.value)).not.toContain('Secret-Password');
    expect((await admin('/approvals')).json.items).toHaveLength(1);
    expect((await admin('/approvals/' + waiting.approval_id + '/approve', 'POST')).status).toBe(
      200,
    );
    expect(
      (
        (await tool(token, 'get_approval_status', { approval_id: waiting.approval_id })).value as {
          state: string;
        }
      ).state,
    ).toBe('approved');
    const again = { login_id: s.b2, reason: 'Statement', approval_id: waiting.approval_id };
    expect((await tool(token, 'get_login', again)).value).toMatchObject({
      password: 'Broker 2 Secret-Password-1',
    });
    expect(((await tool(token, 'get_login', again)).value as { status: string }).status).toBe(
      'waiting_for_approval',
    );
  });

  it('asks every time for an agent set to ask, and refuses a denied request', async () => {
    const s = await seed();
    const { token } = await connect('ask');
    const first = (await tool(token, 'get_login', { login_id: s.b1, reason: 'x' })).value as {
      approval_id: string;
    };
    await admin('/approvals/' + first.approval_id + '/deny', 'POST');
    const retry = await tool(token, 'get_login', {
      login_id: s.b1,
      reason: 'x',
      approval_id: first.approval_id,
    });
    expect((retry.value as { status: string }).status).toBe('waiting_for_approval');
  });

  it('stops answering when an agent is paused, all AI is paused, or it is disconnected', async () => {
    await seed();
    const { token, id } = await connect('allowed');
    expect((await rpc(token, 'tools/list')).status).toBe(200);
    expect(
      (await rpc(token, 'tools/list', undefined, { Origin: 'https://unknown.example' })).status,
    ).toBe(403);
    await admin('/connections/' + id, 'PUT', { status: 'paused' });
    expect((await rpc(token, 'tools/list')).status).toBe(403);
    await admin('/connections/' + id, 'PUT', { status: 'active' });
    await admin('/connections/pause-all', 'POST');
    expect((await rpc(token, 'tools/list')).status).toBe(403);
    await admin('/connections/resume-all', 'POST');
    expect((await rpc(token, 'tools/list')).status).toBe(200);
    expect((await admin('/connections/' + id + '/revoke', 'POST')).status).toBe(200);
    expect((await rpc(token, 'tools/list')).status).toBe(401);
    expect(JSON.stringify([...kvStore.values()])).not.toContain(token);
  });

  it('never writes a vault token to the log, even one sent without a scheme', async () => {
    // Codex review on #568: logging the header's first word logged a bare token whole.
    const { token } = await connect('never');
    const written: string[] = [];
    const prior = (globalThis as { Deno?: object }).Deno;
    vi.stubGlobal('Deno', {
      ...prior,
      stderr: {
        writeSync: (bytes: Uint8Array) => {
          written.push(new TextDecoder().decode(bytes));
          return bytes.length;
        },
      },
    });
    try {
      for (const authorization of [token, 'Bearer ' + token, 'Token ' + token])
        await mcp.request('/', {
          method: 'POST',
          headers: { Authorization: authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
        });
    } finally {
      vi.unstubAllGlobals();
    }
    const log = written.join('');
    expect(log).toContain('Vault MCP request');
    expect(log).not.toContain(token);
    expect(log).not.toContain(token.split('.')[1]);
  });

  it('describes the direct address for discovery and points each caller at its own metadata', async () => {
    // Connectors use the direct address so their calls skip Vercel's edge firewall,
    // which dropped Claude's first authenticated call on 2026-11-25.
    const meta = await mcp.request('/.well-known/oauth-protected-resource');
    expect(meta.status).toBe(200);
    expect(await meta.json()).toMatchObject({
      resource: vaultResourceUrl,
      authorization_servers: ['https://www.navigatewealth.co'],
    });
    expect(vaultResourceUrl).toMatch(
      /^https:\/\/[a-z]+\.supabase\.co\/functions\/v1\/make-server-91ed8379\/mcp\/password-vault$/,
    );
    const challenge = async (headers: Record<string, string>) =>
      (await mcp.request('/', { method: 'POST', headers })).headers.get('WWW-Authenticate');
    expect(await challenge({})).toContain(
      vaultResourceUrl + '/.well-known/oauth-protected-resource',
    );
    expect(await challenge({ 'x-forwarded-host': 'www.navigatewealth.co' })).toContain(
      'https://www.navigatewealth.co/.well-known/oauth-protected-resource/mcp/password-vault',
    );
  });

  it.each([vaultResourceUrl, vaultWebsiteResourceUrl])(
    'signs an agent in for %s and its token opens the vault',
    async (resource) => {
      const redirectUri = 'https://claude.ai/api/mcp/auth_callback';
      const issued = await admin('/connections', 'POST', {
        name: 'Claude — OAuth',
        tool: 'claude',
        serviceIds: null,
        passwords: 'never',
        redirectUri,
        expiresInDays: 90,
      });
      expect(issued.status).toBe(201);
      const verifier = 'v'.repeat(64);
      const params = {
        client_id: issued.json.connection.id,
        redirect_uri: redirectUri,
        state: 'fixture',
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        response_type: 'code',
        resource,
        scope: 'vault',
      };
      const approved = await request(consentRoutes, '/consent/approve', {
        method: 'POST',
        body: params,
        as: 'super_admin',
      });
      expect(approved.status).toBe(200);
      const code = new URL((await approved.json()).redirect).searchParams.get('code')!;
      const exchange = (sentResource: string) =>
        tokenEndpoint.request('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: params.client_id,
            client_secret: issued.json.clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: verifier,
            code,
            resource: sentResource,
          }),
        });
      // The code is bound to the address it was granted for.
      const other = resource === vaultResourceUrl ? vaultWebsiteResourceUrl : vaultResourceUrl;
      expect((await exchange(other)).status).toBe(400);
      const token = await exchange(resource);
      expect(token.status).toBe(200);
      const { access_token } = await token.json();
      expect((await rpc(access_token, 'tools/list')).status).toBe(200);
    },
  );

  it('answers initialize with instructions and accepts notifications', async () => {
    const { token } = await connect('never');
    const init = await (await rpc(token, 'initialize', { protocolVersion: '2025-06-18' })).json();
    expect(init.result.protocolVersion).toBe('2025-06-18');
    expect(init.result.instructions).toContain('get_skills');
    const note = await mcp.request('/', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(note.status).toBe(202);
  });
});
