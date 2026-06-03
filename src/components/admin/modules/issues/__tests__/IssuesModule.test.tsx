/**
 * IssuesModule — Render / Characterization Test (Phase 4)
 * ========================================================
 *
 * Locks the mount contract and the three main section cards (Response Queue,
 * Automation Watchtower, Feed Health) for this 1,285-line Phase 6 target.
 *
 * issues/api is mocked so no real HTTP calls are made.
 * renderWithQueryClient wraps the required QueryClientProvider (the component
 * calls useQueryClient to invalidate pending-counts queries).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithQueryClient } from '@/test/utils';

vi.mock('@/components/admin/modules/issues/api', () => ({
  fetchQualityIssuesSnapshot: vi.fn(),
  runQualityIssueAutomation: vi.fn(),
  updateQualityIssueWorkflow: vi.fn(),
  createQualityIssueRemediationTask: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { fetchQualityIssuesSnapshot } from '@/components/admin/modules/issues/api';
import { IssuesModule } from '../IssuesModule';

// Minimal snapshot that satisfies all the fields the component reads.
const minimalSnapshot = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  issues: [],
  summary: {
    total: 0,
    open: 0,
    errors: 0,
    warnings: 0,
    bySource: {
      build: 0,
      test: 0,
      audit: 0,
      accessibility: 0,
      'runtime-client': 0,
      'runtime-server': 0,
    },
    byCategory: {
      build: 0,
      test: 0,
      security: 0,
      accessibility: 0,
      runtime: 0,
      configuration: 0,
      unknown: 0,
    },
    byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchQualityIssuesSnapshot).mockResolvedValue(minimalSnapshot as never);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IssuesModule', () => {
  it('renders without throwing and shows the Issue Manager heading', async () => {
    renderWithQueryClient(<IssuesModule />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Issue Manager' })).toBeTruthy();
    });
  });

  it('shows the Response Queue and Automation Watchtower section cards', async () => {
    renderWithQueryClient(<IssuesModule />);

    await waitFor(() => {
      expect(screen.getByText('Response Queue')).toBeTruthy();
    });
    expect(screen.getByText('Automation Watchtower')).toBeTruthy();
  });

  it('shows the Feed Health section card', async () => {
    renderWithQueryClient(<IssuesModule />);

    await waitFor(() => {
      expect(screen.getByText('Feed Health')).toBeTruthy();
    });
  });
});
