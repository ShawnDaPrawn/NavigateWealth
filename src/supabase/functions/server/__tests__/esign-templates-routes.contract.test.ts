/**
 * esign-templates-routes.ts — Route Contract Tests
 * ================================================
 *
 * Reusable e-signature templates and their version history. 141 statements,
 * 8% covered.
 *
 * `esign-template-service.ts` runs for real — it is pure KV — so the version
 * snapshotting, the bump rule and the immutable-field re-forcing are exercised
 * rather than mocked. Stubbed: storage, the Postgres mirror, and the Supabase
 * client whose `rpc` the real rate limiter needs.
 *
 * The versioning is the reason this file is worth more than its statement
 * count. An envelope records the template VERSION it was materialised from, so
 * a template edited after an envelope was sent must not retroactively rewrite
 * what that envelope was built from. The tests below pin both halves of that:
 * which edits bump the version and snapshot the outgoing record, and which do
 * not.
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

const app = (await import('../esign-templates-routes.ts')).default;

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

type Template = {
  id: string;
  name: string;
  version: number;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  signingMode: string;
  defaultExpiryDays: number;
  recipients: unknown[];
  fields: unknown[];
};

async function createTemplate(body: Record<string, unknown> = {}) {
  const res = await req('/templates', {
    method: 'POST',
    body: { name: 'Annual Mandate', ...body },
  });
  expect(res.status).toBe(200);
  return ((await json(res)) as unknown as { template: Template }).template;
}

const stored = (id: string) => kvStore.get(EsignKeys.template(id)) as Template | undefined;

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
  ['POST', '/templates', { name: 'T' }],
  ['GET', '/templates'],
  ['GET', '/templates/anything'],
  ['PUT', '/templates/anything', { name: 'X' }],
  ['DELETE', '/templates/anything'],
  ['POST', '/templates/anything/use'],
  ['GET', '/templates/anything/versions'],
  ['GET', '/templates/anything/versions/1'],
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
// CREATE
// ============================================================================

describe('POST /templates', () => {
  it('creates a template at version 1 with sensible defaults', async () => {
    const template = await createTemplate();

    expect(template).toMatchObject({
      name: 'Annual Mandate',
      version: 1,
      usageCount: 0,
      signingMode: 'sequential',
      defaultExpiryDays: 30,
      createdBy: 'admin-1',
      recipients: [],
      fields: [],
    });
    expect(stored(template.id)).toBeTruthy();
  });

  it('trims the name and carries the supplied configuration through', async () => {
    const template = await createTemplate({
      name: '  Risk Disclosure  ',
      description: 'For onboarding',
      category: 'compliance',
      signingMode: 'parallel',
      defaultExpiryDays: 14,
      recipients: [{ name: 'Client', email: '', role: 'signer', order: 1 }],
    });

    expect(template.name).toBe('Risk Disclosure');
    expect(template).toMatchObject({ signingMode: 'parallel', defaultExpiryDays: 14 });
    expect(template.recipients).toHaveLength(1);
  });

  it('rejects a missing or blank name', async () => {
    for (const name of [undefined, '', '   ']) {
      const res = await req('/templates', { method: 'POST', body: { name } });
      expect([res.status, JSON.stringify(name)]).toEqual([400, JSON.stringify(name)]);
    }
  });
});

// ============================================================================
// READ
// ============================================================================

describe('reads', () => {
  it('lists templates and fetches one by id', async () => {
    const a = await createTemplate({ name: 'A' });
    await createTemplate({ name: 'B' });

    const list = await req('/templates');
    expect(((await json(list)) as unknown as { templates: unknown[] }).templates).toHaveLength(2);

    const one = await req(`/templates/${a.id}`);
    expect(one.status).toBe(200);
    expect(((await json(one)) as unknown as { template: Template }).template.id).toBe(a.id);
  });

  it('404s an unknown template', async () => {
    expect((await req('/templates/nope')).status).toBe(404);
  });
});

// ============================================================================
// UPDATE AND VERSIONING
// ============================================================================

describe('PUT /templates/:templateId', () => {
  it('bumps the version and snapshots the outgoing record when structure changes', async () => {
    // `signingMode`, `recipients`, `documents`, `fields` and
    // `defaultExpiryDays` are the versioned keys — the ones an envelope's
    // behaviour depends on.
    const template = await createTemplate();

    const res = await req(`/templates/${template.id}`, {
      method: 'PUT',
      body: { fields: [{ type: 'signature', page: 1, x: 10, y: 10, recipientIndex: 0 }] },
    });
    expect(res.status).toBe(200);

    const updated = ((await json(res)) as unknown as { template: Template }).template;
    expect(updated.version).toBe(2);

    // v1 is snapshotted so an envelope stamped v1 can still resolve it.
    const snapshot = kvStore.get(EsignKeys.templateVersion(template.id, 1)) as Template;
    expect(snapshot).toMatchObject({ version: 1, fields: [] });
    expect(kvStore.get(EsignKeys.templateVersionsIndex(template.id))).toEqual([1]);
  });

  it('does NOT bump the version for a cosmetic edit', async () => {
    const template = await createTemplate();

    const res = await req(`/templates/${template.id}`, {
      method: 'PUT',
      body: { name: 'Renamed', description: 'New wording' },
    });

    const updated = ((await json(res)) as unknown as { template: Template }).template;
    expect(updated.version).toBe(1);
    expect(updated.name).toBe('Renamed');
    // Nothing snapshotted, because nothing an envelope depends on moved.
    expect(kvStore.has(EsignKeys.templateVersion(template.id, 1))).toBe(false);
  });

  it('does not bump when a versioned key is set to the SAME value', async () => {
    const template = await createTemplate({ signingMode: 'parallel' });
    const res = await req(`/templates/${template.id}`, {
      method: 'PUT',
      body: { signingMode: 'parallel' },
    });
    expect(((await json(res)) as unknown as { template: Template }).template.version).toBe(1);
  });

  it('re-forces the immutable fields AFTER the merge, so the raw body cannot rewrite them', async () => {
    // The route passes the request body straight into `updateTemplate` with no
    // allow-list. What makes that safe is `updateTemplate` re-applying `id`,
    // `createdAt`, `createdBy`, `usageCount` and `version` after the spread.
    // Pinned so that ordering cannot be "simplified" away — the same shape
    // without it is what let a caller reassign a risk FNA to another client.
    const template = await createTemplate();

    await req(`/templates/${template.id}`, {
      method: 'PUT',
      body: {
        name: 'Renamed',
        id: 'hijacked',
        createdBy: 'someone-else',
        createdAt: '2000-01-01T00:00:00.000Z',
        usageCount: 9999,
        version: 42,
      },
    });

    const after = stored(template.id)!;
    expect(after).toMatchObject({
      id: template.id,
      createdBy: 'admin-1',
      createdAt: template.createdAt,
      usageCount: 0,
      version: 1,
      name: 'Renamed',
    });
    expect(kvStore.has(EsignKeys.template('hijacked'))).toBe(false);
  });

  it('404s an unknown template', async () => {
    expect((await req('/templates/nope', { method: 'PUT', body: { name: 'X' } })).status).toBe(404);
  });
});

// ============================================================================
// VERSION HISTORY
// ============================================================================

describe('version history', () => {
  /** Bump a template twice so v1 and v2 are both snapshotted. */
  async function withHistory() {
    const template = await createTemplate();
    await req(`/templates/${template.id}`, { method: 'PUT', body: { defaultExpiryDays: 14 } });
    await req(`/templates/${template.id}`, { method: 'PUT', body: { defaultExpiryDays: 7 } });
    return template;
  }

  it('lists the historical versions', async () => {
    const template = await withHistory();
    const res = await req(`/templates/${template.id}/versions`);
    expect(res.status).toBe(200);
    const { versions } = (await json(res)) as unknown as { versions: unknown[] };
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it('fetches a historical version and gets the value it had at the time', async () => {
    const template = await withHistory();

    const v1 = await req(`/templates/${template.id}/versions/1`);
    expect(v1.status).toBe(200);
    expect(((await json(v1)) as unknown as { template: Template }).template.defaultExpiryDays).toBe(
      30,
    );

    const v2 = await req(`/templates/${template.id}/versions/2`);
    expect(((await json(v2)) as unknown as { template: Template }).template.defaultExpiryDays).toBe(
      14,
    );
  });

  it('returns the LIVE record when the requested version is the current one', async () => {
    const template = await withHistory();
    const res = await req(`/templates/${template.id}/versions/3`);
    expect(res.status).toBe(200);
    const found = ((await json(res)) as unknown as { template: Template }).template;
    expect(found.version).toBe(3);
    expect(found.defaultExpiryDays).toBe(7);
  });

  it('rejects a non-numeric or zero version', async () => {
    const template = await createTemplate();
    for (const version of ['abc', '0', '-1']) {
      const res = await req(`/templates/${template.id}/versions/${version}`);
      expect([res.status, version]).toEqual([400, version]);
    }
  });

  it('404s a version that was never snapshotted', async () => {
    const template = await createTemplate();
    expect((await req(`/templates/${template.id}/versions/99`)).status).toBe(404);
  });
});

