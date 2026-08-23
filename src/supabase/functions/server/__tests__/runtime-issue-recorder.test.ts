/**
 * Runtime-issue recorder — SECURITY-AUDIT A17 regression guard
 * ============================================================
 *
 * `recordRuntimeServerIssue` is a read-modify-write over ONE KV row, and
 * `kv.set` is a bare upsert: no compare-and-set, no row lock. It sits on the
 * error path of every route behind the 77 lazy mounts, and it was awaited
 * before the response went out. Two consequences, both worst during exactly the
 * incident the dashboard exists to surface:
 *
 *   - concurrent 500s read the same snapshot, so occurrence counts under-report;
 *   - every 500 paid two serialised round-trips to the same Supabase project
 *     that is already degraded, so the error path amplified its own load.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/runtime-issue-recorder.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const store = new Map<string, unknown>();
/** Resolves the next kv.get, so a second writer can be interleaved mid-write. */
let gateGet: (() => void) | null = null;

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => {
    if (gateGet) {
      await new Promise<void>((resolve) => {
        gateGet = resolve;
      });
    }
    return store.get(key) ?? null;
  }),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
  del: vi.fn(),
  getByPrefix: vi.fn(async () => []),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

import {
  recordRuntimeServerIssue,
  scheduleRuntimeServerIssue,
  getRuntimeServerIssues,
} from '../quality-issues-runtime-server.ts';

const anError = (name: string) => Object.assign(new Error(`${name} failed`), { name });

beforeEach(() => {
  store.clear();
  gateGet = null;
});

afterEach(() => {
  delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
});

describe('concurrent writes in one isolate', () => {
  it('does not lose an occurrence increment when two 500s race', async () => {
    // The defect verbatim: both callers read the same snapshot and the second
    // write clobbers the first's increment. Serialising the chain fixes the
    // same-isolate half of this.
    const input = { error: anError('BoomError'), path: '/a', method: 'GET', statusCode: 500 };

    await Promise.all([recordRuntimeServerIssue(input), recordRuntimeServerIssue(input)]);

    const issues = await getRuntimeServerIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].occurrences).toBe(2);
  });

  it('keeps distinct errors as distinct issues', async () => {
    await Promise.all([
      recordRuntimeServerIssue({ error: anError('AError'), path: '/a', statusCode: 500 }),
      recordRuntimeServerIssue({ error: anError('BError'), path: '/b', statusCode: 500 }),
    ]);

    expect(await getRuntimeServerIssues()).toHaveLength(2);
  });

  it('a failing write does not poison the chain for the next caller', async () => {
    // The chain is shared module state; if one rejection propagated, every later
    // 500 in the isolate would silently stop being recorded.
    await recordRuntimeServerIssue({ error: null as never, path: '/x', statusCode: 500 });
    await recordRuntimeServerIssue({ error: anError('LaterError'), path: '/y', statusCode: 500 });

    const issues = await getRuntimeServerIssues();
    expect(issues.some((i) => i.ruleId === 'LaterError')).toBe(true);
  });
});

describe('scheduling off the request path', () => {
  it('hands the write to EdgeRuntime.waitUntil and returns without awaiting it', async () => {
    const waitUntil = vi.fn();
    (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = { waitUntil };

    // Block the KV read so the write cannot possibly have finished; the
    // scheduler must still return promptly.
    gateGet = () => {};

    await scheduleRuntimeServerIssue({ error: anError('SlowError'), path: '/s', statusCode: 500 });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    // Release the gate so the pending write can settle before the test ends.
    const release = gateGet as unknown as () => void;
    gateGet = null;
    release?.();
  });

  it('falls back to awaiting the write where waitUntil does not exist', async () => {
    // Vitest and any runtime without the hook: behaviour must be exactly what
    // it was before A17, or a record could be lost to isolate suspension.
    expect((globalThis as { EdgeRuntime?: unknown }).EdgeRuntime).toBeUndefined();

    await scheduleRuntimeServerIssue({ error: anError('SyncError'), path: '/f', statusCode: 500 });

    const issues = await getRuntimeServerIssues();
    expect(issues.some((i) => i.ruleId === 'SyncError')).toBe(true);
  });

  it('never throws, whatever it is handed', async () => {
    // It runs inside the error handler; a throw here turns a handled 500 into an
    // unhandled one.
    await expect(
      scheduleRuntimeServerIssue({ error: undefined, path: undefined, statusCode: 500 }),
    ).resolves.toBeUndefined();
  });
});
