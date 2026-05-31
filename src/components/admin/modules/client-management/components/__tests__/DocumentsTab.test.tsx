/**
 * DocumentsTab — Render / Characterization Test (Phase 4)
 * =======================================================
 *
 * Locks the baseline render + data-fetch contract of DocumentsTab (1,885 lines,
 * a Phase 6 decomposition target) so a regression during extraction fails CI.
 *
 * Notes:
 *   • react-quill-new is stubbed — it only renders inside closed dialogs here,
 *     but the real Quill touches DOM APIs jsdom doesn't fully implement.
 *   • useAuth is mocked (no AuthProvider needed).
 *   • The centralized `api` client is mocked (Phase 6a routed the component's
 *     raw, anon-key fetches through it); we assert it fetches the client's
 *     documents on mount.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('react-quill-new', () => ({
  default: () => <textarea data-testid="react-quill-stub" />,
}));

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@test.co' } }),
}));

vi.mock('@/utils/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ documents: [] }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  APIError: class APIError extends Error {},
}));

import { DocumentsTab } from '@/components/admin/modules/client-management/components/DocumentsTab';
import { api } from '@/utils/api';

const selectedClient = {
  id: 'client-1',
  firstName: 'Test',
  lastName: 'Client',
  email: 'test@example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DocumentsTab', () => {
  it('renders the Document Management view and fetches documents for the client', async () => {
    render(<DocumentsTab selectedClient={selectedClient} />);

    expect(screen.getByText('Document Management')).toBeTruthy();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/documents/client-1'));
    });
  });

  it('shows the empty state when the client has no documents', async () => {
    render(<DocumentsTab selectedClient={selectedClient} />);

    await waitFor(() => {
      expect(screen.getByText(/No documents yet/i)).toBeTruthy();
    });
  });

  it('shows a guard message when no client is selected', () => {
    render(<DocumentsTab selectedClient={undefined as unknown as typeof selectedClient} />);
    expect(screen.getByText(/Select a client to view their documents/i)).toBeTruthy();
  });
});
