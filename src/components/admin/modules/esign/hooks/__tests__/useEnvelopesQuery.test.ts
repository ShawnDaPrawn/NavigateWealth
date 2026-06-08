/**
 * Tests for useEnvelopesQuery
 *
 * Mock paths are relative to this test file (hooks/__tests__/):
 *   - '@tanstack/react-query'       → React Query
 *   - '../../api'                   → esign/api.ts
 *   - '../constants'                → hooks/constants (re-exported from esign/constants)
 *   - '../../../../../../utils/logger' → utils/logger.ts
 *
 * Strategy: mock useQuery to capture options, then exercise the queryFn and
 * inspect the resolved data. Arrow-function wrappers satisfy the vi.mock
 * hoisting rule.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  esignKeys,
  useAllEnvelopes,
  useClientEnvelopes,
  useEnvelope,
  useAuditTrail,
} from '../useEnvelopesQuery';

// ============================================================================
// MOCK SPIES
// ============================================================================

const mockUseQuery = vi.fn();

const mockGetAllEnvelopes = vi.fn();
const mockGetClientEnvelopes = vi.fn();
const mockGetEnvelope = vi.fn();
const mockGetAuditTrail = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('../../api', () => ({
  esignApi: {
    getAllEnvelopes: (...args: unknown[]) => mockGetAllEnvelopes(...args),
    getClientEnvelopes: (...args: unknown[]) => mockGetClientEnvelopes(...args),
    getEnvelope: (...args: unknown[]) => mockGetEnvelope(...args),
    getAuditTrail: (...args: unknown[]) => mockGetAuditTrail(...args),
  },
}));

vi.mock('../constants', () => ({
  QUERY_STALE_TIME: 30000,
  QUERY_GC_TIME: 300000,
}));

vi.mock('../../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

/** Capture the options object passed to useQuery on the most recent call */
function lastQueryOptions() {
  return mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1][0] as Record<string, unknown>;
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  // Default: useQuery just returns an empty stub so callers don't throw
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
});

// ============================================================================
// 1. esignKeys factory
// ============================================================================

describe('esignKeys', () => {
  it('all returns the base key array', () => {
    expect(esignKeys.all).toEqual(['esign']);
  });

  it('envelopes() returns [...all, "envelopes"]', () => {
    expect(esignKeys.envelopes()).toEqual(['esign', 'envelopes']);
  });

  it('envelope(id) returns [...all, "envelope", id]', () => {
    expect(esignKeys.envelope('env-1')).toEqual(['esign', 'envelope', 'env-1']);
  });

  it('clientEnvelopes(clientId) returns [...all, "client", clientId]', () => {
    expect(esignKeys.clientEnvelopes('client-42')).toEqual(['esign', 'client', 'client-42']);
  });

  it('allEnvelopes() without status returns [...envelopes(), { status: undefined }]', () => {
    expect(esignKeys.allEnvelopes()).toEqual(['esign', 'envelopes', { status: undefined }]);
  });

  it('allEnvelopes(status) includes the status string', () => {
    expect(esignKeys.allEnvelopes('draft')).toEqual(['esign', 'envelopes', { status: 'draft' }]);
  });

  it('auditTrail(envelopeId) returns [...envelope(id), "audit"]', () => {
    expect(esignKeys.auditTrail('env-99')).toEqual(['esign', 'envelope', 'env-99', 'audit']);
  });
});

// ============================================================================
// 2. useAllEnvelopes
// ============================================================================

describe('useAllEnvelopes', () => {
  it('passes the correct queryKey', () => {
    useAllEnvelopes();
    const opts = lastQueryOptions();
    expect(opts.queryKey).toEqual(['esign', 'envelopes', { status: undefined }]);
  });

  it('passes the correct queryKey with a status filter', () => {
    useAllEnvelopes('sent');
    const opts = lastQueryOptions();
    expect(opts.queryKey).toEqual(['esign', 'envelopes', { status: 'sent' }]);
  });

  it('sets staleTime from QUERY_STALE_TIME constant', () => {
    useAllEnvelopes();
    const opts = lastQueryOptions();
    expect(opts.staleTime).toBe(30000);
  });

  it('sets gcTime from QUERY_GC_TIME constant', () => {
    useAllEnvelopes();
    const opts = lastQueryOptions();
    expect(opts.gcTime).toBe(300000);
  });

  it('sets retry: false', () => {
    useAllEnvelopes();
    const opts = lastQueryOptions();
    expect(opts.retry).toBe(false);
  });

  it('is enabled by default', () => {
    useAllEnvelopes();
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(true);
  });

  it('passes enabled=false through', () => {
    useAllEnvelopes(undefined, false);
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(false);
  });

  it('queryFn calls esignApi.getAllEnvelopes and returns the envelopes array', async () => {
    const envelopes = [{ id: 'e1' }, { id: 'e2' }];
    mockGetAllEnvelopes.mockResolvedValue({ envelopes });

    useAllEnvelopes('draft');
    const opts = lastQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(mockGetAllEnvelopes).toHaveBeenCalledWith('draft');
    expect(result).toEqual(envelopes);
  });

  it('queryFn returns [] when response.envelopes is absent', async () => {
    mockGetAllEnvelopes.mockResolvedValue({});

    useAllEnvelopes();
    const opts = lastQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(result).toEqual([]);
  });
});

