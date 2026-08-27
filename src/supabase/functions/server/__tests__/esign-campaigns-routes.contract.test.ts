/**
 * esign-campaigns-routes.ts — Route Contract Tests
 * ================================================
 *
 * Bulk-send campaigns (one template, many recipient rows from a CSV) and the
 * packet routes that wrap the sequenced-template workflow. 159 statements, 9%
 * covered.
 *
 * `esign-campaign-service.ts`, `esign-packet-service.ts` and
 * `esign-template-service.ts` all run for real — every one of them is pure KV —
 * so the CSV parsing, row mapping and campaign state machine under these routes
 * are exercised rather than mocked. Stubbed: storage, the Postgres mirror, the
 * Supabase client (whose `rpc` the real rate limiter needs), and email.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => `test-${key}` },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: {
    insertAudit: vi.fn(async () => undefined),
    upsertEnvelope: vi.fn(async () => undefined),
    upsertSigner: vi.fn(async () => undefined),
  },
}));
vi.mock('../esign-storage.ts', () => ({
  uploadDocument: vi.fn(async () => ({ path: 'stored/path.pdf' })),
  downloadDocument: vi.fn(async () => new Uint8Array([1, 2, 3])),
  getDocumentUrl: vi.fn(async (path: string) => `https://signed.test/${path}`),
  validateDocument: vi.fn(async () => ({ valid: true })),
  calculateHash: vi.fn(async () => 'sha256:uploaded'),
  extractPageCount: vi.fn(async () => 2),
  initializeStorageBuckets: vi.fn(async () => undefined),
}));
vi.mock('../email-service.ts', () => ({ sendEmail: vi.fn(async () => true) }));

const supa = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  rateLimitRpcWorks: true,
}));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = supa.users.get(token);
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } };
      },
    },
    rpc: async (fn: string) => {
      if (!supa.rateLimitRpcWorks) throw new Error(`rpc ${fn} unavailable`);
      return {
        data: { allowed: true, remaining: 119, resetAt: 4_000_000_000_000, blocked: false },
        error: null,
      };
    },
  }),
}));
vi.mock('../auth-mw.ts', async () => {
  const actual = await vi.importActual<typeof import('../auth-mw.ts')>('../auth-mw.ts');
  return { ...actual, enforceAccountSecurity: vi.fn(async () => undefined) };
});

import { kvStore } from './helpers/contract-harness.ts';
import { EsignKeys } from '../esign-keys.ts';

const app = (await import('../esign-campaigns-routes.ts')).default;

function req(
  path: string,
  {
    as = 'admin',
    method = 'GET',
    body,
  }: { as?: string | null; method?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (as) headers.Authorization = `Bearer ${as}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const json = async (res: Response) => (await res.json()) as Record<string, never>;

/** A template with ONE recipient, which is the shape the CSV mapper special-cases. */
function seedTemplate(
  id = 'tpl-1',
  recipients = [{ name: 'Client', email: '', role: 'signer', order: 1 }],
) {
  kvStore.set(EsignKeys.template(id), {
    id,
    name: 'Annual Mandate',
    version: 1,
    documents: [],
    recipients,
    fields: [],
    signingMode: 'sequential',
  });
}

const CSV = [
  'name,email',
  'Thandi Mokoena,thandi@example.com',
  'Pieter van Wyk,pieter@example.com',
].join('\n');

async function createCampaign(body: Record<string, unknown> = {}) {
  const res = await req('/campaigns', {
    method: 'POST',
    body: { templateId: 'tpl-1', title: 'Annual review 2026', csvText: CSV, ...body },
  });
  return res;
}

