/**
 * Typed KV repository + direct-import ratchet (Stage B: repositories/)
 * ====================================================================
 *
 * The behaviour worth pinning is the one the layer exists for: a bounded read
 * is the DEFAULT, and an unbounded namespace scan is a deliberate, attributable
 * act. `kv.getByPrefix` has no limit and 278 call sites; `kv.listByPrefix` has
 * paginated all along and is barely used. If `list()` ever stops being bounded,
 * this layer is just indirection.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/kv-repository.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { announceRatchetSlack } from '../../../../test/ratchet-notice';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SERVER_DIR, '../../../..');
const BASELINE_FILE = join(REPO_ROOT, '.kv-direct-access-baseline');

const store = new Map<string, unknown>();
const calls: string[] = [];

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => {
    calls.push(`get:${k}`);
    return store.get(k) ?? null;
  }),
  set: vi.fn(async (k: string, v: unknown) => {
    calls.push(`set:${k}`);
    store.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    calls.push(`del:${k}`);
    store.delete(k);
  }),
  mget: vi.fn(async (ks: string[]) => ks.map((k) => store.get(k) ?? null)),
  getByPrefix: vi.fn(async (p: string) => {
    calls.push(`getByPrefix:${p}`);
    return [...store.entries()].filter(([k]) => k.startsWith(p)).map(([, v]) => v);
  }),
  listByPrefix: vi.fn(async (p: string, o?: { limit?: number; startAfter?: string }) => {
    calls.push(`listByPrefix:${p}:${o?.limit}`);
    let rows = [...store.entries()]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value }));
    if (o?.startAfter) rows = rows.filter((r) => r.key > o.startAfter!);
    return rows.slice(0, o?.limit ?? 100);
  }),
}));

const { createKvRepository, MAX_PAGE_SIZE } = await import('../repositories/kv-repository.ts');

interface Widget {
  id: string;
  name: string;
}
const repo = createKvRepository<Widget>('widgets:');

beforeEach(() => {
  store.clear();
  calls.length = 0;
});

describe('basic typed access', () => {
  it('round-trips a value under the namespaced key', async () => {
    await repo.put('w1', { id: 'w1', name: 'first' });
    expect(store.has('widgets:w1')).toBe(true);
    await expect(repo.get('w1')).resolves.toEqual({ id: 'w1', name: 'first' });
  });

  it('returns null rather than undefined for a missing id', async () => {
    await expect(repo.get('nope')).resolves.toBeNull();
  });

  it('removes by id', async () => {
    await repo.put('w1', { id: 'w1', name: 'x' });
    await repo.remove('w1');
    await expect(repo.get('w1')).resolves.toBeNull();
  });

  it('getMany preserves input order and pads misses with null', async () => {
    await repo.put('a', { id: 'a', name: 'A' });
    await repo.put('c', { id: 'c', name: 'C' });
    await expect(repo.getMany(['a', 'b', 'c'])).resolves.toEqual([
      { id: 'a', name: 'A' },
      null,
      { id: 'c', name: 'C' },
    ]);
  });

  it('getMany short-circuits on an empty list without touching the store', async () => {
    await expect(repo.getMany([])).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe('list() is bounded — the reason this layer exists', () => {
  beforeEach(async () => {
    for (let i = 0; i < 250; i += 1) {
      await repo.put(`w${String(i).padStart(3, '0')}`, { id: `w${i}`, name: `n${i}` });
    }
    calls.length = 0;
  });

  it('returns at most the default page size, not the whole namespace', async () => {
    const page = await repo.list();
    expect(page.items).toHaveLength(100);
    expect(page.nextCursor).not.toBeNull();
  });

  it('never calls the unbounded getByPrefix', async () => {
    await repo.list();
    expect(calls.some((c) => c.startsWith('getByPrefix'))).toBe(false);
  });

  it('walks the whole namespace via the cursor without a scan', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await repo.list({ limit: 60, startAfter: cursor ?? undefined });
      seen.push(...page.items.map((w) => w.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(250);
    expect(new Set(seen).size).toBe(250);
  });

  it('reports nextCursor null on the final page', async () => {
    const page = await repo.list({ limit: 1000 });
    expect(page.items).toHaveLength(250);
    expect(page.nextCursor).toBeNull();
  });

  it('clamps a caller trying to turn list() back into an unbounded scan', async () => {
    await repo.list({ limit: 10_000_000 });
    // limit+1 is requested so the cursor can be honest; the clamp is what matters.
    expect(calls.some((c) => c === `listByPrefix:widgets::${MAX_PAGE_SIZE + 1}`)).toBe(true);
  });
});

describe('listAll() makes an unbounded scan deliberate', () => {
  it('refuses to run without a stated reason', async () => {
    await expect(repo.listAll('')).rejects.toThrow(/requires a reason/);
  });

  it('returns the whole namespace when a reason is given', async () => {
    await repo.put('a', { id: 'a', name: 'A' });
    await repo.put('b', { id: 'b', name: 'B' });
    const all = await repo.listAll('test needs the full set');
    expect(all).toHaveLength(2);
  });
});

describe('direct kv_store access ratchet', () => {
  /**
   * F10 deferred banning direct `kv_store` access on the explicit grounds that
   * "the repositories/ layer it should point at does not exist yet". It exists
   * now, so the backlog is floored: access site #N+1 cannot land silently while
   * the rest is migrated.
   *
   * A ban would be wrong — 177 modules reach the store directly and the
   * repositories cover one namespace so far. A floor is the honest instrument.
   *
   * WHY THIS COUNTS CALLS AND NOT IMPORTING MODULES
   * ----------------------------------------------
   * It used to count modules with a `kv_store` import. That number moves when a
   * file is SPLIT, even though splitting one 1,725-line service into three
   * modules adds no coupling whatsoever — the same 59 `kv.*` calls simply live
   * in three files instead of one. With 72 files still over 1,000 lines and 11
   * of them reaching the store directly, a module count would have to be raised
   * roughly twenty more times during the split-up, which is how a ratchet
   * quietly stops meaning anything.
   *
   * Counting call sites is invariant under moving code between files, and it is
   * strictly stricter in the direction that matters: a NEW `kv.get` added inside
   * a module that already imported the store was invisible to the old measure
   * and is caught by this one.
   */
  function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        walk(full, acc);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        acc.push(full);
      }
    }
    return acc;
  }

  /**
   * Every module in the tree imports the store the same way — `import * as kv`,
   * 183 of 183 — so `kv.<method>(` finds the access sites without missing a
   * destructured alias.
   */
  const CALL = /\bkv\.[a-zA-Z_]\w*\s*\(/g;

  const accessSites = walk(SERVER_DIR)
    .filter((f) => {
      const rel = f.slice(SERVER_DIR.length + 1);
      // The repositories layer and the store itself are allowed to.
      if (rel.startsWith('repositories/') || rel === 'kv_store.tsx') return false;
      return /from '\.{1,2}\/kv_store\.tsx'/.test(readFileSync(f, 'utf8'));
    })
    .map((f) => ({
      file: f.slice(SERVER_DIR.length + 1),
      count: (readFileSync(f, 'utf8').match(CALL) ?? []).length,
    }))
    .filter((row) => row.count > 0);

  const totalCalls = accessSites.reduce((sum, row) => sum + row.count, 0);

  it('recognises a call site, and does not count the import as one', () => {
    // The inverse of the usual vacuous-gate risk: a detector that matched
    // nothing would drive the count to zero and read as a clean sweep.
    const probe = (s: string) => (s.match(new RegExp(CALL.source, 'g')) ?? []).length;
    expect(probe('  const row = await kv.get(`resource:${id}`);')).toBe(1);
    expect(probe('  await kv.set(k, v);\n  await kv.del(k);')).toBe(2);
    expect(probe("import * as kv from './kv_store.tsx';")).toBe(0);
  });

  it('finds a realistic number of direct access sites', () => {
    expect(accessSites.length).toBeGreaterThan(50);
    expect(totalCalls).toBeGreaterThan(200);
  });

  it('does not add direct kv_store access beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `.kv-direct-access-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (totalCalls > floor) {
      const worst = accessSites
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((row) => `${String(row.count).padStart(4)}  ${row.file}`)
        .join('\n  ');
      expect.fail(
        `Direct kv_store calls rose to ${totalCalls} (floor ${floor}).\n` +
          `Moving code between files does not move this number — only adding a\n` +
          `kv.* call does — so this is new direct access, not a refactor.\n` +
          `Add a repository under repositories/ for the namespace instead — see\n` +
          `repositories/communication-groups-repository.ts for the shape. Prefer\n` +
          `list() over listAll(): kv.getByPrefix has no limit.\n` +
          `If direct access is genuinely right here, say why in the PR and\n` +
          `re-baseline to ${totalCalls}.\n\n` +
          `Heaviest callers:\n  ${worst}`,
      );
    }

    if (totalCalls < floor) {
      announceRatchetSlack(
        'kv-repository',
        totalCalls,
        floor,
        '.kv-direct-access-baseline',
        'direct kv_store calls',
      );
    }
  });
});
