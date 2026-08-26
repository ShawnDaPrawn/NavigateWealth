/**
 * Version numbers derived from a record COUNT, used as identity
 * =============================================================
 *
 * Nine sites across the FNA/INA families compute the next version as
 * `(records?.length || 0) + 1`. At seven of them that number lands in the KV
 * key, and `kv.set` upserts, so a version number that comes round twice does
 * not fail — it silently replaces a stored record.
 *
 * This is the same defect as the millisecond-timestamp keys the ratchet in
 * `timestamp-key-collision.test.ts` guards, wearing different clothes: a value
 * that is not unique per record is being used as though it were.
 *
 * It does not need a race to fire. A count only counts what is still there:
 *
 *   create -> v1, v2, v3          three medical FNAs stored
 *   DELETE /medical-fna/delete/client_X_v2
 *   create -> count is 2, so v3   and the surviving v3 is overwritten
 *
 * Every step is a button in the product. The client's third medical FNA is
 * replaced by a blank draft, and nothing anywhere reports a failure.
 *
 * The concurrency path is real too — two saves in flight read the same count —
 * but the delete path is what makes this reproducible, so that is what these
 * tests drive.
 *
 * WHAT IS FIXED HERE, AND WHAT IS NOT
 * -----------------------------------
 * The fix is two changes per site:
 *
 *   1. Take the next version from `max(existing.version) + 1`, not the count,
 *      so a deletion cannot make a version number come round again.
 *   2. Put a unique segment in the key, so even if two writers agree on a
 *      version number neither can destroy the other's record.
 *
 * Together those close data loss. What they do not close is two records
 * legitimately ending up labelled the same version under a true race: fixing
 * that needs a compare-and-set the KV store does not offer. So the reader is
 * made deterministic instead — `latest-published` tie-breaks on `createdAt` —
 * and the residue is stated rather than implied.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
vi.mock('jsr:@supabase/supabase-js@2.49.8', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeFnaSupabaseMock(),
);
vi.mock('../fna-intake-adviser-resolver.ts', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeAdviserResolverMock(),
);
vi.mock('../auth-mw.ts', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeAuthMwMockForFna(),
);
vi.mock('../net-worth-snapshot-service.ts', () => ({
  NetWorthSnapshotService: class {
    autoSnapshotFromKV = vi.fn(async () => undefined);
  },
}));
vi.mock('../form-prefill-auto-populate.ts', () => ({
  medicalAutoPopulateFromResolver: vi.fn(async () => ({})),
  taxAutoPopulateFromResolver: vi.fn(async () => ({})),
  enrichTaxFromDomainSessions: vi.fn(async (_c: string, inputs: unknown) => inputs),
}));

import { kvStore } from './helpers/contract-harness.ts';
import { resetFnaHarness, seedFnaUser } from './helpers/fna-routes-harness.ts';

const medicalRoutes = (await import('../medical-fna-routes.tsx')).default;
const investmentRoutes = (await import('../investment-ina-routes.tsx')).default;
const estateRoutes = (await import('../estate-planning-fna-session-routes.ts')).default;

const ADMIN_TOKEN = 'admin-token';
const CLIENT = '11111111-2222-4333-8444-555555555555';

function call(
  app: { request: (p: string, i?: RequestInit) => Promise<Response> },
  path: string,
  init: RequestInit = {},
) {
  return app.request(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
}

beforeEach(() => {
  kvStore.clear();
  resetFnaHarness();
  seedFnaUser(ADMIN_TOKEN, { id: 'admin-1', email: 'admin@navigatewealth.co', role: 'admin' });
});

/** Every stored medical FNA, oldest version first. */
function storedMedicalFnas(): Array<{ id: string; version: number; createdAt: string }> {
  return [...kvStore.entries()]
    .filter(([key]) => key.startsWith('medical-fna:'))
    .map(([, value]) => value as { id: string; version: number; createdAt: string })
    .sort((a, b) => a.version - b.version);
}

