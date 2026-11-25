// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { makeRoleGate, request } from './helpers/contract-harness.ts';
import type { StoredRun, Batch, Client, Grant } from '../repositories/broker-ops.ts';
import type { Workflow, Broker, Selectors } from '../../../../shared/broker-operations.ts';
import { selectorFields } from '../../../../shared/broker-operations.ts';
const memory = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../auth-mw.ts', () => ({
  requireSuperAdmin: makeRoleGate(['super_admin'], 'DENIED', 'client'),
}));
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: { record: vi.fn() } }));
vi.mock('../integrations-portal-runtime.ts', () => ({
  getPortalGitHubActionsConfig: () => ({
    token: 'test',
    apiBase: 'https://example.com',
    repo: 'local/report',
    ref: 'main',
  }),
}));
vi.mock('../repositories/broker-ops.ts', async (original) => {
  const real = await original<typeof import('../repositories/broker-ops.ts')>();
  function store<T>(prefix: string) {
    return {
      get: async (id: string) => memory.get(prefix + id) as T | undefined,
      put: async (id: string, row: T) => memory.set(prefix + id, structuredClone(row)),
      remove: async (id: string) => memory.delete(prefix + id),
      listAll: async () => [...memory].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v as T),
    };
  }
  const brokers = store<Broker>('b'),
    workflows = store<Workflow>('w'),
    runs = store<StoredRun>('j'),
    clients = store<Client>('c'),
    grants = store<Grant>('g'),
    batches = store<Batch>('q');
  return {
    ...real,
    brokers,
    workflows,
    runs,
    clients,
    grants,
    batches,
    createRuns: async (b: Batch, rows: StoredRun[]) => {
      if (memory.has('q' + b.id)) return false;
      memory.set('q' + b.id, b);
      rows.forEach((r) => memory.set('j' + r.id, r));
      return true;
    },
    changeRun: async (r: StoredRun, patch: Partial<StoredRun>) => {
      const current = await runs.get(r.id);
      if (current?.revision !== r.revision) return null;
      const row = { ...r, ...patch, revision: crypto.randomUUID() };
      await runs.put(row.id, row);
      return row;
    },
    takeGrant: async (k: string) => {
      const row = await grants.get(k);
      await grants.remove(k);
      return row;
    },
    updateClient: async (r: Client, patch: Partial<Client>) => {
      if (!(await clients.get(r.id))) return false;
      await clients.put(r.id, { ...r, ...patch });
      return true;
    },
    db: () => ({
      storage: {
        from: () => ({
          upload: async (path: string, file: File) => {
            memory.set('file:' + path, file.size);
            return { error: null };
          },
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: 'https://example.com/' + path },
            error: null,
          }),
        }),
      },
    }),
    latestRuns: async () => (await runs.listAll()).map(real.publicRun),
  };
});
vi.mock('../repositories/password-vault.ts', () => ({
  entries: {
    get: async (id: string) => memory.get('a' + id),
    list: async () => ({
      items: [...memory].filter(([k]) => k.startsWith('a')).map(([, v]) => v),
      nextCursor: null,
    }),
  },
  summary: async (row: object) => row,
  reveal: async () => ({ password: 'fixture-password' }),
}));
import admin from '../broker-ops-admin.ts';
import mcp from '../broker-ops-mcp.ts';
import worker from '../broker-ops-worker.ts';
import tokenEndpoint from '../broker-ops-token.ts';
import { resourceUrl } from '../broker-ops-jobs.ts';
const manage = (path: string, method = 'GET', body?: unknown) =>
  request(admin, path, { method, body, as: 'super_admin' });
