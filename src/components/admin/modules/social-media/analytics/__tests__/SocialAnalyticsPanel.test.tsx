/**
 * Social analytics: real Buffer totals, a period selector in the address and
 * a CSV export built in the browser.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const hook = vi.hoisted(() => ({ calls: [] as number[], state: {} as Record<string, unknown> }));
vi.mock('../../hooks/useSocialAnalytics', () => ({
  useSocialAnalytics: (days: number) => {
    hook.calls.push(days);
    return hook.state;
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SocialAnalyticsPanel } from '../SocialAnalyticsPanel';
import { analyticsToCsv, engagementTotal } from '../analyticsModel';

const SUMMARY = {
  from: '2026-10-15',
  to: '2026-11-14',
  metricsUpdatedAt: null,
  totals: {
    impressions: 48210,
    reactions: 900,
    comments: 5,
    shares: 0,
    clicks: 611,
    postCount: 18,
  },
  metrics: [
    { name: 'Impressions', type: 'impressions', value: 48210, unit: '', description: 'Times seen' },
    { name: 'Clicks', type: 'clicks', value: 611, unit: '', description: 'Link, clicks' },
  ],
};

beforeEach(() => {
  hook.calls = [];
  hook.state = { data: SUMMARY, isLoading: false, error: null, refetch: vi.fn() };
});

function renderAt(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin${search}`]}>
      <SocialAnalyticsPanel />
    </MemoryRouter>,
  );
}

describe('SocialAnalyticsPanel', () => {
  it('shows Buffer totals and every metric', () => {
    renderAt();
    expect(screen.getByText('Total impressions')).toBeDefined();
    expect(screen.getAllByText(/^48\D?210$/).length).toBeGreaterThan(0);
    expect(screen.getByText('905')).toBeDefined();
    expect(screen.getByText('Times seen')).toBeDefined();
    expect(hook.calls.at(-1)).toBe(30);
  });

  it('reads the period from the address', () => {
    renderAt('?period=90');
    expect(hook.calls.at(-1)).toBe(90);
  });

  it('exports a CSV in the browser', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('shows the shared error state when Buffer is unavailable', () => {
    hook.state = { data: undefined, isLoading: false, error: new Error('down'), refetch: vi.fn() };
    renderAt();
    expect(screen.getByText('Buffer metrics are unavailable')).toBeDefined();
  });
});

describe('analytics model', () => {
  it('sums engagement and quotes CSV cells', () => {
    expect(engagementTotal(SUMMARY.totals)).toBe(905);
    expect(engagementTotal({ impressions: 1 })).toBeNull();
    const csv = analyticsToCsv(SUMMARY);
    expect(csv.split('\n')[0]).toBe('Metric,Type,Value,Unit,Description,From,To');
    expect(csv).toContain('"Link, clicks"');
  });
});
