import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVirtualizedRows } from '../useVirtualizedRows';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetVirtualItems = vi.fn();
const mockGetTotalSize = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (...args: unknown[]) => {
    // Store the options so tests can inspect them
    mockUseVirtualizer(...args);
    return {
      getVirtualItems: mockGetVirtualItems,
      getTotalSize: mockGetTotalSize,
    };
  },
}));

const mockUseVirtualizer = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockGetVirtualItems.mockReturnValue([]);
  mockGetTotalSize.mockReturnValue(0);
});

// ============================================================================
// shouldVirtualize logic
// ============================================================================

describe('useVirtualizedRows — shouldVirtualize', () => {
  it('virtualises when count exceeds default threshold (50)', () => {
    const { result } = renderHook(() => useVirtualizedRows({ count: 100 }));

    expect(result.current.isVirtualized).toBe(true);
  });

  it('does not virtualise when count is below default threshold', () => {
    const { result } = renderHook(() => useVirtualizedRows({ count: 10 }));

    expect(result.current.isVirtualized).toBe(false);
  });

  it('uses custom threshold when provided', () => {
    const { result } = renderHook(() => useVirtualizedRows({ count: 30, threshold: 25 }));

    expect(result.current.isVirtualized).toBe(true);
  });

  it('does not virtualise when count equals threshold (count > threshold)', () => {
    const { result } = renderHook(() => useVirtualizedRows({ count: 50, threshold: 50 }));

    // 50 > 50 is false, so not virtualized
    expect(result.current.isVirtualized).toBe(false);
  });

  it('respects explicit enabled=true even below threshold', () => {
    const { result } = renderHook(() =>
      useVirtualizedRows({ count: 5, threshold: 50, enabled: true }),
    );

    expect(result.current.isVirtualized).toBe(true);
  });

  it('respects explicit enabled=false even above threshold', () => {
    const { result } = renderHook(() =>
      useVirtualizedRows({ count: 1000, threshold: 50, enabled: false }),
    );

    expect(result.current.isVirtualized).toBe(false);
  });
});

// ============================================================================
// Non-virtualised fallback items
// ============================================================================

describe('useVirtualizedRows — non-virtualised path', () => {
  it('returns synthetic virtual items when not virtualized', () => {
    const { result } = renderHook(() =>
      useVirtualizedRows({ count: 3, estimateSize: 48, enabled: false }),
    );

    expect(result.current.virtualItems).toHaveLength(3);
    expect(result.current.virtualItems[0]).toEqual({
      key: 0,
      index: 0,
      start: 0,
      size: 48,
    });
    expect(result.current.virtualItems[1]).toEqual({
      key: 1,
      index: 1,
      start: 48,
      size: 48,
    });
    expect(result.current.virtualItems[2]).toEqual({
      key: 2,
      index: 2,
      start: 96,
      size: 48,
    });
  });

  it('totalSize equals count * estimateSize when not virtualized', () => {
    const { result } = renderHook(() =>
      useVirtualizedRows({ count: 5, estimateSize: 60, enabled: false }),
    );

    expect(result.current.totalSize).toBe(5 * 60);
  });

  it('uses default estimateSize of 48 when not provided', () => {
    const { result } = renderHook(() => useVirtualizedRows({ count: 2, enabled: false }));

    expect(result.current.totalSize).toBe(2 * 48);
    expect(result.current.virtualItems[0].size).toBe(48);
  });
});

// ============================================================================
// Virtualized path
// ============================================================================

describe('useVirtualizedRows — virtualised path', () => {
  it('returns virtualItems from useVirtualizer when virtualized', () => {
    const mockItems = [
      { key: 'vk-0', index: 0, start: 0, size: 48 },
      { key: 'vk-1', index: 1, start: 48, size: 48 },
    ];
    mockGetVirtualItems.mockReturnValue(mockItems);
    mockGetTotalSize.mockReturnValue(96);

    const { result } = renderHook(() =>
      useVirtualizedRows({ count: 2, estimateSize: 48, enabled: true }),
    );

    expect(result.current.virtualItems).toHaveLength(2);
    expect(result.current.virtualItems[0].key).toBe('vk-0');
    expect(result.current.virtualItems[1].index).toBe(1);
  });

  it('returns totalSize from useVirtualizer when virtualized', () => {
    mockGetVirtualItems.mockReturnValue([]);
    mockGetTotalSize.mockReturnValue(500);

    const { result } = renderHook(() => useVirtualizedRows({ count: 100, enabled: true }));

    expect(result.current.totalSize).toBe(500);
  });
});

// ============================================================================
// parentRef
// ============================================================================

describe('useVirtualizedRows — parentRef', () => {
  it('exposes a parentRef object', () => {
    const { result } = renderHook(() => useVirtualizedRows({ count: 0 }));

    expect(result.current.parentRef).toBeDefined();
    // It should be a React ref object (has a .current property)
    expect(Object.prototype.hasOwnProperty.call(result.current.parentRef, 'current')).toBe(true);
  });
});

// ============================================================================
// Default options
// ============================================================================

describe('useVirtualizedRows — defaults', () => {
  it('returns empty virtualItems and zero totalSize for count=0', () => {
    const { result } = renderHook(() => useVirtualizedRows({ count: 0 }));

    expect(result.current.virtualItems).toHaveLength(0);
    expect(result.current.totalSize).toBe(0);
  });
});
