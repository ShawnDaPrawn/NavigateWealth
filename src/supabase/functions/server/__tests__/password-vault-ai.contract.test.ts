// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { kvStore, request } from './helpers/contract-harness.ts';
import { autonomyPreset } from '../../../../shared/password-manager.ts';

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
  lockState: async () => ({ unlocked: true, twoFactorEnabled: true, expiresAt: null }),
  unlock: async () => ({ unlocked: true, twoFactorEnabled: true, expiresAt: null }),
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
import vault from '../password-vault-routes.ts';
import mcp from '../password-vault-mcp.ts';
import mine from '../password-vault-mine.ts';

const OWNER = '00000000-0000-4000-8000-0000000000aa';
const admin = async (path: string, method = 'GET', body?: unknown) => {
  const res = await request(vault, path, { method, body, as: 'super_admin' });
  return { status: res.status, json: await res.json() };
};
let rpcId = 0;
const tool = async (token: string, name: string, args: Record<string, unknown> = {}) => {
  const res = await mcp.request('/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  if (res.status !== 200) return { status: res.status } as const;
  const json = await res.json();
  if (json.error) return { status: 200, error: json.error } as const;
  const text = json.result.content[0].text as string;
  return {
    status: 200,
    isError: Boolean(json.result.isError),
    text,
    value: json.result.isError ? null : JSON.parse(text),
  } as const;
};
const toolNames = async (token: string) => {
  const res = await mcp.request('/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  return (await res.json()).result.tools.map((t: { name: string }) => t.name) as string[];
};
const login = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  url: 'https://' + name.toLowerCase() + '.example.org/login',
  username: name.toLowerCase() + '-user',
  password: name + ' Secret-Password-1',
  notes: '',
  ...extra,
});
async function seed() {
  const helen = (
    await admin('/collections', 'POST', {
      name: 'Helen',
      kind: 'person',
      ownerUserId: OWNER,
      ownerName: 'Helen',
    })
  ).json;
  await admin('/', 'POST', {
    entries: [
      login('Alpha', { aiAccess: 'reveal' }),
      login('Bank', { aiAccess: 'never' }),
      login('Helenportal', { aiAccess: 'use', collectionId: helen.id }),
    ],
  });
  const items = (await admin('/')).json.items as { id: string; name: string }[];
  const id = (n: string) => items.find((i) => i.name === n)!.id;
  return {
    helen: helen.id as string,
    alpha: id('Alpha'),
    bank: id('Bank'),
    helenLogin: id('Helenportal'),
  };
}
async function connect(level: string, autonomy: string, collectionIds: string[]) {
  const issued = await admin('/connections', 'POST', {
    name: 'Claude — test',
    personUserId: OWNER,
    personName: 'Helen',
    tool: 'claude',
    collectionIds,
    tagFilter: null,
    level,
    autonomy: autonomyPreset(autonomy as 'full'),
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

describe('password vault — collections and AI connections', () => {
  it('seals each collection with its own key and never stores secrets in clear', async () => {
    await seed();
    const stored = JSON.stringify([...kvStore.entries()]);
    expect(stored).not.toContain('Alpha Secret-Password-1');
    const cols = (await admin('/collections')).json.items as {
      id: string;
      count: number;
      wrappedKey?: unknown;
    }[];
    expect(cols.map((c) => c.count).sort()).toEqual([1, 2]);
    expect(cols.every((c) => c.wrappedKey === undefined)).toBe(true);
  });

  it('scopes search to the connection’s collections and hides “never” logins below Full access', async () => {
    const s = await seed();
    const { token } = await connect('reveal', 'full', ['brokerage']);
    const found = await tool(token, 'search_credentials');
    expect(found.value.results.map((r: { name: string }) => r.name)).toEqual(['Alpha']);
    const full = await connect('full', 'full', ['brokerage', s.helen]);
    const all = await tool(full.token, 'search_credentials');
    expect(all.value.results.map((r: { name: string }) => r.name).sort()).toEqual([
      'Alpha',
      'Bank',
      'Helenportal',
    ]);
    expect(
      (await tool(token, 'get_credential', { credential_id: s.helenLogin, reason: 'x' })).text,
    ).toBe('Unknown login.');
  });

  it('leaves tools above the connection’s level out of tools/list', async () => {
    const { token } = await connect('find', 'full', ['brokerage']);
    const names = await toolNames(token);
    expect(names).toContain('search_credentials');
    expect(names).not.toContain('start_workflow');
    expect(names).not.toContain('get_credential');
    expect(
      (await tool(token, 'get_credential', { credential_id: crypto.randomUUID(), reason: 'x' }))
        .error?.code,
    ).toBe(-32602);
  });

  it('reveals with no human in the loop under Full autonomy and marks the login as seen by AI', async () => {
    const s = await seed();
    const { token, id } = await connect('reveal', 'full', ['brokerage']);
    const res = await tool(token, 'get_credential', {
      credential_id: s.alpha,
      reason: 'File the return',
    });
    expect(res.value).toEqual({
      website: login('Alpha').url,
      username: 'alpha-user',
      password: 'Alpha Secret-Password-1',
    });
    const item = (await admin('/')).json.items.find((i: { id: string }) => i.id === s.alpha);
    expect(item.seenByAi[0].connectionId).toBe(id);
    expect(item.health.exposed).toBe(true);
    const revoked = await admin('/connections/' + id + '/revoke', 'POST');
    expect(revoked.json.seen.map((r: { name: string }) => r.name)).toEqual(['Alpha']);
    expect((await tool(token, 'search_credentials')).status).toBe(401);
  });

  it('waits for a person under Supervised, then accepts the approval exactly once', async () => {
    const s = await seed();
    const { token } = await connect('reveal', 'supervised', ['brokerage']);
    const first = await tool(token, 'get_credential', {
      credential_id: s.alpha,
      reason: 'Check a payment',
    });
    expect(first.value.status).toBe('waiting_for_approval');
    const pending = (await admin('/approvals')).json.items;
    expect(pending).toHaveLength(1);
    expect(
      (await admin('/approvals/' + first.value.approval_id + '/approve', 'POST')).json.state,
    ).toBe('approved');
    expect(
      (await tool(token, 'get_approval_status', { approval_id: first.value.approval_id })).value
        .state,
    ).toBe('approved');
    const second = await tool(token, 'get_credential', {
      credential_id: s.alpha,
      reason: 'Check a payment',
      approval_id: first.value.approval_id,
    });
    expect(second.value.password).toBe('Alpha Secret-Password-1');
    const again = await tool(token, 'get_credential', {
      credential_id: s.alpha,
      reason: 'Again',
      approval_id: first.value.approval_id,
    });
    expect(again.value.status).toBe('waiting_for_approval');
  });

  it('pausing all AI access stops every connection until resumed', async () => {
    await seed();
    const { token } = await connect('find', 'full', ['brokerage']);
    await admin('/connections/pause-all', 'POST');
    expect((await tool(token, 'search_credentials')).status).toBe(403);
    await admin('/connections/resume-all', 'POST');
    expect((await tool(token, 'search_credentials')).status).toBe(200);
  });
});

describe('password vault — workflows and skills', () => {
  const skill = {
    name: 'Update policy details',
    description: 'Change beneficiaries',
    kind: 'skill',
    risk: 'change',
    automatedWorkflowId: null,
    inputs: [{ name: 'policy_number', type: 'text', required: true, description: '' }],
    steps: [
      { text: 'Open the policy', checkpoint: false },
      { text: 'Press Save', checkpoint: true },
    ],
    guardrails: {
      allowedOrigins: [],
      checkpointLabels: ['Save'],
      never: ['Change fees'],
      stopIf: [],
    },
    returns: 'The reference',
  };

  it('publishes a skill, serves it to the AI and fails clearly without a browser host', async () => {
    const s = await seed();
    const created = await admin('/' + s.alpha + '/workflows', 'POST', skill);
    expect(created.status).toBe(201);
    const { token } = await connect('use', 'full', ['brokerage']);
    expect((await tool(token, 'list_workflows', { credential_id: s.alpha })).value).toEqual([]);
    expect(
      (await admin('/workflows/' + created.json.id + '/publish', 'POST')).json.liveVersion,
    ).toBe(1);
    const listed = await tool(token, 'list_workflows', { credential_id: s.alpha });
    expect(listed.value[0].name).toBe('Update policy details');
    const read = await tool(token, 'get_skill', { workflow_id: created.json.id });
    expect(read.value.skill).toContain('2. Press Save  [checkpoint]');
    expect(read.value.skill).toContain('- Change fees');
    const missing = await tool(token, 'start_workflow', {
      workflow_id: created.json.id,
      inputs: {},
      request_id: crypto.randomUUID(),
    });
    expect(missing.text).toBe('Missing input: policy_number');
    const request_id = crypto.randomUUID();
    const started = await tool(token, 'start_workflow', {
      workflow_id: created.json.id,
      inputs: { policy_number: 'AG1' },
      request_id,
    });
    expect(started.value.run.state).toBe('failed');
    expect(started.value.run.message).toContain('browser host');
    const replay = await tool(token, 'start_workflow', {
      workflow_id: created.json.id,
      inputs: { policy_number: 'AG1' },
      request_id,
    });
    expect(replay.value.run.id).toBe(started.value.run.id);
  });

  it('blocks a workflow the connection’s autonomy does not allow', async () => {
    const s = await seed();
    const wf = (await admin('/' + s.alpha + '/workflows', 'POST', { ...skill, risk: 'money' }))
      .json;
    await admin('/workflows/' + wf.id + '/publish', 'POST');
    const policy = {
      ...autonomyPreset('full'),
      level: 'custom',
      actions: { ...autonomyPreset('full').actions, money_workflow: 'deny' },
    };
    const conn = await connect('use', 'full', ['brokerage']);
    await admin('/connections/' + conn.id, 'PUT', { autonomy: policy });
    const run = await tool(conn.token, 'start_workflow', {
      workflow_id: wf.id,
      inputs: { policy_number: 'AG1' },
      request_id: crypto.randomUUID(),
    });
    expect(run.value.run.state).toBe('blocked');
  });
});

describe('password vault — review fixes', () => {
  const base = {
    description: '',
    automatedWorkflowId: null,
    guardrails: { allowedOrigins: [], checkpointLabels: [], never: [], stopIf: [] },
    returns: '',
  };

  it('rejects invalid amounts and fails closed when a set limit cannot be checked', async () => {
    const s = await seed();
    const wf = (
      await admin('/' + s.alpha + '/workflows', 'POST', {
        ...base,
        name: 'Switch',
        kind: 'skill',
        risk: 'money',
        inputs: [{ name: 'amount', type: 'amount', required: false, description: '' }],
        steps: [{ text: 'Submit', checkpoint: true }],
      })
    ).json;
    await admin('/workflows/' + wf.id + '/publish', 'POST');
    const policy = autonomyPreset('full');
    const conn = await connect('use', 'full', ['brokerage']);
    await admin('/connections/' + conn.id, 'PUT', {
      autonomy: {
        ...policy,
        level: 'custom',
        checks: { ...policy.checks, per_instruction_limit: 'block' },
        limits: { ...policy.limits, perInstruction: 1000 },
      },
    });
    const start = (inputs: Record<string, unknown>) =>
      tool(conn.token, 'start_workflow', {
        workflow_id: wf.id,
        inputs,
        request_id: crypto.randomUUID(),
      });
    expect((await start({ amount: 'not-a-number' })).text).toContain('must be a number');
    expect((await start({ amount: -5 })).text).toContain('must be a number');
    expect((await start({})).value.run.state).toBe('blocked');
    expect((await start({ amount: 5000 })).value.run.state).toBe('blocked');
  });

  it('resumes the version that was approved, not a newer one', async () => {
    const s = await seed();
    const draft = {
      ...base,
      name: 'Update',
      kind: 'skill',
      risk: 'change',
      inputs: [],
      steps: [{ text: 'Do it', checkpoint: false }],
    };
    const wf = (await admin('/' + s.alpha + '/workflows', 'POST', draft)).json;
    await admin('/workflows/' + wf.id + '/publish', 'POST');
    const conn = await connect('use', 'supervised', ['brokerage']);
    const started = await tool(conn.token, 'start_workflow', {
      workflow_id: wf.id,
      inputs: {},
      request_id: crypto.randomUUID(),
    });
    expect(started.value.run.state).toBe('waiting_for_approval');
    const current = (await admin('/workflows?credential=' + s.alpha)).json.items[0];
    await admin('/workflows/' + wf.id, 'PUT', {
      revision: current.revision,
      workflow: { ...draft, kind: 'automated', automatedWorkflowId: 'reporting-workflow' },
    });
    await admin('/workflows/' + wf.id + '/publish', 'POST');
    await admin('/approvals/' + started.value.run.approvalId + '/approve', 'POST');
    const run = (await admin('/runs/' + started.value.run.id)).json;
    expect(run.workflowVersion).toBe(1);
    // Version 1 is a skill, so it asks for the browser host; version 2 would have queued a report.
    expect(run.message).toContain('browser host');
  });
});

describe('password vault — collection owners', () => {
  it('lets an owner replace a password without ever reading one', async () => {
    const s = await seed();
    const listed = await request(mine, '/', { user: OWNER });
    const body = await listed.json();
    expect(body.items.map((i: { name: string }) => i.name)).toEqual(['Helenportal']);
    expect(JSON.stringify(body)).not.toContain('Secret-Password');
    expect(
      (
        await request(mine, '/' + s.alpha + '/password', {
          user: OWNER,
          method: 'PUT',
          body: { password: 'x' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(mine, '/' + s.helenLogin + '/password', {
          user: OWNER,
          method: 'PUT',
          body: { password: 'New-Password-2026!' },
        })
      ).status,
    ).toBe(200);
    expect((await admin('/' + s.helenLogin + '/reveal', 'POST')).json.password).toBe(
      'New-Password-2026!',
    );
  });
});