// ============================================================================
// 3. useClientEnvelopes
// ============================================================================

describe('useClientEnvelopes', () => {
  it('passes the correct queryKey with clientId', () => {
    useClientEnvelopes('client-1');
    const opts = lastQueryOptions();
    expect(opts.queryKey).toEqual(['esign', 'client', 'client-1']);
  });

  it('is disabled when clientId is empty string', () => {
    useClientEnvelopes('');
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when clientId is non-empty and enabled=true', () => {
    useClientEnvelopes('client-1', true);
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when enabled=false even with a valid clientId', () => {
    useClientEnvelopes('client-1', false);
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(false);
  });

  it('queryFn calls esignApi.getClientEnvelopes with clientId and clientEmail', async () => {
    const envelopes = [{ id: 'e1' }];
    mockGetClientEnvelopes.mockResolvedValue({ envelopes });

    useClientEnvelopes('client-1', true, 'alice@example.com');
    const opts = lastQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(mockGetClientEnvelopes).toHaveBeenCalledWith('client-1', 'alice@example.com');
    expect(result).toEqual(envelopes);
  });

  it('queryFn returns [] when response.envelopes is absent', async () => {
    mockGetClientEnvelopes.mockResolvedValue({});

    useClientEnvelopes('client-1');
    const opts = lastQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(result).toEqual([]);
  });

  it('passes staleTime, gcTime, and retry:false', () => {
    useClientEnvelopes('client-1');
    const opts = lastQueryOptions();
    expect(opts.staleTime).toBe(30000);
    expect(opts.gcTime).toBe(300000);
    expect(opts.retry).toBe(false);
  });
});

// ============================================================================
// 4. useEnvelope
// ============================================================================

describe('useEnvelope', () => {
  it('passes the correct queryKey', () => {
    useEnvelope('env-123');
    const opts = lastQueryOptions();
    expect(opts.queryKey).toEqual(['esign', 'envelope', 'env-123']);
  });

  it('is enabled when envelopeId is non-empty and enabled=true', () => {
    useEnvelope('env-123', true);
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when envelopeId is empty string', () => {
    useEnvelope('');
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when enabled=false', () => {
    useEnvelope('env-123', false);
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(false);
  });

  it('queryFn calls esignApi.getEnvelope and returns the envelope', async () => {
    const envelope = { id: 'env-123', title: 'Test' };
    mockGetEnvelope.mockResolvedValue(envelope);

    useEnvelope('env-123');
    const opts = lastQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(mockGetEnvelope).toHaveBeenCalledWith('env-123');
    expect(result).toEqual(envelope);
  });

  it('passes staleTime, gcTime, and retry:false', () => {
    useEnvelope('env-1');
    const opts = lastQueryOptions();
    expect(opts.staleTime).toBe(30000);
    expect(opts.gcTime).toBe(300000);
    expect(opts.retry).toBe(false);
  });
});

// ============================================================================
// 5. useAuditTrail (aliased as useEnvelopeAuditTrail in task requirements)
// ============================================================================

describe('useAuditTrail', () => {
  it('passes the correct queryKey including the envelope id', () => {
    useAuditTrail('env-99');
    const opts = lastQueryOptions();
    expect(opts.queryKey).toEqual(['esign', 'envelope', 'env-99', 'audit']);
  });

  it('is disabled by default (enabled=false)', () => {
    useAuditTrail('env-99');
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when enabled=true and envelopeId is non-empty', () => {
    useAuditTrail('env-99', true);
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when envelopeId is empty string even with enabled=true', () => {
    useAuditTrail('', true);
    const opts = lastQueryOptions();
    expect(opts.enabled).toBe(false);
  });

  it('queryFn calls esignApi.getAuditTrail and returns events array', async () => {
    const events = [{ id: 'ev1', action: 'sent' }];
    mockGetAuditTrail.mockResolvedValue({ events });

    useAuditTrail('env-99', true);
    const opts = lastQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(mockGetAuditTrail).toHaveBeenCalledWith('env-99');
    expect(result).toEqual(events);
  });

  it('queryFn returns [] when response.events is absent', async () => {
    mockGetAuditTrail.mockResolvedValue({});

    useAuditTrail('env-99', true);
    const opts = lastQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(result).toEqual([]);
  });

  it('passes staleTime, gcTime, and retry:false', () => {
    useAuditTrail('env-1', true);
    const opts = lastQueryOptions();
    expect(opts.staleTime).toBe(30000);
    expect(opts.gcTime).toBe(300000);
    expect(opts.retry).toBe(false);
  });
});
