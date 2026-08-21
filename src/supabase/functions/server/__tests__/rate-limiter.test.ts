import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ rpc }),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(),
  del: vi.fn(),
}));

import { checkRateLimit } from '../rateLimiter.ts';

const config = { maxAttempts: 5, windowMs: 60_000, blockDurationMs: 120_000 };

describe('atomic authentication rate limiter', () => {
  beforeAll(() => {
    vi.stubGlobal('Deno', {
      env: { get: (key: string) => (key === 'SUPABASE_URL' ? 'https://example.test' : 'secret') },
    });
  });

  beforeEach(() => rpc.mockReset());

  it('returns the database decision from the atomic RPC', async () => {
    rpc.mockResolvedValue({
      data: { allowed: true, remaining: 4, resetAt: 1_900_000_000_000, blocked: false },
      error: null,
    });

    const result = await checkRateLimit('person@example.test', 'login', config);

    expect(result).toMatchObject({ allowed: true, remaining: 4, blocked: false });
    expect(result.resetAt.getTime()).toBe(1_900_000_000_000);
    expect(rpc).toHaveBeenCalledWith('check_auth_rate_limit_91ed8379', {
      p_identifier: 'person@example.test',
      p_action: 'login',
      p_max_attempts: 5,
      p_window_ms: 60_000,
      p_block_duration_ms: 120_000,
    });
  });

  it('fails closed when the database decision is unavailable', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('database unavailable') });

    await expect(checkRateLimit('person@example.test', 'login', config)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      blocked: true,
      reason: 'Unable to validate request rate. Please try again later.',
    });
  });
});