// ============================================================================
// USE COUNTER
// ============================================================================

describe('POST /templates/:templateId/use', () => {
  it('increments the counter and returns the version to pin on the envelope', async () => {
    const template = await createTemplate();

    const res = await req(`/templates/${template.id}/use`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await json(res)) as unknown as { usageCount: number; version: number };
    expect(body).toMatchObject({ usageCount: 1, version: 1 });
    expect(stored(template.id)!.usageCount).toBe(1);
  });

  it('keeps counting across repeated use', async () => {
    const template = await createTemplate();
    await req(`/templates/${template.id}/use`, { method: 'POST' });
    await req(`/templates/${template.id}/use`, { method: 'POST' });
    expect(stored(template.id)!.usageCount).toBe(2);
  });

  it('reports the CURRENT version, which is what the envelope gets stamped with', async () => {
    const template = await createTemplate();
    await req(`/templates/${template.id}`, { method: 'PUT', body: { defaultExpiryDays: 14 } });

    const res = await req(`/templates/${template.id}/use`, { method: 'POST' });
    expect(((await json(res)) as unknown as { version: number }).version).toBe(2);
  });

  it('404s an unknown template', async () => {
    expect((await req('/templates/nope/use', { method: 'POST' })).status).toBe(404);
  });
});

// ============================================================================
// DELETE
// ============================================================================

describe('DELETE /templates/:templateId', () => {
  it('removes the template and drops it from the list', async () => {
    const template = await createTemplate();

    const res = await req(`/templates/${template.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(stored(template.id)).toBeUndefined();

    const list = await req('/templates');
    expect(((await json(list)) as unknown as { templates: unknown[] }).templates).toEqual([]);
  });

  it('404s an unknown template', async () => {
    expect((await req('/templates/nope', { method: 'DELETE' })).status).toBe(404);
  });
});
