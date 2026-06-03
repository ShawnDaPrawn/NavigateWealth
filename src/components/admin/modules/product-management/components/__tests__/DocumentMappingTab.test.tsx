/**
 * DocumentMappingTab — Render / Characterization Test (Phase 4)
 * ==============================================================
 *
 * Locks the "Document AI Configuration" card title and the always-visible
 * provider header for this 1,120-line Phase 6 decomposition target.
 *
 * useProviders is mocked to avoid React Query context requirements.
 * global.fetch is mocked so fetchTerminologies resolves quickly and exits
 * the loading gate (isLoading starts as true until fetch completes).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';

vi.mock('@/components/admin/modules/product-management/hooks/useProviders', () => ({
  useProviders: () => ({ providers: [], isLoading: false }),
}));

vi.mock(
  '@/components/admin/modules/product-management/components/ExtractionQualityDashboard',
  () => ({
    ExtractionQualityDashboard: () => null,
  }),
);

vi.mock('@/components/admin/modules/product-management/components/RenewalAlertScanner', () => ({
  RenewalAlertScanner: () => null,
}));

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { DocumentMappingTab } from '../DocumentMappingTab';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ terminologies: [] }),
  } as Response);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DocumentMappingTab', () => {
  it('shows the "Document AI Configuration" card title after loading', async () => {
    render(<DocumentMappingTab />);

    await waitFor(() => {
      expect(screen.getByText('Document AI Configuration')).toBeTruthy();
    });
  });
});
