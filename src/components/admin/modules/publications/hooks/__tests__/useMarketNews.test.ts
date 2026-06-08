/**
 * Tests for useMarketNews hook.
 *
 * Strategy: mock @tanstack/react-query's useQuery and the API module.
 * Capture queryFn / refetchInterval from the options passed to useQuery so
 * we can test them directly without a QueryClientProvider.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockFetchRSSFeed = vi.fn();

vi.mock('../../api', () => ({
  fetchRSSFeed: (...args: unknown[]) => mockFetchRSSFeed(...args),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useMarketNews, NEWS_KEYS } from '../useMarketNews';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
  staleTime: number;
  refetchOnMount: boolean;
  refetchInterval: (query: unknown) => number | false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function captureOptions(enabled?: boolean): QueryOptions {
  let captured: QueryOptions | undefined;
  mockUseQuery.mockImplementationOnce((opts: unknown) => {
    captured = opts as QueryOptions;
    return {};
  });
  if (enabled === undefined) {
    renderHook(() => useMarketNews());
  } else {
    renderHook(() => useMarketNews(enabled));
  }
  return captured!;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useMarketNews — query configuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('default enabled is true', () => {
    const opts = captureOptions();
    expect(opts.enabled).toBe(true);
  });

  it('passes enabled=false correctly to query', () => {
    const opts = captureOptions(false);
    expect(opts.enabled).toBe(false);
  });

  it('queryKey is NEWS_KEYS.feeds()', () => {
    const opts = captureOptions();
    expect(opts.queryKey).toEqual(NEWS_KEYS.feeds());
  });

  it('staleTime is 5 minutes', () => {
    const opts = captureOptions();
    expect(opts.staleTime).toBe(1000 * 60 * 5);
  });

  it('refetchOnMount is false', () => {
    const opts = captureOptions();
    expect(opts.refetchOnMount).toBe(false);
  });
});

describe('useMarketNews — refetchInterval', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refetchInterval returns 5 minutes when enabled=true', () => {
    const opts = captureOptions(true);
    expect(opts.refetchInterval(null)).toBe(1000 * 60 * 5);
  });

  it('refetchInterval returns false when enabled=false', () => {
    const opts = captureOptions(false);
    expect(opts.refetchInterval(null)).toBe(false);
  });
});

describe('useMarketNews — queryFn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queryFn returns empty NewsData when fetchRSSFeed returns empty array', async () => {
    mockFetchRSSFeed.mockResolvedValue([]);
    const opts = captureOptions();
    const result = (await opts.queryFn()) as Record<string, unknown[]>;
    expect(result.economicNews).toEqual([]);
    expect(result.forexNews).toEqual([]);
    expect(result.stockMarket).toEqual([]);
    expect(result.investingIdeas).toEqual([]);
  });

  it('queryFn populates feeds when fetchRSSFeed returns items', async () => {
    const fakeItems = [{ title: 'News Item', link: 'http://example.com' }];
    // Return items for all feeds
    mockFetchRSSFeed.mockResolvedValue(fakeItems);
    const opts = captureOptions();
    const result = (await opts.queryFn()) as Record<string, unknown[]>;
    expect(result.economicNews).toEqual(fakeItems);
    expect(result.forexNews).toEqual(fakeItems);
    expect(result.stockMarket).toEqual(fakeItems);
    expect(result.investingIdeas).toEqual(fakeItems);
  });

  it('queryFn calls fetchRSSFeed for each feed URL', async () => {
    mockFetchRSSFeed.mockResolvedValue([]);
    const opts = captureOptions();
    await opts.queryFn();
    expect(mockFetchRSSFeed).toHaveBeenCalledTimes(4);
  });

  it('queryFn does not populate feed when fetchRSSFeed returns null', async () => {
    mockFetchRSSFeed.mockResolvedValue(null);
    const opts = captureOptions();
    const result = (await opts.queryFn()) as Record<string, unknown[]>;
    expect(result.economicNews).toEqual([]);
  });
});
