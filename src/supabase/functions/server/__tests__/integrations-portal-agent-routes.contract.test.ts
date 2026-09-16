/**
 * integrations-portal-agent-routes.ts — Gate & Action Containment
 * ===============================================================
 *
 * The navigator agent is the only place in the product where a language model
 * decides what a browser does next while signed in to a provider portal with
 * the firm's credentials. Two properties therefore matter more than any
 * feature of it:
 *
 *   1. **The worker gate.** All three routes are worker-secret authenticated.
 *      A route added later without the guard ships open, so the gate is
 *      asserted per route rather than assumed.
 *   2. **Action containment.** Whatever the model returns, only an action
 *      naming an element the worker actually saw may come back — and never a
 *      model-authored string aimed at a password field, nor a navigation off
 *      the provider's own host. These are asserted through the route, not just
 *      against the parser, because the route is what the worker calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';

const WORKER_SECRET = 'worker-secret';
const JOB = 'job-agent-1';
const PROVIDER = 'acme-life';
const CATEGORY = 'risk_planning';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (key: string) => {
        if (key === 'NW_PORTAL_WORKER_SECRET') return WORKER_SECRET;
        if (key === 'NW_GOOGLE_AI_API_KEY') return 'test-key';
        return undefined;
      },
    },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const flowState: { agent: Record<string, unknown> } = { agent: { enabled: true } };

vi.mock('../integrations-portal-flow.ts', () => ({
  getPortalFlow: vi.fn(async () => ({
    id: 'flow-1',
    providerId: PROVIDER,
    loginUrl: 'https://portal.acme.co.za/login',
    agent: flowState.agent,
  })),
}));

const { default: app } = await import('../integrations-portal-agent-routes.ts');

/** The observation a worker sends: one text input, one password, one button. */
const observation = {
  url: 'https://portal.acme.co.za/search',
  title: 'Search',
  heading: 'Find a policy',
  pageTextSample: 'Search by policy number',
  candidates: [
    { candidateId: 'c1', tag: 'input', type: 'text', name: 'q', placeholder: 'Policy number' },
    { candidateId: 'c2', tag: 'input', type: 'password', name: 'pw' },
    { candidateId: 'c3', tag: 'button', text: 'Search' },
  ],
};

/** Make the navigator model return exactly this decision. */
function stubModel(decision: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(decision) }] } }],
      }),
    })),
  );
}

function call(path: string, body?: unknown, { secret = WORKER_SECRET, method = 'POST' } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Portal-Worker-Secret'] = secret;
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const decidePath = `/portal-worker/jobs/${JOB}/agent/decide`;
const playbookPath = `/portal-worker/jobs/${JOB}/agent/playbook`;

beforeEach(() => {
  vi.unstubAllGlobals();
  kvStore.clear();
  flowState.agent = { enabled: true };
  kvStore.set(`portal-job:${JOB}`, {
    id: JOB,
    providerId: PROVIDER,
    providerName: 'Acme Life',
    categoryId: CATEGORY,
  });
  kvStore.set(`provider:${PROVIDER}`, { id: PROVIDER, name: 'Acme Life' });
});

describe('navigator routes — the worker gate', () => {
  it('refuses every route without the worker secret', async () => {
    const withoutSecret = { secret: '' };
    expect((await call(decidePath, {}, withoutSecret)).status).toBe(401);
    expect((await call(playbookPath, {}, withoutSecret)).status).toBe(401);
    expect((await call(playbookPath, undefined, { ...withoutSecret, method: 'GET' })).status).toBe(
      401,
    );
  });

  it('refuses a wrong worker secret', async () => {
    expect((await call(decidePath, {}, { secret: 'not-the-secret' })).status).toBe(401);
  });

  it('answers 404 for a job that does not exist', async () => {
    const response = await call(`/portal-worker/jobs/nope/agent/decide`, {
      stage: 'find_policy',
      observation,
    });
    expect(response.status).toBe(404);
  });
});

describe('navigator routes — decide', () => {
  it('requires a known stage and an observation', async () => {
    expect((await call(decidePath, { stage: 'take_over_the_world', observation })).status).toBe(
      400,
    );
    expect((await call(decidePath, { stage: 'find_policy' })).status).toBe(400);
  });

  it('does not call the model when the provider has the navigator disabled', async () => {
    flowState.agent = { enabled: false };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await call(decidePath, { stage: 'find_policy', observation });
    const body = await response.json();

    expect(body.available).toBe(false);
    expect(body.decision.action).toBe('stuck');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns a usable action for a well-formed decision', async () => {
    stubModel({
      action: 'fill',
      candidateId: 'c1',
      valueRef: 'policy_number',
      literalValue: '',
      key: '',
      url: '',
      confidence: 'high',
      reason: 'the search box',
    });

    const body = await (
      await call(decidePath, {
        stage: 'find_policy',
        policyNumber: 'AG-12345',
        observation,
      })
    ).json();

    expect(body.available).toBe(true);
    expect(body.decision.action).toBe('fill');
    expect(body.decision.candidateId).toBe('c1');
    expect(body.decision.valueRef).toBe('policy_number');
  });

  it('never returns an element the worker did not report seeing', async () => {
    stubModel({
      action: 'click',
      candidateId: 'c-hallucinated',
      valueRef: 'none',
      literalValue: '',
      key: '',
      url: '',
      confidence: 'high',
      reason: 'invented',
    });

    const body = await (await call(decidePath, { stage: 'find_policy', observation })).json();
    expect(body.decision.action).toBe('stuck');
    expect(body.decision.candidateId).toBeNull();
  });

  it('refuses a model-authored value aimed at a password field', async () => {
    stubModel({
      action: 'fill',
      candidateId: 'c2',
      valueRef: 'literal',
      literalValue: 'guessed-password',
      key: '',
      url: '',
      confidence: 'high',
      reason: 'trying',
    });

    const body = await (await call(decidePath, { stage: 'find_policy', observation })).json();
    expect(body.decision.action).toBe('stuck');
    expect(JSON.stringify(body)).not.toContain('guessed-password');
  });

  it('refuses to send the browser off the provider host', async () => {
    stubModel({
      action: 'goto',
      candidateId: '',
      valueRef: 'none',
      literalValue: '',
      key: '',
      url: 'https://attacker.example.com/collect',
      confidence: 'high',
      reason: 'go here',
    });

    const body = await (await call(decidePath, { stage: 'find_policy', observation })).json();
    expect(body.decision.action).toBe('stuck');
    expect(body.decision.reason).toContain('off the provider site');
  });

  it('stops instead of guessing when the page has no interactive elements', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const body = await (
      await call(decidePath, {
        stage: 'find_policy',
        observation: { ...observation, candidates: [] },
      })
    ).json();

    expect(body.decision.action).toBe('stuck');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports a model failure as a 500 rather than a fabricated action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );

    const response = await call(decidePath, { stage: 'find_policy', observation });
    expect(response.status).toBe(500);
  });
});

