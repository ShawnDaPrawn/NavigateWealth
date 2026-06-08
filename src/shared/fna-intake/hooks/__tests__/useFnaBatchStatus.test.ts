/**
 * Tests for useFnaBatchStatus and useInvalidateFnaBatchStatus hooks.
 *
 * Strategy: mock @tanstack/react-query, @/utils/api, and @/utils/queryKeys.
 * Capture the options objects passed to useQuery to test configuration
 * and invoke queryFn directly to test data/error paths.
 *
 * NOTE: alias paths (@/...) are mocked with their alias form.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockApiGet = vi.fn();

vi.mock('@/utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

vi.mock('@/utils/queryKeys', () => ({
  fnaKeys: {
    batchStatus: (id: string) => ['fna', 'batch-status', id],
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useFnaBatchStatus, useInvalidateFnaBatchStatus } from '../useFnaBatchStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
  staleTime: number;
  gcTime: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function captureOptions(
  clientId: string | undefined,
  options?: { enabled?: boolean },
): QueryOptions {
  let captured: QueryOptions | undefined;
  mockUseQuery.mockImplementationOnce((opts: unknown) => {
    captured = opts as QueryOptions;
    return {};
  });
  renderHook(() => useFnaBatchStatus(clientId, options));
  return captured!;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useFnaBatchStatus — enabled flag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enabled defaults to true when clientId is defined', () => {
    const opts = captureOptions('client-1');
    expect(opts.enabled).toBe(true);
  });

  it('enabled is false when clientId is undefined', () => {
    const opts = captureOptions(undefined);
    expect(opts.enabled).toBe(false);
  });

  it('enabled is false when options.enabled = false', () => {
    const opts = captureOptions('client-1', { enabled: false });
    expect(opts.enabled).toBe(false);
  });

  it('enabled is true when options.enabled = true and clientId is defined', () => {
    const opts = captureOptions('client-1', { enabled: true });
    expect(opts.enabled).toBe(true);
  });
});

describe('useFnaBatchStatus — query configuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queryKey uses fnaKeys.batchStatus(clientId)', () => {
    const opts = captureOptions('client-1');
    expect(opts.queryKey).toEqual(['fna', 'batch-status', 'client-1']);
  });

  it('queryKey uses empty string when clientId is undefined', () => {
    const opts = captureOptions(undefined);
    expect(opts.queryKey).toEqual(['fna', 'batch-status', '']);
  });

  it('staleTime is 5 minutes', () => {
    const opts = captureOptions('client-1');
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('gcTime is 10 minutes', () => {
    const opts = captureOptions('client-1');
    expect(opts.gcTime).toBe(10 * 60 * 1000);
  });
});

describe('useFnaBatchStatus — queryFn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queryFn calls api.get with correct URL', async () => {
    const items = [{ key: 'income', status: 'published', data: null }];
    mockApiGet.mockResolvedValue({ success: true, data: items });
    const opts = captureOptions('client-abc');
    await opts.queryFn();
    expect(mockApiGet).toHaveBeenCalledWith('/fna/batch-status/client/client-abc');
  });

  it('queryFn returns response.data on success', async () => {
    const items = [{ key: 'income', status: 'published', data: null }];
    mockApiGet.mockResolvedValue({ success: true, data: items });
    const opts = captureOptions('client-abc');
    const result = await opts.queryFn();
    expect(result).toEqual(items);
  });

  it('queryFn throws when response.success is false', async () => {
    mockApiGet.mockResolvedValue({ success: false, data: null });
    const opts = captureOptions('client-abc');
    await expect(opts.queryFn()).rejects.toThrow('Batch FNA status response was unsuccessful');
  });

  it('queryFn throws when response.data is falsy', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: null });
    const opts = captureOptions('client-abc');
    await expect(opts.queryFn()).rejects.toThrow('Batch FNA status response was unsuccessful');
  });
});

describe('useInvalidateFnaBatchStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls invalidateQueries with correct key', () => {
    // useInvalidateFnaBatchStatus doesn't call useQuery, it just calls useQueryClient.
    const { result } = renderHook(() => useInvalidateFnaBatchStatus());
    result.current('client-xyz');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['fna', 'batch-status', 'client-xyz'],
    });
  });
});
