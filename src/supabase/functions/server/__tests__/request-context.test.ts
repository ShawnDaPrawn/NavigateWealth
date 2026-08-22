/**
 * Request-scoped logging correlation (Stage B / B4)
 * ================================================
 *
 * The property that matters is ISOLATION under concurrency. A correlation id
 * that leaks between concurrent requests is worse than none: it produces
 * confident, wrong correlation on exactly the incident you are trying to read.
 * That is why this is AsyncLocalStorage and not a module-level variable, and
 * these tests are what stop someone "simplifying" it back.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/request-context.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', {
    env: { get: () => 'test' },
    stderr: { writeSync: (d: Uint8Array) => captured.push(new TextDecoder().decode(d)) },
  });
});

const captured: string[] = [];
beforeEach(() => {
  captured.length = 0;
});

const { runWithRequestContext, getRequestContext, __resetRequestContextForTests } =
  await import('../request-context.ts');
const { createModuleLogger } = await import('../stderr-logger.ts');

afterEach(() => {
  __resetRequestContextForTests();
});

describe('request context isolation', () => {
  it('keeps concurrent requests separate across await boundaries', async () => {
    const seen = await Promise.all(
      ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map((id) =>
        runWithRequestContext({ requestId: id }, async () => {
          // Interleave deliberately: every chain suspends and resumes while the
          // others are mid-flight, which is what breaks a shared variable.
          await new Promise((r) => setTimeout(r, (id.length % 3) + 1));
          const mid = getRequestContext()?.requestId;
          await new Promise((r) => setTimeout(r, 1));
          return [mid, getRequestContext()?.requestId];
        }),
      ),
    );
    expect(seen).toEqual([
      ['alpha', 'alpha'],
      ['bravo', 'bravo'],
      ['charlie', 'charlie'],
      ['delta', 'delta'],
      ['echo', 'echo'],
    ]);
  });

  it('reports no context outside a request', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it('does not leak a context after the request finishes', async () => {
    await runWithRequestContext({ requestId: 'finished' }, async () => undefined);
    expect(getRequestContext()).toBeUndefined();
  });

  it('returns the callback value through', async () => {
    await expect(runWithRequestContext({ requestId: 'x' }, async () => 42)).resolves.toBe(42);
  });

  it('propagates a rejection rather than swallowing it', async () => {
    await expect(
      runWithRequestContext({ requestId: 'x' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});

describe('the logger picks the id up with no call-site change', () => {
  it('stamps [req:<id>] on a module logger inside a request', async () => {
    const log = createModuleLogger('some-module');
    await runWithRequestContext({ requestId: 'rid-abc123' }, async () => {
      log.info('did a thing');
    });
    expect(captured.join('')).toContain('[req:rid-abc123]');
    expect(captured.join('')).toContain('did a thing');
  });

  it('emits the line unchanged outside a request', () => {
    createModuleLogger('some-module').info('background work');
    const line = captured.join('');
    expect(line).toContain('background work');
    expect(line).not.toContain('[req:');
  });

  it('stamps every level, not just info', async () => {
    const log = createModuleLogger('m');
    await runWithRequestContext({ requestId: 'rid-levels' }, async () => {
      log.warn('w');
      log.error('e', new Error('x'));
      log.debug('d');
      log.success('s');
    });
    const stamped = captured.filter((l) => l.includes('[req:rid-levels]'));
    expect(stamped).toHaveLength(4);
  });
});

describe('degradation when node:async_hooks is unavailable', () => {
  it('still runs the request, just without an id', async () => {
    // The deployed target is Supabase's edge runtime — a Deno fork this repo
    // cannot execute. If node:async_hooks is missing there, the request path
    // must be unaffected; only the correlation id is lost.
    vi.resetModules();
    vi.doMock('node:async_hooks', () => {
      throw new Error('not available in this runtime');
    });
    const fresh = await import('../request-context.ts');
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a));

    const result = await fresh.runWithRequestContext({ requestId: 'nope' }, async () => 'served');

    expect(result).toBe('served');
    expect(fresh.getRequestContext()).toBeUndefined();
    expect(JSON.stringify(errors)).toContain('node:async_hooks unavailable');

    spy.mockRestore();
    vi.doUnmock('node:async_hooks');
    vi.resetModules();
  });
});
