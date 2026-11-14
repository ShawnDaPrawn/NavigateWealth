/**
 * LegalDocumentsManager — Render / Characterization Test (Phase 4)
 * ===============================================================
 *
 * Locks the baseline render + data-fetch contract of LegalDocumentsManager
 * (1,321 lines — a Phase 6 decomposition target) so a regression during the
 * eventual extraction fails CI.
 *
 * Contract pinned here:
 *   • renders the migration counters;
 *   • fetches the document list on mount via resourcesApi.getLegalDocuments();
 *   • lists each document grouped, with search;
 *   • a document opens as a page of its own (?legalDoc=<slug>), with a
 *     not-found state.
 *
 * The detail query is left pending (queryFn never resolves) so the detail panel
 * renders its loading skeleton rather than the heavy DetailShell/DraftEditor —
 * keeping this a focused, fast render contract. RichTextEditor and the PDF
 * dialog are stubbed (they only mount inside DetailShell, and pull DOM-/PDF-
 * heavy deps); sonner is stubbed.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  LegalDocumentDefinitionResponse,
  LegalDocumentDetailResponse,
} from '@/components/admin/modules/resources/types';

const { getLegalDocuments, getLegalDocument, migratePriorityLegalDocuments } = vi.hoisted(() => ({
  getLegalDocuments: vi.fn(),
  // Never resolves → detail query stays in its loading state (skeleton),
  // so the heavy DetailShell never mounts.
  getLegalDocument: vi.fn(() => new Promise<LegalDocumentDetailResponse>(() => {})),
  migratePriorityLegalDocuments: vi.fn(),
}));

vi.mock('@/components/admin/modules/resources/api', () => ({
  resourcesApi: { getLegalDocuments, getLegalDocument, migratePriorityLegalDocuments },
}));

vi.mock('@/components/admin/modules/publications/RichTextEditor', () => ({
  RichTextEditor: () => <div data-testid="rich-text-editor-stub" />,
}));

vi.mock('@/components/shared/LegalDocumentPdfDialog', () => ({
  LegalDocumentPdfDialog: () => <div data-testid="legal-pdf-dialog-stub" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import LegalDocumentsManager from '../LegalDocumentsManager';

const DOCS: LegalDocumentDefinitionResponse[] = [
  {
    id: 'doc-1',
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    section: 'privacy-data-protection',
    description: 'How we handle personal data.',
    status: 'published',
    renderMode: 'versioned_document',
    currentPublishedVersionId: 'v-1',
    currentDraftVersionId: null,
    legacyResourceId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'doc-2',
    slug: 'terms-of-use',
    title: 'Terms of Use',
    section: 'legal-notices',
    description: 'The terms governing use of the platform.',
    status: 'draft',
    renderMode: 'legacy_resource',
    currentPublishedVersionId: null,
    currentDraftVersionId: null,
    legacyResourceId: 'legacy-2',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
  },
];

function renderWithClient(initial = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <QueryClientProvider client={queryClient}>
        <LegalDocumentsManager />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getLegalDocuments.mockResolvedValue(DOCS);
  getLegalDocument.mockImplementation(() => new Promise<LegalDocumentDetailResponse>(() => {}));
});

describe('LegalDocumentsManager', () => {
  it('renders the migration counters', async () => {
    renderWithClient();
    expect(screen.getByText('Versioned')).toBeTruthy();
    expect(screen.getByText('Draft ready')).toBeTruthy();
    expect(screen.getByText('Priority remaining')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Privacy Policy')).toBeTruthy());
  });

  it('fetches the document list on mount and lists each document', async () => {
    renderWithClient();

    await waitFor(() => {
      expect(getLegalDocuments).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
      expect(screen.getByText('Terms of Use')).toBeTruthy();
    });
    // No document opens until one is chosen.
    expect(getLegalDocument).not.toHaveBeenCalled();
  });

  it('filters the list by search', async () => {
    renderWithClient();
    await waitFor(() => expect(screen.getByText('Privacy Policy')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Search legal documents'), {
      target: { value: 'terms' },
    });
    expect(screen.queryByText('Privacy Policy')).toBeNull();
    expect(screen.getByText('Terms of Use')).toBeTruthy();
  });

  it('opens a document as a page with a back link', async () => {
    renderWithClient();
    await waitFor(() => expect(screen.getByText('Terms of Use')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Open Terms of Use' }));

    await waitFor(() => expect(getLegalDocument).toHaveBeenCalledWith('terms-of-use'));
    expect(screen.getByRole('button', { name: /Legal documents/ })).toBeTruthy();
    expect(screen.queryByText('Privacy Policy')).toBeNull();
  });

  it('opens the document named in the address', async () => {
    renderWithClient('/?legalDoc=privacy-policy');
    await waitFor(() => expect(getLegalDocument).toHaveBeenCalledWith('privacy-policy'));
  });

  it('says so when the linked document does not exist', async () => {
    getLegalDocument.mockRejectedValue(new Error('Not found'));
    renderWithClient('/?legalDoc=gone');
    expect(await screen.findByText('Legal document not found')).toBeTruthy();
  });
});

describe('LegalDocumentsManager — failed list load', () => {
  it('shows "Unable to load legal documents", not an empty list', async () => {
    getLegalDocuments.mockRejectedValue(new Error('Request failed (400)'));
    renderWithClient();
    expect(await screen.findByText('Unable to load legal documents')).toBeTruthy();
    expect(screen.queryByText('No legal documents match your search.')).toBeNull();
  });
});

describe('LegalDocumentsManager — failed document load', () => {
  it('a failed load is "Unable to load", not "not found"', async () => {
    getLegalDocument.mockRejectedValue(new Error('Request failed (400)'));
    renderWithClient('/?legalDoc=privacy-policy');
    expect(await screen.findByText('Unable to load this legal document')).toBeTruthy();
    expect(screen.queryByText('Legal document not found')).toBeNull();
  });
});
