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
 *   • useAuth is mocked (no AuthProvider needed); the component uses a raw
 *     fetch (no react-query), so global.fetch is stubbed to an empty list.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('react-quill-new', () => ({
  default: () => <textarea data-testid="react-quill-stub" />,
}));

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@test.co' } }),
}));

import { DocumentsTab } from '@/components/admin/modules/client-management/components/DocumentsTab';

const selectedClient = {
  id: 'client-1',
  firstName: 'Test',
  lastName: 'Client',
  email: 'test@example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ documents: [] }),
  }) as unknown as typeof fetch;
});

describe('DocumentsTab', () => {
  it('renders the Document Management view and fetches documents for the client', async () => {
    render(<DocumentsTab selectedClient={selectedClient} />);

    expect(screen.getByText('Document Management')).toBeTruthy();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/documents/client-1'),
        expect.objectContaining({ headers: expect.any(Object) }),
      );
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
