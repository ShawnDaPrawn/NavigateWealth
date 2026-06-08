/**
 * Tests for useDashboardKPIs — a pure useMemo hook.
 *
 * No React Query, no async. We mock only calculateGrowth from '../utils'
 * (relative path from the hook's location, not from the test file).
 * lucide-react is NOT mocked — icons are just function references.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock calculateGrowth ──────────────────────────────────────────────────────

vi.mock('../../utils', () => ({
  calculateGrowth: vi.fn(() => 0),
}));

import { useDashboardKPIs } from '../useDashboardKPIs';
import { calculateGrowth } from '../../utils';
import type { DashboardStats, DashboardMetrics } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    total_clients: 100,
    pending_applications: 5,
    pending_tasks: 10,
    new_this_month: 8,
    new_last_month: 6,
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    activePolicies: 50,
    newPoliciesCount: 5,
    completedFNAs: 20,
    pendingFNAs: 3,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDashboardKPIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateGrowth).mockReturnValue(0);
  });

  // ── Always returns 4 KPIs ──────────────────────────────────────────────────

  describe('grid stability — always 4 KPIs', () => {
    it('returns exactly 4 KPIs when stats=null and metrics=null', () => {
      const { result } = renderHook(() => useDashboardKPIs({ stats: null, metrics: null }));
      expect(result.current.kpis).toHaveLength(4);
    });

    it('returns exactly 4 KPIs when stats and metrics are provided', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats(), metrics: makeMetrics() }),
      );
      expect(result.current.kpis).toHaveLength(4);
    });

    it('returns exactly 4 KPIs with only stats provided', () => {
      const { result } = renderHook(() => useDashboardKPIs({ stats: makeStats(), metrics: null }));
      expect(result.current.kpis).toHaveLength(4);
    });

    it('returns exactly 4 KPIs with only metrics provided', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: makeMetrics() }),
      );
      expect(result.current.kpis).toHaveLength(4);
    });

    it('KPI titles are always Total Clients, New Applications, Pending Tasks, Active Policies', () => {
      const { result } = renderHook(() => useDashboardKPIs({ stats: null, metrics: null }));
      const titles = result.current.kpis.map((k) => k.title);
      expect(titles).toEqual([
        'Total Clients',
        'New Applications',
        'Pending Tasks',
        'Active Policies',
      ]);
    });
  });

  // ── loading flag ───────────────────────────────────────────────────────────

  describe('top-level loading flag', () => {
    it('loading is false by default', () => {
      const { result } = renderHook(() => useDashboardKPIs({ stats: null, metrics: null }));
      expect(result.current.loading).toBe(false);
    });

    it('loading reflects the passed loading option when true', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: null, loading: true }),
      );
      expect(result.current.loading).toBe(true);
    });

    it('loading reflects the passed loading option when false', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats(), metrics: makeMetrics(), loading: false }),
      );
      expect(result.current.loading).toBe(false);
    });
  });

  // ── stats=null → per-card loading flag ────────────────────────────────────

  describe('per-card loading when stats=null', () => {
    it('Total Clients KPI has loading flag when stats=null and loading=true', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: null, loading: true }),
      );
      expect(result.current.kpis[0].loading).toBe(true);
    });

    it('New Applications KPI has loading flag when stats=null and loading=true', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: null, loading: true }),
      );
      expect(result.current.kpis[1].loading).toBe(true);
    });

    it('Pending Tasks KPI has loading flag when stats=null and loading=true', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: null, loading: true }),
      );
      expect(result.current.kpis[2].loading).toBe(true);
    });

    it('Active Policies KPI has loading flag when metrics=null and loading=true', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: null, loading: true }),
      );
      expect(result.current.kpis[3].loading).toBe(true);
    });

    it('stats-backed KPIs do NOT have loading flag when stats is provided', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats(), metrics: null, loading: true }),
      );
      expect(result.current.kpis[0].loading).toBeUndefined();
      expect(result.current.kpis[1].loading).toBeUndefined();
      expect(result.current.kpis[2].loading).toBeUndefined();
    });

    it('Active Policies KPI does NOT have loading flag when metrics are provided', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: makeMetrics(), loading: true }),
      );
      expect(result.current.kpis[3].loading).toBeUndefined();
    });
  });

  // ── loadingStates per-source override ─────────────────────────────────────

  describe('loadingStates granular override', () => {
    it('stats-backed KPIs get loading=true when loadingStates.stats=true', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({
          stats: null,
          metrics: null,
          loadingStates: { stats: true, metrics: false },
        }),
      );
      expect(result.current.kpis[0].loading).toBe(true);
      expect(result.current.kpis[1].loading).toBe(true);
      expect(result.current.kpis[2].loading).toBe(true);
    });

    it('Active Policies KPI gets loading=true when loadingStates.metrics=true', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({
          stats: null,
          metrics: null,
          loadingStates: { stats: false, metrics: true },
        }),
      );
      expect(result.current.kpis[3].loading).toBe(true);
    });

    it('loadingStates.stats=false overrides loading=true for stats KPIs', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({
          stats: null,
          metrics: null,
          loading: true,
          loadingStates: { stats: false, metrics: false },
        }),
      );
      // loadingStates.stats is explicitly false; the hook uses ?? not ||
      expect(result.current.kpis[0].loading).toBe(false);
    });
  });

  // ── Total Clients ──────────────────────────────────────────────────────────

  describe('Total Clients KPI', () => {
    it('value reflects stats.total_clients', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats({ total_clients: 42 }), metrics: null }),
      );
      expect(result.current.kpis[0].value).toBe(42);
    });

    it('value is 0 when total_clients is 0', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats({ total_clients: 0 }), metrics: null }),
      );
      expect(result.current.kpis[0].value).toBe(0);
    });
  });

  // ── New Applications ───────────────────────────────────────────────────────

  describe('New Applications KPI', () => {
    it('value reflects stats.new_this_month', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats({ new_this_month: 15 }), metrics: null }),
      );
      expect(result.current.kpis[1].value).toBe(15);
    });

    it('calls calculateGrowth with new_this_month and new_last_month', () => {
      renderHook(() =>
        useDashboardKPIs({
          stats: makeStats({ new_this_month: 10, new_last_month: 8 }),
          metrics: null,
        }),
      );
      expect(calculateGrowth).toHaveBeenCalledWith(10, 8);
    });

    it('does not call calculateGrowth for Applications when stats=null', () => {
      renderHook(() => useDashboardKPIs({ stats: null, metrics: null }));
      expect(calculateGrowth).not.toHaveBeenCalled();
    });

    it('trend is "up" when calculateGrowth returns positive value', () => {
      vi.mocked(calculateGrowth).mockReturnValueOnce(10);
      const { result } = renderHook(() => useDashboardKPIs({ stats: makeStats(), metrics: null }));
      expect(result.current.kpis[1].trend).toBe('up');
    });

    it('trend is "down" when calculateGrowth returns negative value', () => {
      vi.mocked(calculateGrowth).mockReturnValueOnce(-5);
      const { result } = renderHook(() => useDashboardKPIs({ stats: makeStats(), metrics: null }));
      expect(result.current.kpis[1].trend).toBe('down');
    });

    it('trend is "neutral" when calculateGrowth returns zero', () => {
      vi.mocked(calculateGrowth).mockReturnValueOnce(0);
      const { result } = renderHook(() => useDashboardKPIs({ stats: makeStats(), metrics: null }));
      expect(result.current.kpis[1].trend).toBe('neutral');
    });

    it('change reflects the growth value', () => {
      vi.mocked(calculateGrowth).mockReturnValueOnce(25);
      const { result } = renderHook(() => useDashboardKPIs({ stats: makeStats(), metrics: null }));
      expect(result.current.kpis[1].change).toBe(25);
    });
  });

  // ── Pending Tasks ──────────────────────────────────────────────────────────

  describe('Pending Tasks KPI', () => {
    it('value reflects stats.pending_tasks', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats({ pending_tasks: 7 }), metrics: null }),
      );
      expect(result.current.kpis[2].value).toBe(7);
    });

    it('value is 0 when pending_tasks is 0', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats({ pending_tasks: 0 }), metrics: null }),
      );
      expect(result.current.kpis[2].value).toBe(0);
    });
  });

  // ── Active Policies ────────────────────────────────────────────────────────

  describe('Active Policies KPI', () => {
    it('value reflects metrics.activePolicies', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: makeMetrics({ activePolicies: 99 }) }),
      );
      expect(result.current.kpis[3].value).toBe(99);
    });

    it('calls calculateGrowth with newPoliciesCount and previousPolicies', () => {
      // activePolicies=50, newPoliciesCount=10 → previousPolicies=40
      renderHook(() =>
        useDashboardKPIs({
          stats: null,
          metrics: makeMetrics({ activePolicies: 50, newPoliciesCount: 10 }),
        }),
      );
      expect(calculateGrowth).toHaveBeenCalledWith(10, 40);
    });

    it('does not call calculateGrowth for Policies when metrics=null', () => {
      renderHook(() => useDashboardKPIs({ stats: null, metrics: null }));
      expect(calculateGrowth).not.toHaveBeenCalled();
    });

    it('trend is "up" when policies growth is positive', () => {
      vi.mocked(calculateGrowth).mockReturnValueOnce(20);
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: makeMetrics() }),
      );
      expect(result.current.kpis[3].trend).toBe('up');
    });

    it('trend is "down" when policies growth is negative', () => {
      vi.mocked(calculateGrowth).mockReturnValueOnce(-10);
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: makeMetrics() }),
      );
      expect(result.current.kpis[3].trend).toBe('down');
    });

    it('trend is "neutral" when policies growth is zero', () => {
      vi.mocked(calculateGrowth).mockReturnValueOnce(0);
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: null, metrics: makeMetrics() }),
      );
      expect(result.current.kpis[3].trend).toBe('neutral');
    });

    it('subtitle mentions newPoliciesCount new this period', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({
          stats: null,
          metrics: makeMetrics({ newPoliciesCount: 7 }),
        }),
      );
      expect(result.current.kpis[3].subtitle).toContain('7');
    });
  });

  // ── format field ───────────────────────────────────────────────────────────

  describe('format field', () => {
    it('all 4 KPIs have format "number"', () => {
      const { result } = renderHook(() =>
        useDashboardKPIs({ stats: makeStats(), metrics: makeMetrics() }),
      );
      for (const kpi of result.current.kpis) {
        expect(kpi.format).toBe('number');
      }
    });
  });
});
