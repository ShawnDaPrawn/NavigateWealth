/**
 * DocumentsTab — Render / Characterization Test (Phase 4)
 * =======================================================
 *
 * Locks the render + data-fetch + filter behavior of DocumentsTab (a Phase 6
 * decomposition target, now split into DocumentStatsCards / DocumentFiltersBar /
 * DocumentList / *Dialog sub-components). Rendering WITH documents exercises
 * those extracted children transitively, so a regression during/after the split
 * fails CI.
 *
 * Notes:
 *   • react-quill-new is stubbed — it only renders inside closed dialogs here,
 *     but the real Quill touches DOM APIs jsdom doesn't fully implement.
 *   • useAuth is mocked (no AuthProvider needed).
 *   • The centralized `api` client is mocked (Phase 6a routed the component's
 *     raw, anon-key fetches through it); we assert it fetches the client's
 *     documents on mount.
 *   • The tab now renders TWO api.get consumers — the document list and the AI
 *     summary timeline — and child effects run before parent effects, so a
 *     `mockResolvedValueOnce` would be consumed by whichever fires first. The
 *     mock is therefore routed BY ENDPOINT (`mockDocuments` below) rather than
 *     by call order; order-based stubbing here is a trap, not a shortcut.
 *   • The category filter is a Radix Select (unreliable under jsdom pointer
 *     events), so filtering is exercised via the plain search input instead.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { ReactElement } from 'react';

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}
function render(ui: ReactElement, url = '/') {
  return rtlRender(
    <MemoryRouter initialEntries={[url]}>
      {ui}
      <Location />
    </MemoryRouter>,
  );
}

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
import type { DocumentItem } from '@/components/admin/modules/client-management/components/documentsUtils';

const selectedClient = {
  id: 'client-1',
  firstName: 'Test',
  lastName: 'Client',
  email: 'test@example.com',
};

function makeDoc(over: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'doc-1',
    userId: 'client-1',
    type: 'document',
    title: 'Policy Schedule',
    uploadDate: '2024-06-01T00:00:00.000Z',
    productCategory: 'Life',
    policyNumber: 'POL-1',
    status: 'viewed',
    isFavourite: false,
    uploadedBy: 'admin-1',
    fileName: 'policy.pdf',
    fileSize: 1024,
    ...over,
  };
}

/**
 * Route the mocked api.get by path: documents to the list, everything else
 * (the summary timeline) to an empty timeline.
 */
function mockDocuments(documents: DocumentItem[]) {
  vi.mocked(api.get).mockImplementation(async (endpoint: string) => {
    if (endpoint.includes('client-document-summaries')) {
      return { success: true, summaries: [], batches: [], canEdit: false, canGenerate: false };
    }
    return { documents };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks drops implementations too, so re-establish the default:
  // an empty document list and an empty timeline.
  mockDocuments([]);
});

describe('DocumentsTab', () => {
  it('renders the Documents & links view and fetches documents for the client', async () => {
    render(<DocumentsTab selectedClient={selectedClient} />);

    expect(screen.getByRole('tab', { name: /Documents & links/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add document or link' })).toBeTruthy();

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

  it('renders fetched documents in the list', async () => {
    mockDocuments([
      makeDoc({ id: 'a', title: 'Policy Schedule' }),
      makeDoc({
        id: 'b',
        title: 'ID Copy',
        productCategory: 'General',
        policyNumber: 'GEN-2',
        fileName: 'id.pdf',
      }),
    ]);

    render(<DocumentsTab selectedClient={selectedClient} />);

    await waitFor(() => {
      expect(screen.getByText('Policy Schedule')).toBeTruthy();
      expect(screen.getByText('ID Copy')).toBeTruthy();
    });
  });

  it('filters the rendered list by the search query', async () => {
    mockDocuments([
      makeDoc({ id: 'a', title: 'Policy Schedule', fileName: 'policy.pdf' }),
      makeDoc({ id: 'b', title: 'ID Copy', fileName: 'id.pdf', policyNumber: 'GEN-2' }),
    ]);

    render(<DocumentsTab selectedClient={selectedClient} />);
    await waitFor(() => expect(screen.getByText('ID Copy')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText(/search by title/i), {
      target: { value: 'policy' },
    });

    await waitFor(() => {
      expect(screen.queryByText('ID Copy')).toBeNull();
    });
    expect(screen.getByText('Policy Schedule')).toBeTruthy();
    // DocumentList shows a "(Showing X of Y)" count once a filter narrows the set.
    expect(screen.getByText(/showing 1 of 2/i)).toBeTruthy();
  });

  it('re-fetches when Refresh is clicked', async () => {
    render(<DocumentsTab selectedClient={selectedClient} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const before = vi.mocked(api.get).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh documents' }));

    await waitFor(() => {
      expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('shows the activity timeline as a second view kept in the address', async () => {
    render(<DocumentsTab selectedClient={selectedClient} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity timeline' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?dview=timeline'));
    expect(screen.queryByRole('button', { name: 'Add document or link' })).toBeNull();
  });

  it('offers Email documents to client only when there are documents', async () => {
    render(<DocumentsTab selectedClient={selectedClient} />);
    const email = screen.getByRole('button', { name: 'Email documents to client' });
    expect((email as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets the adviser choose which documents to email, and requires one', async () => {
    mockDocuments([makeDoc(), makeDoc({ id: 'doc-2', title: 'ID Copy' })]);
    render(<DocumentsTab selectedClient={selectedClient} />);
    await waitFor(() => expect(screen.getByText('ID Copy')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Email documents to client' }));
    expect(await screen.findByText('Documents to attach')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    expect(await screen.findByText('Choose at least one document to attach')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/ID Copy/));
    expect(screen.queryByText('Choose at least one document to attach')).toBeNull();
  });
});