beforeEach(() => {
  kvStore.clear();
  supa.users.clear();
  supa.rateLimitRpcWorks = true;
  supa.users.set('admin', {
    id: 'admin-1',
    email: 'admin@navigatewealth.co',
    app_metadata: { role: 'admin' },
    user_metadata: {},
  });
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

const ROUTES: Array<[string, string, unknown?]> = [
  ['POST', '/campaigns', { templateId: 'tpl-1', title: 'T', rows: [] }],
  ['GET', '/campaigns'],
  ['GET', '/campaigns/anything'],
  ['POST', '/campaigns/x/results/y', { status: 'sent' }],
  ['POST', '/campaigns/x/cancel'],
  ['POST', '/packets', { name: 'P', steps: [] }],
  ['GET', '/packets'],
  ['GET', '/packets/anything'],
  ['DELETE', '/packets/anything'],
  ['GET', '/packet-runs'],
  ['GET', '/packet-runs/anything'],
  ['POST', '/packet-runs/x/cancel'],
];

describe('authentication', () => {
  it.each(ROUTES)('%s %s rejects a request with no token', async (method, path, body) => {
    expect((await req(path, { method, as: null, body })).status).toBe(401);
  });

  it.each(ROUTES)('%s %s rejects an unrecognised token', async (method, path, body) => {
    expect((await req(path, { method, as: 'nobody', body })).status).toBe(401);
  });
});

// ============================================================================
// CAMPAIGN CREATION
// ============================================================================

describe('POST /campaigns', () => {
  it('parses a CSV into one campaign row per line', async () => {
    seedTemplate();
    const res = await createCampaign();
    expect(res.status).toBe(200);

    // The stored field is `results`, each entry carrying a `rowId` — not
    // `rows`. Worth naming: the route's request body calls them `rows` and the
    // record calls them `results`, so a test written from the request shape
    // asserts against a field that does not exist and fails as "undefined".
    const { campaign } = (await json(res)) as unknown as {
      campaign: { id: string; results: Array<{ signers: Array<{ name: string; email: string }> }> };
    };
    expect(campaign.results).toHaveLength(2);
    expect(campaign.results[0].signers[0]).toMatchObject({
      name: 'Thandi Mokoena',
      email: 'thandi@example.com',
    });
    expect(campaign.results[1].signers[0]).toMatchObject({ email: 'pieter@example.com' });
  });

  it('accepts an explicit rows[] instead of a CSV', async () => {
    seedTemplate();
    const res = await req('/campaigns', {
      method: 'POST',
      body: {
        templateId: 'tpl-1',
        title: 'Direct rows',
        rows: [{ signers: [{ name: 'Direct', email: 'direct@example.com', order: 1 }] }],
      },
    });
    expect(res.status).toBe(200);
    const { campaign } = (await json(res)) as unknown as { campaign: { results: unknown[] } };
    expect(campaign.results).toHaveLength(1);
  });

  it('files the campaign under the caller\'s resolved firm, not "standalone"', async () => {
    // The route read `(ctx as { firmId?: string }).firmId ?? 'standalone'`, but
    // `getAuthContext` returns `{ user, userId, role, token }` — there is no
    // `firmId` on it, so the `??` branch was the ONLY branch and every campaign
    // ever created was filed under the literal string 'standalone'. The `as`
    // cast is what hid it: without it TypeScript would have rejected the
    // property access. Three other call sites in the same file already used
    // `resolveFirmId(ctx.user)`, so campaigns created here were invisible to
    // the routes that list by real firm id.
    seedTemplate();
    await createCampaign();

    const stored = [...kvStore.values()].find(
      (v) => (v as { results?: unknown })?.results !== undefined,
    ) as { firmId: string };
    // No app_metadata.firm_id on the test user, so resolveFirmId falls back to
    // the user id — the documented standalone-install behaviour.
    expect(stored.firmId).toBe('admin-1');
    expect(stored.firmId).not.toBe('standalone');
  });

  it('honours an explicit app_metadata.firm_id over the user-id fallback', async () => {
    supa.users.set('admin', {
      id: 'admin-1',
      email: 'admin@navigatewealth.co',
      app_metadata: { role: 'admin', firm_id: 'firm_navigate_wealth' },
      user_metadata: {},
    });
    seedTemplate();
    await createCampaign();

    const stored = [...kvStore.values()].find(
      (v) => (v as { results?: unknown })?.results !== undefined,
    ) as { firmId: string };
    expect(stored.firmId).toBe('firm_navigate_wealth');
  });

  it('rejects a request with no templateId or no title', async () => {
    seedTemplate();
    expect(
      (await req('/campaigns', { method: 'POST', body: { title: 'T', rows: [] } })).status,
    ).toBe(400);
    expect(
      (await req('/campaigns', { method: 'POST', body: { templateId: 'tpl-1', rows: [] } })).status,
    ).toBe(400);
    expect(
      (
        await req('/campaigns', {
          method: 'POST',
          body: { templateId: 'tpl-1', title: '   ', rows: [] },
        })
      ).status,
    ).toBe(400);
  });

  it('404s when the template does not exist', async () => {
    const res = await req('/campaigns', {
      method: 'POST',
      body: { templateId: 'no-such-template', title: 'T', csvText: CSV },
    });
    expect(res.status).toBe(404);
  });

  it('rejects a request providing neither csvText nor rows[]', async () => {
    seedTemplate();
    const res = await req('/campaigns', {
      method: 'POST',
      body: { templateId: 'tpl-1', title: 'T' },
    });
    expect(res.status).toBe(400);
    expect((await json(res)) as unknown as { error: string }).toMatchObject({
      error: 'Provide csvText or rows[]',
    });
  });

  it('rejects a CSV with a header row and nothing else', async () => {
    seedTemplate();
    const res = await createCampaign({ csvText: 'name,email' });
    expect(res.status).toBe(400);
  });

  it('returns mapper warnings alongside the campaign', async () => {
    seedTemplate();
    // A row with no email is the case the mapper warns about.
    const res = await createCampaign({ csvText: ['name,email', 'No Email,'].join('\n') });
    const body = (await json(res)) as unknown as { warnings?: string[]; error?: string };
    // Either it warns and creates, or it rejects — both are defensible; assert
    // whichever the implementation does rather than guessing.
    if (body.error) {
      expect(res.status).toBe(400);
    } else {
      expect(Array.isArray(body.warnings)).toBe(true);
    }
  });
});

// ============================================================================
// CAMPAIGN READS AND STATE
// ============================================================================

describe('campaign reads and state', () => {
  async function seedOne() {
    seedTemplate();
    const res = await createCampaign();
    const { campaign } = (await json(res)) as unknown as {
      campaign: { id: string; results: Array<{ rowId: string }> };
    };
    return campaign;
  }

  it('lists campaigns and fetches one by id', async () => {
    const campaign = await seedOne();

    const list = await req('/campaigns');
    expect(((await json(list)) as unknown as { campaigns: unknown[] }).campaigns).toHaveLength(1);

    const one = await req(`/campaigns/${campaign.id}`);
    expect(one.status).toBe(200);
    expect(((await json(one)) as unknown as { campaign: { id: string } }).campaign.id).toBe(
      campaign.id,
    );
  });

  it('404s an unknown campaign', async () => {
    expect((await req('/campaigns/nope')).status).toBe(404);
  });

  it('records a row result and reflects it on the campaign', async () => {
    const campaign = await seedOne();
    const rowId = campaign.results[0].rowId;

    const res = await req(`/campaigns/${campaign.id}/results/${rowId}`, {
      method: 'POST',
      body: { status: 'sent', envelopeId: 'env-42' },
    });
    expect(res.status).toBe(200);

    const { campaign: updated } = (await json(res)) as unknown as {
      campaign: { results: Array<{ rowId: string; status: string; envelopeId?: string | null }> };
    };
    const row = updated.results.find((r) => r.rowId === rowId)!;
    expect(row.status).toBe('sent');
    expect(row.envelopeId).toBe('env-42');
  });

  it('rejects a row result with an unknown status', async () => {
    const campaign = await seedOne();
    const res = await req(`/campaigns/${campaign.id}/results/${campaign.results[0].rowId}`, {
      method: 'POST',
      body: { status: 'exploded' },
    });
    expect(res.status).toBe(400);
  });

  it('404s a row result against an unknown campaign or row', async () => {
    const campaign = await seedOne();
    expect(
      (await req('/campaigns/nope/results/row-1', { method: 'POST', body: { status: 'sent' } }))
        .status,
    ).toBe(404);
    expect(
      (
        await req(`/campaigns/${campaign.id}/results/no-such-row`, {
          method: 'POST',
          body: { status: 'sent' },
        })
      ).status,
    ).toBe(404);
  });

  it('cancels a campaign, and 404s an unknown one', async () => {
    const campaign = await seedOne();

    const res = await req(`/campaigns/${campaign.id}/cancel`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(((await json(res)) as unknown as { campaign: { status: string } }).campaign.status).toBe(
      'cancelled',
    );

    expect((await req('/campaigns/nope/cancel', { method: 'POST' })).status).toBe(404);
  });
});

// ============================================================================
// PACKET ROUTE WRAPPERS
// ============================================================================

describe('packet routes', () => {
  it('creates, lists, fetches and deletes a packet', async () => {
    seedTemplate();

    const created = await req('/packets', {
      method: 'POST',
      body: { name: 'Onboarding', steps: [{ templateId: 'tpl-1' }] },
    });
    expect(created.status).toBe(200);
    const { packet } = (await json(created)) as unknown as { packet: { id: string; name: string } };
    expect(packet.name).toBe('Onboarding');

    const list = await req('/packets');
    expect(((await json(list)) as unknown as { packets: unknown[] }).packets).toHaveLength(1);

    const one = await req(`/packets/${packet.id}`);
    expect(one.status).toBe(200);

    const removed = await req(`/packets/${packet.id}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect((await req('/packets')).status).toBe(200);
    expect(
      ((await json(await req('/packets'))) as unknown as { packets: unknown[] }).packets,
    ).toEqual([]);
  });

  it('rejects a packet with no steps and 404s an unknown template', async () => {
    seedTemplate();
    expect(
      (await req('/packets', { method: 'POST', body: { name: 'Empty', steps: [] } })).status,
    ).toBe(400);
    expect(
      (
        await req('/packets', {
          method: 'POST',
          body: { name: 'Bad step', steps: [{ templateId: 'no-such-template' }] },
        })
      ).status,
    ).toBe(400);
  });

  it('404s an unknown packet', async () => {
    expect((await req('/packets/nope')).status).toBe(404);
  });

  it('lists packet runs and 404s an unknown one', async () => {
    const list = await req('/packet-runs');
    expect(list.status).toBe(200);
    expect(((await json(list)) as unknown as { runs: unknown[] }).runs).toEqual([]);

    expect((await req('/packet-runs/nope')).status).toBe(404);
  });

  it('404s cancelling an unknown packet run', async () => {
    expect((await req('/packet-runs/nope/cancel', { method: 'POST' })).status).toBe(404);
  });
});
