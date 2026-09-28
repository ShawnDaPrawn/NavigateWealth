/**
 * GET /investment-ina/client/:clientId/latest-published — auth failures are 401.
 * ==============================================================================
 *
 * The route started authenticating in #344 but kept a catch that flattened
 * every error to 500. The shared API client refreshes the session and retries
 * only on 401, so an expired session showed as "no published INA" instead of
 * recovering. The Estate and Medical equivalents already used
 * fnaErrorResponse.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
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

const app = (await import('../investment-ina-routes.tsx')).default;

describe('latest-published Investment INA', () => {
  it('answers 401, not 500, when the caller has no session', async () => {
    const res = await app.request('/client/client-a/latest-published');
    expect(res.status).toBe(401);
  });
});
