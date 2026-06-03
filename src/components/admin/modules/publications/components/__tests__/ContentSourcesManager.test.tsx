/**
 * ContentSourcesManager — Render / Characterization Test (Phase 4)
 * =================================================================
 *
 * Locks the "Content Sources" heading and the Add Source button for this
 * 1,024-line Phase 6 decomposition target.
 *
 * PublicationsAPI.AutoContent is mocked so the loading gate exits quickly
 * and the full chrome is visible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';

vi.mock('@/components/admin/modules/publications/api', () => ({
  PublicationsAPI: {
    AutoContent: {
      getContentSources: vi.fn().mockResolvedValue([]),
      updateContentSource: vi.fn(),
      addContentSource: vi.fn(),
      deleteContentSource: vi.fn(),
      triggerSource: vi.fn(),
      discoverFeeds: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ContentSourcesManager } from '../ContentSourcesManager';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContentSourcesManager', () => {
  it('shows the "Content Sources" heading after loading', async () => {
    render(<ContentSourcesManager />);

    await waitFor(() => {
      expect(screen.getByText('Content Sources')).toBeTruthy();
    });
  });

  it('shows the Add Source button after loading', async () => {
    render(<ContentSourcesManager />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add source/i })).toBeTruthy();
    });
  });
});
