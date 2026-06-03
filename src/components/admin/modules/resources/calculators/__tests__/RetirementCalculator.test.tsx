/**
 * RetirementCalculator — Render / Characterization Test (Phase 4)
 * ================================================================
 *
 * Locks the mount contract and the always-visible "Retirement Planning
 * Calculator" heading for this 973-line Phase 6 decomposition target.
 *
 * api.get is mocked so no real HTTP calls are made on mount.
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

import { RetirementCalculator } from '../RetirementCalculator';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Never resolves — prevents real API traffic while still rendering chrome
  mockApiGet.mockResolvedValue({ calculations: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RetirementCalculator', () => {
  it('renders without throwing and shows the heading', async () => {
    render(<RetirementCalculator onBack={noop} />);
    await waitFor(() => {
      expect(screen.getByText('Retirement Planning Calculator')).toBeTruthy();
    });
  });

  it('shows the Back to Tools button', async () => {
    render(<RetirementCalculator onBack={noop} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to tools/i })).toBeTruthy();
    });
  });

  it('shows the Recalculate and Export PDF buttons', async () => {
    render(<RetirementCalculator onBack={noop} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recalculate/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /export pdf/i })).toBeTruthy();
    });
  });
});
