/**
 * Runtime contract wiring on the client-list boundary (Stage C / F8).
 * ===================================================================
 *
 * Two properties, and the first one matters more than the second.
 *
 * 1. **Report-only means report-only.** Adding these checks must not change
 *    what the hook returns, in any scenario — including the ones where the
 *    contract is violated. If a malformed response starts producing a
 *    different client list than it did before, the "safe to adopt" claim on
 *    `parseContract` is false and every other adoption becomes an outage risk.
 *
 * 2. **The checks actually fire.** A reporter that is never called is the
 *    vacuous version of this whole exercise — the module already spent one
 *    round being a mechanism nobody invoked.
 *
 * The scenario driving the schema is real: `GetClientsResponse.users` is marked
 * `@deprecated` because the server renamed it to `clients`. The hook absorbs
 * either, and falls back to `[]` when neither is present — which renders as
 * "this firm has no clients" rather than as an error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let capturedQueryOptions: { queryFn?: () => Promise<unknown> } = {};

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: typeof capturedQueryOptions) => {
    capturedQueryOptions = options;
    return { data: undefined, isLoading: false };
  }),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock('../../api', () => ({ clientApi: { getClients: vi.fn() } }));

vi.mock('../queryKeys', () => ({
  clientKeys: { all: ['clients'], lists: () => ['clients', 'list'] },
}));

vi.mock('../../normalizeClientProfileKv', () => ({
  normalizeClientProfileKv: (p: unknown) => p,
}));

vi.mock('../../../../../../utils/personName', () => ({
  resolvePersonName: vi.fn(() => ({ firstName: 'Test', lastName: 'User' })),
}));

import { useClientList } from '../useClientList';
import { clientApi } from '../../api';
import {
  setContractViolationReporter,
  resetContractViolationReporter,
} from '../../../../../../shared/contracts';

const reporter = vi.fn();

function apiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
    deleted: false,
    suspended: false,
    ...overrides,
  };
}

/** Render the hook and run the captured queryFn, as React Query would. */
async function runQuery(response: unknown) {
  vi.mocked(clientApi.getClients).mockResolvedValue(response as never);
  renderHook(() => useClientList());
  return capturedQueryOptions.queryFn!();
}

beforeEach(() => {
  vi.clearAllMocks();
  reporter.mockClear();
  capturedQueryOptions = {};
  setContractViolationReporter(reporter);
});

afterEach(() => {
  resetContractViolationReporter();
});

describe('client-list contract — report-only guarantee', () => {
  it('reports nothing on a well-formed response', async () => {
    const clients = await runQuery({ clients: [apiUser()], total: 1, page: 1 });

    expect(reporter).not.toHaveBeenCalled();
    expect(clients).toHaveLength(1);
  });

  it('accepts the legacy `users` field without reporting', async () => {
    // The rename already happened once. Both spellings are still legitimate,
    // so neither may be reported as a violation.
    const clients = await runQuery({ users: [apiUser()], count: 1 });

    expect(reporter).not.toHaveBeenCalled();
    expect(clients).toHaveLength(1);
  });

  it('still returns the same clients when the envelope is malformed', async () => {
    // The load-bearing assertion. A violated contract must change the logs and
    // nothing else.
    const response = { clients: [apiUser()], total: 'not-a-number' };

    const clients = await runQuery(response);

    expect(reporter).toHaveBeenCalled();
    expect(clients).toHaveLength(1);
    expect((clients as { id: string }[])[0].id).toBe('user-1');
  });

  it('passes nested payloads through to the transform untouched', async () => {
    // NOTE: this does NOT test that the schema is non-lossy. The hook discards
    // the parsed value and reads the original response, so stripping in the
    // schema is invisible from here — a mutation removing `.passthrough()`
    // leaves this test green. The non-lossiness property is pinned directly in
    // `client-management/__tests__/contracts.test.ts`, where it is falsifiable.
    // What this asserts is narrower and still worth having: adding the checks
    // did not disturb the data the transform receives.
    const clients = await runQuery({
      clients: [apiUser({ profile: { personalInformation: { idNumber: '900101' } } })],
    });

    expect(reporter).not.toHaveBeenCalled();
    expect((clients as { idNumber: string }[])[0].idNumber).toBe('900101');
  });
});

describe('client-list contract — the drift it was built for', () => {
  it('reports a response carrying neither `clients` nor `users`', async () => {
    // The silent failure: the hook falls back to [], the UI says "no clients",
    // and nothing anywhere says the response shape moved.
    const clients = await runQuery({ total: 0, page: 1 });

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0].endpoint).toBe('GET profile/all-users');
    expect(reporter.mock.calls[0][0].issues).toContain('neither');
    expect(clients).toEqual([]);
  });

  it('reports a client entry missing the id the whole module keys on', async () => {
    const clients = await runQuery({ clients: [{ email: 'x@example.com' }] });

    expect(reporter).toHaveBeenCalled();
    // Still transformed and returned — report-only.
    expect(clients).toHaveLength(1);
  });

  it('reports a transformed client whose email did not survive the server', async () => {
    // Checks the transform's OUTPUT against BaseClientSchema. Names have
    // fallbacks so a missing name is not a violation; `email` has none.
    const clients = await runQuery({ clients: [{ id: 'user-1' }] });

    const endpoints = reporter.mock.calls.map((c) => c[0].endpoint);
    expect(endpoints).toContain('GET profile/all-users → Client');
    expect(clients).toHaveLength(1);
  });

  it('reports once per malformed entry, not once for the whole list', async () => {
    await runQuery({ clients: [{ id: 'a' }, { id: 'b' }, apiUser({ id: 'c' })] });

    const perClient = reporter.mock.calls.filter(
      (c) => c[0].endpoint === 'GET profile/all-users → Client',
    );
    expect(perClient).toHaveLength(2);
  });
});
