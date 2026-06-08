/**
 * Tests for usePolicyRenewals hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePolicyRenewals } from '../usePolicyRenewals';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockApiGet = vi.fn();

vi.mock('../../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

const mockClientApiGetClients = vi.fn();

vi.mock('../../../client-management/api', () => ({
  clientApi: {
    getClients: (...args: unknown[]) => mockClientApiGetClients(...args),
  },
}));

vi.mock('../../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../queryKeys', () => ({
  calendarKeys: {
    all: ['calendar'],
    renewals: (year: number) => ['policy-renewals', year],
    events: {
      all: ['calendar', 'events'],
      list: (filters?: unknown) => ['calendar', 'events', 'list', filters ?? {}],
      detail: (id: string) => ['calendar', 'events', 'detail', id],
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryResult(data: unknown = [], loading = false) {
  return { data, isLoading: loading, isError: false, error: null };
}

const TEST_DATE = new Date('2025-06-15');

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(makeQueryResult([]));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePolicyRenewals', () => {
  // ── useQuery configuration ────────────────────────────────────────────────

  it('calls useQuery once', () => {
    renderHook(() => usePolicyRenewals(TEST_DATE));
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
  });

  it('passes queryKey with current year', () => {
    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['policy-renewals', 2025]);
  });

  it('passes 1-hour staleTime', () => {
    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.staleTime).toBe(60 * 60 * 1000);
  });

  it('uses different query key for different years', () => {
    renderHook(() => usePolicyRenewals(new Date('2026-03-01')));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['policy-renewals', 2026]);
  });

  it('returns data from useQuery', () => {
    const mockEvents = [
      { id: 'renewal-p1-2025', title: 'Renewal: Provider A - Alice Smith (Inception)' },
    ];
    mockUseQuery.mockReturnValue(makeQueryResult(mockEvents));
    const { result } = renderHook(() => usePolicyRenewals(TEST_DATE));
    expect(result.current.data).toEqual(mockEvents);
  });

  // ── queryFn: empty renewals ───────────────────────────────────────────────

  it('queryFn returns empty array when renewals response has no renewals', async () => {
    mockApiGet.mockResolvedValue({ renewals: [] });
    mockClientApiGetClients.mockResolvedValue({ users: [] });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    expect(events).toEqual([]);
  });

  it('queryFn returns empty array when renewals response is null/undefined', async () => {
    mockApiGet.mockResolvedValue(null);
    mockClientApiGetClients.mockResolvedValue({ users: [] });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    expect(events).toEqual([]);
  });

  // ── queryFn: event generation ─────────────────────────────────────────────

  it('queryFn generates renewal events for a policy', async () => {
    const inceptionDate = '2020-06-15'; // same month/day as TEST_DATE so anniversaries land on exact date
    mockApiGet.mockResolvedValue({
      renewals: [
        {
          clientId: 'c-1',
          policyId: 'p-1',
          providerName: 'Acme Insurance',
          categoryId: 'cat-1',
          categoryLabel: 'Life Insurance',
          policyNumber: 'POL-001',
          inceptionDate,
          inceptionFieldName: 'inception_date',
        },
      ],
    });
    mockClientApiGetClients.mockResolvedValue({
      users: [{ id: 'c-1', name: 'Alice Smith', email: 'alice@example.com' }],
    });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    // Should generate events for currentYear-1, currentYear, currentYear+1 (all >= inception 2020)
    expect(events.length).toBe(3);
    expect(events[0].event_type).toBe('renewal');
    expect(events[0].client_id).toBe('c-1');
  });

  it('queryFn sets correct id format on renewal events', async () => {
    mockApiGet.mockResolvedValue({
      renewals: [
        {
          clientId: 'c-1',
          policyId: 'p-42',
          providerName: 'Insurer',
          categoryId: 'cat-1',
          categoryLabel: 'Health',
          policyNumber: '',
          inceptionDate: '2020-01-10',
          inceptionFieldName: 'inception_date',
        },
      ],
    });
    mockClientApiGetClients.mockResolvedValue({ users: [] });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    const ids = events.map((e: { id: string }) => e.id);
    expect(ids).toContain('renewal-p-42-2025');
  });

  it('queryFn includes client name in event title when client exists', async () => {
    mockApiGet.mockResolvedValue({
      renewals: [
        {
          clientId: 'c-1',
          policyId: 'p-1',
          providerName: 'SunLife',
          categoryId: 'cat-1',
          categoryLabel: 'Life',
          policyNumber: '123',
          inceptionDate: '2022-03-20',
          inceptionFieldName: 'inception_date',
        },
      ],
    });
    mockClientApiGetClients.mockResolvedValue({
      users: [{ id: 'c-1', name: 'Bob Jones', email: 'bob@example.com' }],
    });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    expect(events.length).toBeGreaterThan(0);
    events.forEach((e: { title: string }) => {
      expect(e.title).toContain('Bob Jones');
    });
  });

  it('queryFn uses "Unknown Client" when clientId not found in client map', async () => {
    mockApiGet.mockResolvedValue({
      renewals: [
        {
          clientId: 'unknown-client',
          policyId: 'p-1',
          providerName: 'Insurer',
          categoryId: 'cat-1',
          categoryLabel: 'Life',
          policyNumber: '',
          inceptionDate: '2022-01-01',
          inceptionFieldName: 'inception_date',
        },
      ],
    });
    mockClientApiGetClients.mockResolvedValue({ users: [] });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].title).toContain('Unknown Client');
  });

  it('queryFn skips renewals with invalid inception dates', async () => {
    mockApiGet.mockResolvedValue({
      renewals: [
        {
          clientId: 'c-1',
          policyId: 'p-bad',
          providerName: 'Insurer',
          categoryId: 'cat-1',
          categoryLabel: 'Life',
          policyNumber: '',
          inceptionDate: 'not-a-date',
          inceptionFieldName: 'inception_date',
        },
      ],
    });
    mockClientApiGetClients.mockResolvedValue({ users: [] });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    expect(events).toEqual([]);
  });

  it('queryFn does not generate events for years before inception', async () => {
    // Inception in the future — should produce fewer/no events for past years
    mockApiGet.mockResolvedValue({
      renewals: [
        {
          clientId: 'c-1',
          policyId: 'p-future',
          providerName: 'Insurer',
          categoryId: 'cat-1',
          categoryLabel: 'Life',
          policyNumber: '',
          inceptionDate: '2026-06-15', // year after TEST_DATE (2025)
          inceptionFieldName: 'inception_date',
        },
      ],
    });
    mockClientApiGetClients.mockResolvedValue({ users: [] });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    // Only 2026 qualifies (currentYear+1), not 2024 or 2025
    expect(events.length).toBe(1);
    expect(events[0].id).toBe('renewal-p-future-2026');
  });

  it('queryFn sets recurrence_rule to FREQ=YEARLY on all events', async () => {
    mockApiGet.mockResolvedValue({
      renewals: [
        {
          clientId: 'c-1',
          policyId: 'p-1',
          providerName: 'Insurer',
          categoryId: 'cat-1',
          categoryLabel: 'Life',
          policyNumber: '999',
          inceptionDate: '2020-01-01',
          inceptionFieldName: 'inception_date',
        },
      ],
    });
    mockClientApiGetClients.mockResolvedValue({ users: [] });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });

    renderHook(() => usePolicyRenewals(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();

    events.forEach((e: { recurrence_rule: string }) => {
      expect(e.recurrence_rule).toBe('FREQ=YEARLY');
    });
  });
});