async function json(response: Promise<Response>) {
  const r = await response;
  expect(r.ok).toBe(true);
  return r.json();
}
const connect = () => json(manage('/connections', 'POST', { name: 'Fixture', redirectUri: '' }));
async function rpc(token: string, name: string, args: unknown = {}) {
  const response = await mcp.request('/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  return response.json();
}
const result = (data: { result: { content: { text: string }[] } }) =>
  JSON.parse(data.result.content[0].text);
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => (key === 'NW_PORTAL_WORKER_SECRET' ? 'fixture-worker' : undefined),
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
});
describe('broker operations', () => {
  it('requires super admin for setup and a named assistant token for MCP', async () => {
    expect((await request(admin, '/setup', { as: 'admin' })).status).toBe(403);
    expect((await mcp.request('/')).status).toBe(401);
    const { token, client } = await connect();
    expect(result(await rpc(token, 'find_portal_accounts')).accounts).toEqual([]);
    const list = await json(
      mcp.request('/', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );
    expect(list.result.tools.map((t: { name: string }) => t.name)).toContain('start_portal_job');
    expect(list.result.tools.map((t: { name: string }) => t.name)).not.toContain('get_credential');
    await manage('/connections/' + client.id, 'DELETE');
    expect((await mcp.request('/', { headers: { Authorization: 'Bearer ' + token } })).status).toBe(
      401,
    );
  });
  it('binds OAuth code to the client, callback and PKCE verifier and consumes it once', async () => {
    const redirectUri = 'https://example.com/callback';
    const { client, clientSecret } = await json(
      manage('/connections', 'POST', { name: 'Claude', redirectUri }),
    );
    const verifier = 'x'.repeat(64),
      params = {
        client_id: client.id,
        redirect_uri: redirectUri,
        state: 'fixture-state',
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        response_type: 'code',
        resource: resourceUrl,
      };
    expect(
      (
        await manage('/consent/approve', 'POST', {
          ...params,
          redirect_uri: redirectUri + '/unexpected',
        })
      ).status,
    ).toBe(400);
    const approval = await json(manage('/consent/approve', 'POST', params));
    const url = new URL(approval.redirect);
    expect(url.searchParams.get('state')).toBe(params.state);
    const redeem = (v: string) =>
      tokenEndpoint.request('/', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: client.id,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: v,
          code: url.searchParams.get('code')!,
        }),
      });
    expect((await redeem('y'.repeat(64))).status).toBe(400);
    const auth = await json(redeem(verifier));
    expect(auth.access_token).toMatch(/^nwop_/);
    expect((await redeem(verifier)).status).toBe(400);
  });
  it('accepts the authorize request shapes real MCP clients send, and still binds the resource', async () => {
    // The first real Claude sign-in (2026-11-24) was refused as "Validation
    // failed" while scope and resource were exact enums.
    const redirectUri = 'https://example.com/callback';
    const { client, clientSecret } = await json(
      manage('/connections', 'POST', { name: 'Claude', redirectUri }),
    );
    const verifier = 'z'.repeat(64),
      params = {
        client_id: ' ' + client.id + ' ',
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        response_type: 'code',
        resource: resourceUrl + '/',
        scope: 'portal.jobs vault',
      };
    const details = await manage('/consent/details', 'POST', params);
    expect(details.status).toBe(200);
    const other = await manage('/consent/details', 'POST', {
      ...params,
      resource: 'https://www.navigatewealth.co/mcp/password-vault',
    });
    expect(other.status).toBe(400);
    expect((await other.json()).error).toMatch(/this connection is for/);
    // Each refusal names its own fix (2026-11-25: one shared message hid which).
    const callback = await manage('/consent/details', 'POST', {
      ...params,
      redirect_uri: 'https://chatgpt.com/elsewhere',
    });
    expect(callback.status).toBe(400);
    expect((await callback.json()).error).toMatch(
      /asked to return to https:\/\/chatgpt\.com\/elsewhere, but this connection was set up with https:\/\/example\.com\/callback/,
    );

    const approval = await json(manage('/consent/approve', 'POST', params));
    const url = new URL(approval.redirect);
    expect(url.searchParams.has('state')).toBe(false);
    const auth = await json(
      tokenEndpoint.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.id,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
          code: url.searchParams.get('code')!,
          resource: resourceUrl + '/',
        }),
      }),
    );
    expect(auth.access_token).toMatch(/^nwop_/);
    // Omitted so clients that compare it with their requested scope accept the token.
    expect(auth).not.toHaveProperty('scope');
    expect(auth.token_type).toBe('Bearer');
  });
  it('starts one job per linked broker, isolates assistants, preserves partial results, and rejects stale worker updates', async () => {
    const [a, b] = await Promise.all(
      ['Broker A', 'Broker B'].map((name) => json(manage('/brokers', 'POST', { name }))),
    );
    const selectors = Object.fromEntries(selectorFields.map((k) => [k, '.' + k])) as Selectors;
    const workflow = await json(
      manage('/workflows', 'POST', {
        name: 'Report',
        provider: 'brightrock',
        kind: 'monthly_statement',
        selectors,
      }),
    );
    const accountId = crypto.randomUUID(),
      url = 'https://iris.brightrock.co.za/';
    memory.set('a' + accountId, {
      id: accountId,
      name: 'Practice',
      url,
      username: 'fixture',
      portal: {
        provider: 'brightrock',
        expectedIdentity: 'Practice',
        homeUrl: url,
        brokers: [
          { brokerId: a.id, code: 'A' },
          { brokerId: b.id, code: 'B' },
        ],
      },
    });
    const { token } = await connect();
    const input = {
      accountId,
      requestId: crypto.randomUUID(),
      brokerIds: [a.id, b.id],
      workflowId: workflow.id,
      month: '2026-10',
    };
    const first = result(await rpc(token, 'start_portal_job', input));
    expect(first.runs).toHaveLength(2);
    expect(result(await rpc(token, 'start_portal_job', input))).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      (await rpc(token, 'start_portal_job', { ...input, month: '2026-11' })).result.isError,
    ).toBe(true);
    expect(
      (await rpc((await connect()).token, 'get_job_status', { batchId: first.batchId })).result
        .isError,
    ).toBe(true);
    const [one, two] = first.runs;
    const workerCall = (id: string, path: string, lease = '', data?: unknown) =>
      worker.request('/' + id + '/' + path, {
        method: 'POST',
        headers: {
          'X-Portal-Worker-Secret': 'fixture-worker',
          'X-Run-Lease': lease,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data ?? {}),
      });
    const ticket = await json(workerCall(one.id, 'claim'));
    expect(ticket.password).toBe('fixture-password');
    expect((await workerCall(one.id, 'claim')).status).toBe(409);
    expect((await workerCall(one.id, 'event', 'wrong', { event: 'verified' })).status).toBe(403);
    await json(workerCall(one.id, 'event', ticket.lease, { event: 'mfa' }));
    await json(manage('/runs/' + one.id + '/resume', 'POST'));
    expect(
      (
        await workerCall(one.id, 'event', ticket.lease, {
          event: 'verified',
          identity: 'Practice',
          code: 'other',
        })
      ).status,
    ).toBe(409);
    await json(
      workerCall(one.id, 'event', ticket.lease, {
        event: 'missing',
        identity: 'Practice',
        code: one.code,
      }),
    );
    await json(manage('/runs/' + two.id + '/cancel', 'POST'));
    expect((await workerCall(two.id, 'claim')).status).toBe(409);
    const replay = result(
      await rpc(token, 'start_portal_job', {
        ...input,
        requestId: crypto.randomUUID(),
        brokerIds: [two.brokerId],
      }),
    );
    const retry = replay.runs[0],
      claim = await json(workerCall(retry.id, 'claim'));
    await json(
      workerCall(retry.id, 'event', claim.lease, {
        event: 'verified',
        identity: 'Practice',
        code: retry.code,
      }),
    );
    const form = new FormData();
    form.set('file', new Blob(['%PDF-fixture'], { type: 'application/pdf' }), 'statement.pdf');
    form.set('code', retry.code);
    form.set('month', input.month);
    expect(
      (
        await worker.request('/' + retry.id + '/document', {
          method: 'POST',
          headers: { 'X-Portal-Worker-Secret': 'fixture-worker', 'X-Run-Lease': claim.lease },
          body: form,
        })
      ).status,
    ).toBe(200);
    const finished = result(await rpc(token, 'get_job_results', { jobId: retry.id })).runs[0];
    expect(finished.state).toBe('completed');
    expect(finished.document).toContain(retry.brokerId + '/brightrock/2026-10/');
    expect((await json(manage('/runs/' + retry.id + '/document', 'POST'))).url).toContain(
      finished.document,
    );
    const report = result(await rpc(token, 'get_job_results', { batchId: first.batchId }));
    expect(report.runs.map((r: StoredRun) => r.state)).toEqual(['missing', 'cancelled']);
    expect(JSON.stringify(report)).not.toContain(ticket.lease);
    expect(JSON.stringify(report)).not.toContain('fixture-password');
  });
});
