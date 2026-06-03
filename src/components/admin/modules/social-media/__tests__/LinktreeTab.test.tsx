/**
 * LinktreeTab — Render / Characterization Test (Phase 4)
 * =======================================================
 *
 * Locks the mount contract and the always-visible "Link in Bio" section
 * heading for this 1,124-line Phase 6 decomposition target.
 *
 * api is mocked so no real HTTP calls are made on mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('@/utils/api', () => ({
  api: {
    get: mockApiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { LinktreeTab } from '../LinktreeTab';

beforeEach(() => {
  vi.clearAllMocks();
  // Resolve with empty data so the component exits loading state and shows chrome.
  mockApiGet.mockResolvedValue({ data: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LinktreeTab', () => {
  it('renders without throwing', async () => {
    const { container } = render(<LinktreeTab />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });
    expect(container).toBeTruthy();
  });

  it('shows the "Link in Bio" section heading', async () => {
    render(<LinktreeTab />);
    await waitFor(() => {
      expect(screen.getByText('Link in Bio')).toBeTruthy();
    });
  });

  it('shows the Add Link and Copy URL buttons', async () => {
    render(<LinktreeTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add link/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /copy url/i })).toBeTruthy();
    });
  });
});
