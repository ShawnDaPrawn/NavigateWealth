/**
 * Tests for useNewsletterSubscribers hook.
 *
 * Strategy: mock @tanstack/react-query's useQuery, the API module, queryKeys,
 * and the utils module. Use renderHook so that useMemo (used internally for
 * derived state) runs in a proper React context.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('../../api', () => ({
  NewsletterAPI: {
    getSubscribers: (...args: unknown[]) => mockGetSubscribers(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  newsletterKeys: {
    all: ['newsletter'],
    subscribers: () => ['newsletter', 'subscribers'],
    stats: () => ['newsletter', 'stats'],
  },
}));

vi.mock('../../utils', () => ({
  deriveSubscriberStatus: (...args: unknown[]) => mockDeriveSubscriberStatus(...args),
  filterByTimeRange: (...args: unknown[]) => mockFilterByTimeRange(...args),
}));

// ── Mock fn references ────────────────────────────────────────────────────────

const mockGetSubscribers = vi.fn();
const mockDeriveSubscriberStatus = vi.fn();
const mockFilterByTimeRange = vi.fn();

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useNewsletterSubscribers } from '../useNewsletterSubscribers';
import { newsletterKeys } from '../queryKeys';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  staleTime?: number;
}

type Status = 'active' | 'pending' | 'unsubscribed';

interface MinimalSubscriber {
  id: string;
  email: string;
  firstName: string;
  surname: string;
  name: string;
  unsubscribedAt?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSub(id: string, email = `${id}@example.com`): MinimalSubscriber {
  return { id, email, firstName: 'Test', surname: 'User', name: 'Test User' };
}

function mockQueryWith(data: unknown, extra?: Partial<{ isLoading: boolean; error: unknown }>) {
  mockUseQuery.mockReturnValue({
    data,
    isLoading: extra?.isLoading ?? false,
    error: extra?.error ?? null,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNewsletterSubscribers — query configuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes subscribers queryKey', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    renderHook(() => useNewsletterSubscribers());
    expect(captured!.queryKey).toEqual(newsletterKeys.subscribers());
  });

  it('passes staleTime of 5 minutes', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    renderHook(() => useNewsletterSubscribers());
    expect(captured!.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn returns subscribers from NewsletterAPI response', async () => {
    const subs = [makeSub('s-1'), makeSub('s-2')];
    mockGetSubscribers.mockResolvedValue({ subscribers: subs });
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    renderHook(() => useNewsletterSubscribers());
    const result = await captured!.queryFn();
    expect(result).toEqual(subs);
  });

  it('queryFn returns [] when subscribers is undefined in response', async () => {
    mockGetSubscribers.mockResolvedValue({});
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    renderHook(() => useNewsletterSubscribers());
    const result = await captured!.queryFn();
    expect(result).toEqual([]);
  });
});

// ── Derived state ─────────────────────────────────────────────────────────────

describe('useNewsletterSubscribers — derived state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('subscribers is [] when data is undefined', () => {
    mockQueryWith(undefined);
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.subscribers).toEqual([]);
  });

  it('subscribers reflects data from the query', () => {
    const subs = [makeSub('s-1'), makeSub('s-2')];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.subscribers).toEqual(subs);
  });

  it('isLoading reflects query loading state', () => {
    mockQueryWith(undefined, { isLoading: true });
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.isLoading).toBe(true);
  });

  it('error is null when no error', () => {
    mockQueryWith([]);
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.error).toBeNull();
  });

  it('error extracts message from Error instance', () => {
    mockQueryWith(undefined, { error: new Error('network error') });
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.error).toBe('network error');
  });

  it('error uses fallback message for non-Error objects', () => {
    mockQueryWith(undefined, { error: 'plain string error' });
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.error).toBe('Failed to load newsletter subscribers');
  });
});

// ── Stats derivation ──────────────────────────────────────────────────────────

describe('useNewsletterSubscribers — stats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stats.total equals number of subscribers', () => {
    const subs = [makeSub('s-1'), makeSub('s-2'), makeSub('s-3')];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.stats.total).toBe(3);
  });

  it('stats.active counts active subscribers correctly', () => {
    const subs = [makeSub('s-1'), makeSub('s-2'), makeSub('s-3')];
    mockQueryWith(subs);
    // deriveSubscriberStatus is called multiple times per subscriber (for stats + filter)
    // We use a per-id map to give stable answers
    const statusMap: Record<string, Status> = {
      's-1': 'active',
      's-2': 'pending',
      's-3': 'active',
    };
    mockDeriveSubscriberStatus.mockImplementation(
      (s: unknown) => statusMap[(s as MinimalSubscriber).id] ?? 'active',
    );
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.stats.active).toBe(2);
  });

  it('stats.pending counts pending subscribers correctly', () => {
    const subs = [makeSub('s-1'), makeSub('s-2')];
    mockQueryWith(subs);
    const statusMap: Record<string, Status> = { 's-1': 'pending', 's-2': 'active' };
    mockDeriveSubscriberStatus.mockImplementation(
      (s: unknown) => statusMap[(s as MinimalSubscriber).id] ?? 'active',
    );
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.stats.pending).toBe(1);
  });

  it('stats.unsubscribed counts unsubscribed subscribers correctly', () => {
    const subs = [makeSub('s-1'), makeSub('s-2'), makeSub('s-3')];
    mockQueryWith(subs);
    const statusMap: Record<string, Status> = {
      's-1': 'unsubscribed',
      's-2': 'active',
      's-3': 'unsubscribed',
    };
    mockDeriveSubscriberStatus.mockImplementation(
      (s: unknown) => statusMap[(s as MinimalSubscriber).id] ?? 'active',
    );
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers());
    expect(result.current.stats.unsubscribed).toBe(2);
  });
});

// ── Filtering ─────────────────────────────────────────────────────────────────

describe('useNewsletterSubscribers — filtering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filtered equals all subscribers when statusFilter is "all" and no search', () => {
    const subs = [makeSub('s-1'), makeSub('s-2')];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers({ statusFilter: 'all' }));
    expect(result.current.filtered).toEqual(subs);
  });

  it('filters out subscribers whose status does not match statusFilter', () => {
    const subs = [makeSub('s-1'), makeSub('s-2'), makeSub('s-3')];
    mockQueryWith(subs);
    const statusMap: Record<string, Status> = {
      's-1': 'active',
      's-2': 'pending',
      's-3': 'active',
    };
    mockDeriveSubscriberStatus.mockImplementation(
      (s: unknown) => statusMap[(s as MinimalSubscriber).id] ?? 'active',
    );
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() => useNewsletterSubscribers({ statusFilter: 'active' }));
    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.filtered.map((s) => (s as unknown as { id: string }).id)).toEqual([
      's-1',
      's-3',
    ]);
  });

  it('filters by search term against email (case-insensitive)', () => {
    const subs = [
      { ...makeSub('s-1'), email: 'alice@example.com' },
      { ...makeSub('s-2'), email: 'bob@example.com' },
    ];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);
    const { result } = renderHook(() =>
      useNewsletterSubscribers({ statusFilter: 'all', search: 'ALICE' }),
    );
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].email).toBe('alice@example.com');
  });

  it('calls filterByTimeRange when statusFilter is "unsubscribed"', () => {
    const subs = [{ ...makeSub('s-1'), unsubscribedAt: '2026-01-01' }];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('unsubscribed');
    mockFilterByTimeRange.mockReturnValue(subs);
    renderHook(() =>
      useNewsletterSubscribers({ statusFilter: 'unsubscribed', unsubTimeRange: '30d' }),
    );
    expect(mockFilterByTimeRange).toHaveBeenCalledWith(expect.any(Array), '30d');
  });
});

describe('useNewsletterSubscribers — the denominators the footer reports', () => {
  /**
   * THE BUG THIS PINS. There were 12 unsubscribed subscribers, 11 of them older
   * than 30 days. On the Unsubscribed tab with a "Last 30 Days" range the table
   * showed ONE row and the footer read "Showing 1 of 218 subscribers" — a
   * denominator that says nothing about the 11 records the date filter is
   * hiding. It read exactly like the unsubscribe history had been lost. It had
   * not: `statusTotal` and `hiddenByTimeRange` are what make the difference
   * visible instead of alarming.
   */
  beforeEach(() => vi.clearAllMocks());

  const unsubs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...makeSub(`u-${i}`),
      unsubscribedAt: `2026-0${(i % 9) + 1}-01`,
    }));

  it('reports the status population, not the whole list, as the denominator', () => {
    const subs = [...unsubs(12), makeSub('active-1'), makeSub('active-2')];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockImplementation((s: unknown) =>
      (s as MinimalSubscriber).id.startsWith('u-') ? 'unsubscribed' : 'active',
    );
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);

    const { result } = renderHook(() =>
      useNewsletterSubscribers({ statusFilter: 'unsubscribed', unsubTimeRange: 'all' }),
    );

    expect(result.current.statusTotal).toBe(12);
    expect(result.current.filtered).toHaveLength(12);
    expect(result.current.hiddenByTimeRange).toBe(0);
  });

  it('counts the records a date range hides', () => {
    const subs = unsubs(12);
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('unsubscribed');
    // Stand in for "only the most recent one falls inside the last 30 days".
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s.slice(0, 1));

    const { result } = renderHook(() =>
      useNewsletterSubscribers({ statusFilter: 'unsubscribed', unsubTimeRange: '30d' }),
    );

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.statusTotal).toBe(12);
    expect(result.current.hiddenByTimeRange).toBe(11);
  });

  it('does not attribute search narrowing to the date filter', () => {
    // Only the range may claim `hiddenByTimeRange`; otherwise the footer would
    // offer "show all time" as the fix for a search that is doing the hiding.
    const subs = [
      { ...makeSub('u-1', 'alice@example.com'), unsubscribedAt: '2026-01-01' },
      { ...makeSub('u-2', 'bob@example.com'), unsubscribedAt: '2026-01-02' },
    ];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('unsubscribed');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);

    const { result } = renderHook(() =>
      useNewsletterSubscribers({
        statusFilter: 'unsubscribed',
        search: 'alice',
        unsubTimeRange: 'all',
      }),
    );

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.statusTotal).toBe(2);
    expect(result.current.hiddenByTimeRange).toBe(0);
  });

  it('leaves hiddenByTimeRange at zero for non-unsubscribed tabs', () => {
    const subs = [makeSub('s-1'), makeSub('s-2')];
    mockQueryWith(subs);
    mockDeriveSubscriberStatus.mockReturnValue('active');
    mockFilterByTimeRange.mockImplementation((s: unknown[]) => s);

    const { result } = renderHook(() => useNewsletterSubscribers({ statusFilter: 'active' }));

    expect(result.current.hiddenByTimeRange).toBe(0);
    expect(result.current.statusTotal).toBe(2);
  });
});
