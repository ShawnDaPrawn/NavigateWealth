/**
 * site-rebuild-trigger.ts — unit tests.
 *
 * Verifies the fire-and-forget Vercel Deploy Hook trigger: no-op without the
 * env var, POSTs the hook when configured, coalesces rapid re-fires, and never
 * throws when the fetch fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const envStore = new Map<string, string>();
vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (key: string) =>
        (globalThis as unknown as { __testEnv?: Map<string, string> }).__testEnv?.get(key),
    },
  };
});
(globalThis as unknown as { __testEnv: Map<string, string> }).__testEnv = envStore;

import { triggerSiteRebuild, resetSiteRebuildTriggerForTests } from '../site-rebuild-trigger.ts';

describe('triggerSiteRebuild', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

  beforeEach(() => {
    envStore.clear();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    resetSiteRebuildTriggerForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does nothing when VERCEL_DEPLOY_HOOK_URL is not configured', () => {
    triggerSiteRebuild('test_no_env');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs the deploy hook when configured', () => {
    envStore.set('VERCEL_DEPLOY_HOOK_URL', 'https://api.vercel.com/v1/hooks/abc');
    triggerSiteRebuild('test_fires');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vercel.com/v1/hooks/abc',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('coalesces triggers fired within the 30s window', () => {
    vi.useFakeTimers();
    envStore.set('VERCEL_DEPLOY_HOOK_URL', 'https://api.vercel.com/v1/hooks/abc');

    triggerSiteRebuild('first');
    triggerSiteRebuild('second');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);
    triggerSiteRebuild('third');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never throws when the hook request fails', async () => {
    envStore.set('VERCEL_DEPLOY_HOOK_URL', 'https://api.vercel.com/v1/hooks/abc');
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(() => triggerSiteRebuild('test_failure')).not.toThrow();
    // Let the rejected promise settle inside the module's catch handler.
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