describe('navigator routes — spend budget', () => {
  it('stops calling the model once the job has spent its budget', async () => {
    kvStore.set('portal-agent-budget:' + JOB, {
      jobId: JOB,
      decisions: 999,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const body = await (await call(decidePath, { stage: 'find_policy', observation })).json();

    expect(body.decision.action).toBe('stuck');
    expect(body.decision.reason).toContain('navigator budget');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('counts a decision before the model call, so a failed call still costs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );

    await call(decidePath, { stage: 'find_policy', observation });

    const budget = kvStore.get('portal-agent-budget:' + JOB) as { decisions: number };
    expect(budget.decisions).toBe(1);
  });

  it('accumulates across calls', async () => {
    stubModel({
      action: 'done',
      candidateId: '',
      valueRef: 'none',
      literalValue: '',
      key: '',
      url: '',
      confidence: 'high',
      reason: 'found it',
    });

    await call(decidePath, { stage: 'find_policy', observation });
    await call(decidePath, { stage: 'find_policy', observation });

    const budget = kvStore.get('portal-agent-budget:' + JOB) as { decisions: number };
    expect(budget.decisions).toBe(2);
  });
});

describe('navigator routes — playbook', () => {
  it('records a valid stage and reads it back', async () => {
    const write = await (
      await call(playbookPath, {
        stage: 'find_policy',
        steps: [
          { action: 'fill', selector: '#q', valueRef: 'policy_number', note: 'Policy number' },
        ],
      })
    ).json();
    expect(write.recorded).toBe(true);
    expect(write.stepCount).toBe(1);

    const read = await (await call(playbookPath, undefined, { method: 'GET' })).json();
    expect(read.playbook.stages.find_policy).toHaveLength(1);
    expect(read.playbook.stages.find_policy[0].selector).toBe('#q');
  });

  it('rejects an unknown stage', async () => {
    const response = await call(playbookPath, { stage: 'whatever', steps: [] });
    expect(response.status).toBe(400);
  });

  it('drops steps whose action the worker cannot perform', async () => {
    const write = await (
      await call(playbookPath, {
        stage: 'find_policy',
        steps: [{ action: 'exfiltrate', selector: '#q', valueRef: 'none', note: '' }],
      })
    ).json();
    expect(write.recorded).toBe(false);
  });

  it('honours the per-provider recording switch', async () => {
    flowState.agent = { enabled: true, recordPlaybook: false };
    const write = await (
      await call(playbookPath, {
        stage: 'find_policy',
        steps: [{ action: 'click', selector: '#go', valueRef: 'none', note: '' }],
      })
    ).json();
    expect(write.recorded).toBe(false);
  });

  it('withholds recorded steps when replay is switched off', async () => {
    await call(playbookPath, {
      stage: 'find_policy',
      steps: [{ action: 'click', selector: '#go', valueRef: 'none', note: '' }],
    });
    flowState.agent = { enabled: true, replayPlaybook: false };

    const read = await (await call(playbookPath, undefined, { method: 'GET' })).json();
    expect(read.playbook.stages).toEqual({});
  });
});