describe('medical FNA versioning survives a deletion', () => {
  it('does not reuse a version number after an earlier FNA is deleted', async () => {
    // Three FNAs: v1, v2, v3.
    for (let i = 0; i < 3; i++) {
      const res = await call(medicalRoutes, `/create`, {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT }),
      });
      expect(res.status).toBe(200);
    }

    const before = storedMedicalFnas();
    expect(before.map((f) => f.version)).toEqual([1, 2, 3]);
    const survivingThird = before[2];

    // Delete the middle one through the route the product actually calls.
    const del = await call(medicalRoutes, `/delete/${before[1].id}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(storedMedicalFnas().map((f) => f.version)).toEqual([1, 3]);

    // Create a fourth. The count is now 2.
    const res = await call(medicalRoutes, `/create`, {
      method: 'POST',
      body: JSON.stringify({ clientId: CLIENT }),
    });
    expect(res.status).toBe(200);

    const after = storedMedicalFnas();

    // The record that existed before this create must still exist.
    expect(
      after.some((f) => f.id === survivingThird.id && f.createdAt === survivingThird.createdAt),
    ).toBe(true);

    // And three records go in and stay in: v1, the old v3, and the new one.
    expect(after).toHaveLength(3);
    expect(new Set(after.map((f) => f.version)).size).toBe(3);
  });

  it('numbers the next FNA above the highest surviving version, not the count', async () => {
    // Isolates the first half of the fix. Even with a unique key segment
    // guaranteeing nothing is destroyed, a count-derived version would label
    // this FNA "v3" alongside an existing v3 — and `latest-published` picks by
    // version, so an adviser could be shown a superseded plan as the current
    // one.
    for (let i = 0; i < 3; i++) {
      await call(medicalRoutes, `/create`, {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT }),
      });
    }
    const [, second] = storedMedicalFnas();
    await call(medicalRoutes, `/delete/${second.id}`, { method: 'DELETE' });

    const res = await call(medicalRoutes, `/create`, {
      method: 'POST',
      body: JSON.stringify({ clientId: CLIENT }),
    });
    const body = (await res.json()) as { data: { version: number } };

    expect(body.data.version).toBe(4);
  });

  it('keeps both records when two creates settle on the same version number', async () => {
    // Isolates the second half. `max + 1` is a read-then-write, so two creates
    // whose reads overlap agree on the same number; only a key segment that
    // does not depend on reading first can stop one from replacing the other.
    // At the ~2.2s this request takes end to end, an adviser double-clicking
    // Create is enough of a window.
    //
    // The overlap is staged rather than raced. `Promise.all` over two
    // `app.request` calls does not reliably collide here — the first create
    // pays for a dynamic `import()` the second gets from cache, which is
    // enough to desynchronise them — and a test that only passes when the
    // event loop cooperates proves nothing. So the read side is pinned to the
    // pre-create snapshot for the duration of both calls, which is precisely
    // what two concurrent requests observe.
    await call(medicalRoutes, `/create`, {
      method: 'POST',
      body: JSON.stringify({ clientId: CLIENT }),
    });
    expect(storedMedicalFnas()).toHaveLength(1);

    const kv = await import('../kv_store.tsx');
    const live = kv.getByPrefix as unknown as ReturnType<typeof vi.fn>;
    const frozen = new Map(kvStore);

    live.mockImplementation(async (prefix: string) =>
      [...frozen.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]) => JSON.parse(JSON.stringify(value))),
    );
    try {
      await call(medicalRoutes, `/create`, {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT }),
      });
      await call(medicalRoutes, `/create`, {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT }),
      });
    } finally {
      live.mockRestore();
    }

    const stored = storedMedicalFnas();

    // Both writers computed v2 off the same snapshot. That residue is real and
    // is not what this fix claims to remove — fixing it needs a compare-and-set
    // the KV store does not offer. What it does claim is that neither record is
    // destroyed, so assert on distinct ids, not distinct versions.
    expect(stored).toHaveLength(3);
    expect(new Set(stored.map((f) => f.id)).size).toBe(3);
    expect(stored.filter((f) => f.version === 2)).toHaveLength(2);
  });
});

/**
 * The same loop on the other two families whose delete route makes it
 * reachable. Medical above is the one reproduced in full; these two confirm the
 * fix landed on a route table that looks nothing like it — a `/save` that takes
 * the client in the path and its own schema, and a `/session/:sessionId` delete
 * that derives the client back out of the id.
 *
 * Tax planning shares this shape and is covered by the source ratchet below
 * rather than a fourth near-identical suite: it has no session-delete route, so
 * only the concurrency path reaches it, and that path is already pinned on
 * medical.
 */
describe.each([
  {
    family: 'investment INA',
    app: () => investmentRoutes,
    save: (clientId: string) => `/client/${clientId}/save`,
    del: (sessionId: string) => `/session/${sessionId}`,
    prefix: 'investment-ina:client:',
    body: { inputs: { lumpSum: 100000 }, status: 'draft' },
  },
  {
    family: 'estate planning',
    app: () => estateRoutes,
    save: () => `/save`,
    del: (sessionId: string) => `/session/${sessionId}`,
    prefix: 'estate-planning-fna:client:',
    body: { clientId: CLIENT, inputs: { estateValue: 5_000_000 }, status: 'draft' },
  },
])('$family versioning survives a deletion', ({ app, save, del, prefix, body }) => {
  const stored = () =>
    [...kvStore.entries()]
      .filter(([key]) => key.startsWith(`${prefix}${CLIENT}:`))
      .map(([, value]) => value as { id: string; version: number; createdAt: string })
      .sort((a, b) => a.version - b.version);

  it('does not reuse a version number after an earlier session is deleted', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await call(app(), save(CLIENT), {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(200);
    }

    const before = stored();
    expect(before.map((f) => f.version)).toEqual([1, 2, 3]);
    const survivingThird = before[2];

    const removed = await call(app(), del(before[1].id), { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(stored().map((f) => f.version)).toEqual([1, 3]);

    const res = await call(app(), save(CLIENT), {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);

    const after = stored();
    expect(
      after.some((f) => f.id === survivingThird.id && f.createdAt === survivingThird.createdAt),
    ).toBe(true);
    expect(after).toHaveLength(3);
    expect(after.map((f) => f.version)).toEqual([1, 3, 4]);
  });
});

// ============================================================================
// SOURCE RATCHET
// ============================================================================

/**
 * The behavioural tests above cover medical FNA, which is where this was
 * reproduced. Eight other sites had the same shape, and writing eight more
 * route harnesses to pin each one would cost more than it caught — so the
 * remaining guarantee is made against the source instead, the same way
 * `timestamp-key-collision.test.ts` guards the timestamp form.
 *
 * WHAT THIS DOES NOT CATCH
 * ------------------------
 * It looks for "version" near an expression that adds 1 to a `.length`, which
 * is a heuristic, and it is stated as one. A count-derived sequence under a
 * different name — `sequence`, `revision`, `ordinal` — reads identically to a
 * regex and would slip past. The rule the ratchet is standing in for is worth
 * writing down on its own: a number that identifies a record must not be
 * derived from how many records happen to be stored, because a count is not a
 * sequence.
 */
const SERVER_DIR = join(process.cwd(), 'src/supabase/functions/server');

function serverSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : serverSourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** `foo.length + 1`, `(foo?.length || 0) + 1`, `a.length + b.length + 1`. */
const COUNT_PLUS_ONE = /\.length[^;\n]{0,80}?\+\s*1/g;

/** How far back to look for the word that says this count is a version. */
const CONTEXT_CHARS = 400;

function offendingVersionCounts(source: string): string[] {
  const clean = stripComments(source);
  const found: string[] = [];

  for (const match of clean.matchAll(COUNT_PLUS_ONE)) {
    const at = match.index ?? 0;
    const context = clean.slice(Math.max(0, at - CONTEXT_CHARS), at + match[0].length);
    // "version" either on the assignment itself or in the enclosing function's
    // name — `getNextVersionNumber` puts it a couple of lines above a bare
    // `return (fnas?.length || 0) + 1;`.
    if (!/version/i.test(context)) continue;
    found.push(match[0].trim());
  }

  return found;
}

describe('the version-count scanner itself', () => {
  it('reports a version assigned from a record count', () => {
    expect(
      offendingVersionCounts('const version = (existingWills?.length || 0) + 1;'),
    ).toHaveLength(1);
    expect(
      offendingVersionCounts('const versionNumber = (existing as ArticleVersion[]).length + 1;'),
    ).toHaveLength(1);
  });

  it('reports a bare return inside a function whose NAME says version', () => {
    // The shape five of the nine sites used. Nothing on the returning line
    // says "version" — the enclosing function name does.
    expect(
      offendingVersionCounts(
        'async function getNextVersionNumber(clientId: string): Promise<number> {\n' +
          '  const fnas = await kv.getByPrefix(`risk_planning_fna:${clientId}:`);\n' +
          '  return (fnas?.length || 0) + 1;\n}',
      ),
    ).toHaveLength(1);
  });

  it('reports the two-prefix form medical FNA used', () => {
    expect(
      offendingVersionCounts(
        'async function getNextVersionNumber(clientId: string) {\n' +
          '  return legacyFnas.length + newFnas.length + 1;\n}',
      ),
    ).toHaveLength(1);
  });

  it('accepts the fixed form', () => {
    expect(
      offendingVersionCounts(
        'async function getNextVersionNumber(clientId: string): Promise<number> {\n' +
          '  const fnas = await kv.getByPrefix(`risk_planning_fna:${clientId}:`);\n' +
          '  return nextVersion(fnas);\n}',
      ),
    ).toEqual([]);
  });

  it('ignores a count+1 with nothing to do with versions', () => {
    expect(offendingVersionCounts('const nextRow = rows.length + 1;')).toEqual([]);
    expect(offendingVersionCounts('const objNum = objects.length + 1;')).toEqual([]);
  });

  it('ignores the offending shape when it appears only in a comment', () => {
    expect(
      offendingVersionCounts(
        '// const version = (wills?.length || 0) + 1; was the bug\nconst x = 1;',
      ),
    ).toEqual([]);
  });
});

describe('no server version number is derived from a record count', () => {
  it('finds no offending expression anywhere under the server tree', () => {
    const offenders = serverSourceFiles(SERVER_DIR)
      .map((file) => ({ file, hits: offendingVersionCounts(readFileSync(file, 'utf8')) }))
      .filter(({ hits }) => hits.length > 0)
      .map(({ file, hits }) => `${file.split('/server/')[1]}: ${hits.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  it('scans a meaningful number of files, so a broken walker cannot pass silently', () => {
    expect(serverSourceFiles(SERVER_DIR).length).toBeGreaterThan(100);
  });
});
