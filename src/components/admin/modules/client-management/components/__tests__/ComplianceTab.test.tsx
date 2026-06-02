/**
 * ComplianceTab — Render / Characterization Test (Phase 4)
 * =========================================================
 *
 * Locks the registration-gate screen (shown when a client is not yet
 * registered with Beeswax/Honeycomb) and the basic sub-tab structure (shown
 * once registered) for ComplianceTab — a 1,723-line Phase 6 decomposition
 * target. A regression introduced during the extraction (dropped api call,
 * missing sub-tab registration, broken gate) fails CI.
 *
 * Mocks:
 *   • @/utils/api — prevents real HTTP; drives the registration state.
 *   • @/components/admin/modules/client-management/api — makes
 *     getClientProfileQueryOptions resolvable with a null profile.
 *   • The nine heavy compliance sub-panels (IdentityVerificationPanel, etc.)
 *     are NOT mocked: they don't mount in the unregistered state so their
 *     imports are evaluated but no component renders. If a future import-time
 *     side-effect breaks this, add stubs then.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithQueryClient } from '@/test/utils';
import type { Client } from '@/components/admin/modules/client-management/types';

// ── Hoist mock factories before any imports execute ──────────────────────────
const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('@/utils/api', () => ({
  api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  APIError: class APIError extends Error {},
}));

vi.mock('@/components/admin/modules/client-management/api', () => ({
  getClientProfileQueryOptions: (clientId: string) => ({
    queryKey: ['client-profile', clientId],
    queryFn: async () => null,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { ComplianceTab } from '../ComplianceTab';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const selectedClient: Client = {
  id: 'client-1',
  firstName: 'Test',
  lastName: 'Client',
  email: 'test@example.com',
  accountStatus: 'approved',
  preferredName: 'Test',
  createdAt: '2024-01-01T00:00:00.000Z',
  applicationStatus: 'approved',
  accountType: 'personal',
  deleted: false,
  suspended: false,
};

function renderCompliance() {
  return renderWithQueryClient(
    <ComplianceTab
      selectedClient={selectedClient}
      sanctionsScreeningRunning={false}
      onRunSanctionsScreening={vi.fn()}
      lastSanctionsCheck=""
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: registration check returns unregistered client.
  mockApiGet.mockResolvedValue({ registered: false });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ComplianceTab — unregistered state', () => {
  it('shows the registration gate once the status check resolves as unregistered', async () => {
    renderCompliance();

    await waitFor(() => {
      expect(screen.getByText('Registration Required')).toBeTruthy();
    });
  });

  it('renders the "Register Client on Beeswax" CTA button', async () => {
    renderCompliance();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Register Client on Beeswax/i })).toBeTruthy();
    });
  });

  it('calls the correct registration-status endpoint for the selected client', async () => {
    renderCompliance();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/integrations/honeycomb/status/client-1'),
      );
    });
  });
});

describe('ComplianceTab — registered state', () => {
  beforeEach(() => {
    // Override: client is already registered.
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/status/'))
        return Promise.resolve({ registered: true, honeycombId: 'hc-123' });
      if (url.includes('/activity/')) return Promise.resolve({ activity: [] });
      return Promise.resolve({});
    });
  });

  it('renders the sub-tab navigation once the client is registered', async () => {
    renderCompliance();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /overview/i })).toBeTruthy();
    });
  });

  it('shows the Identity Verification sub-tab button', async () => {
    renderCompliance();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /identity verification/i })).toBeTruthy();
    });
  });
});
