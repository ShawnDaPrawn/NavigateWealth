/**
 * LegalDocumentsManager — Render / Characterization Test (Phase 4)
 * ===============================================================
 *
 * Locks the baseline render + data-fetch contract of LegalDocumentsManager
 * (1,321 lines — a Phase 6 decomposition target) so a regression during the
 * eventual extraction fails CI.
 *
 * Contract pinned here:
 *   • renders the "Legal Documents" header + the migration-summary panel;
 *   • fetches the document list on mount via resourcesApi.getLegalDocuments();
 *   • renders each returned document (title + status/render-mode badges) in the
 *     grouped sidebar;
 *   • auto-selects the first document and fetches its detail via
 *     resourcesApi.getLegalDocument(firstSlug) — so the right-hand panel leaves
 *     the "Select a legal document" empty state.
 *
 * The detail query is left pending (queryFn never resolves) so the detail panel
 * renders its loading skeleton rather than the heavy DetailShell/DraftEditor —
 * keeping this a focused, fast render contract. RichTextEditor and the PDF
 * dialog are stubbed (they only mount inside DetailShell, and pull DOM-/PDF-
 * heavy deps); sonner is stubbed.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/components/shared/LegalDocumentPdf', () => ({
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

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LegalDocumentsManager />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getLegalDocuments.mockResolvedValue(DOCS);
  getLegalDocument.mockImplementation(() => new Promise<LegalDocumentDetailResponse>(() => {}));
});

describe('LegalDocumentsManager', () => {
  it('renders the Legal Documents workspace header and migration summary', () => {
    renderWithClient();
    expect(screen.getByText('Legal Documents')).toBeTruthy();
    expect(screen.getByText(/Versioned:/)).toBeTruthy();
    expect(screen.getByText(/Priority remaining:/)).toBeTruthy();
  });

  it('fetches the document list on mount and renders each document in the sidebar', async () => {
    renderWithClient();

    await waitFor(() => {
      expect(getLegalDocuments).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
      expect(screen.getByText('Terms of Use')).toBeTruthy();
    });
  });

  it('auto-selects the first document and fetches its detail', async () => {
    renderWithClient();

    await waitFor(() => {
      expect(getLegalDocument).toHaveBeenCalledWith('privacy-policy');
    });

    // Auto-selection means the right panel is no longer the empty placeholder.
    expect(screen.queryByText('Select a legal document')).toBeNull();
  });
});
