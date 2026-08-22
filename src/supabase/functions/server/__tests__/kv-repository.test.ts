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

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SERVER_DIR, '../../../..');
const BASELINE_FILE = join(REPO_ROOT, '.kv-direct-import-baseline');

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

describe('direct kv_store import ratchet', () => {
  /**
   * F10 deferred banning direct `kv_store` imports on the explicit grounds that
   * "the repositories/ layer it should point at does not exist yet". It exists
   * now, so the count is floored: importer #N+1 cannot land silently while the
   * backlog is migrated.
   *
   * A ban would be wrong — 178 modules import it and the repositories cover one
   * namespace so far. A floor is the honest instrument.
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

  const importers = walk(SERVER_DIR).filter((f) => {
    const rel = f.slice(SERVER_DIR.length + 1);
    // The repositories layer and the store itself are allowed to.
    if (rel.startsWith('repositories/') || rel === 'kv_store.tsx') return false;
    return /from '\.{1,2}\/kv_store\.tsx'/.test(readFileSync(f, 'utf8'));
  });

  it('finds a realistic number of direct importers', () => {
    expect(importers.length).toBeGreaterThan(50);
  });

  it('does not add direct kv_store importers beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `.kv-direct-import-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (importers.length > floor) {
      expect.fail(
        `Modules importing kv_store directly rose to ${importers.length} (floor ${floor}).\n` +
          `Add a repository under repositories/ for the namespace instead — see\n` +
          `repositories/communication-groups-repository.ts for the shape. Prefer\n` +
          `list() over listAll(): kv.getByPrefix has no limit and 278 call sites.\n` +
          `If direct access is genuinely right here, say why in the PR and\n` +
          `re-baseline to ${importers.length}.`,
      );
    }

    if (importers.length < floor) {
      console.warn(
        `[kv-repository] ${importers.length} direct kv_store importers, below floor ` +
          `${floor} — tighten by setting .kv-direct-import-baseline to ${importers.length}.`,
      );
    }
  });
});
