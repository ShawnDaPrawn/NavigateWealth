/**
 * DocumentSummaryTimeline — the permission boundary and the timeline read.
 * ========================================================================
 *
 * The thing worth pinning here is WHO can rewrite a summary. The server is the
 * authority (`canEdit`, super admin only) and the component must not second-
 * guess it in either direction: no edit affordance when the server says no, and
 * no hiding the affordance when it says yes. A UI that renders the edit button
 * for an ordinary admin invites a 403 they cannot understand; one that hides it
 * from a super admin makes the feature look broken.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  APIError: class APIError extends Error {},
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

import { DocumentSummaryTimeline } from '@/components/admin/modules/client-management/components/DocumentSummaryTimeline';
import { api } from '@/utils/api';
import type { DocumentSummary } from '@/components/admin/modules/client-management/components/documents/summaryTypes';

function makeSummary(over: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 'pack_pack_1',
    clientId: 'client-1',
    scope: 'pack',
    packId: 'pack_1',
    title: 'Onboarding documents',
    documentDate: '2026-01-30T00:00:00.000Z',
    documents: [
      { id: 'doc_1', title: 'FNA', productCategory: 'General', analysed: true },
      { id: 'doc_2', title: 'Schedule', productCategory: 'Life', analysed: false },
    ],
    documentCount: 2,
    productCategories: ['General', 'Life'],
    headline: 'Onboarding pack filed and FNA completed',
    summary: 'The client was onboarded and a financial needs analysis was captured.',
    highlights: ['FNA completed 30 Jan 2026'],
    followUps: ['Medical aid comparison still outstanding'],
    status: 'generated',
    source: 'scheduled',
    model: 'gpt-4o',
    generatedAt: '2026-02-01T00:00:00.000Z',
    generatedBy: 'scheduled',
    edited: false,
    ...over,
  };
}

function respondWith(payload: Record<string, unknown>) {
  vi.mocked(api.get).mockResolvedValue({
    success: true,
    summaries: [],
    batches: [],
    canEdit: false,
    canGenerate: false,
    ...payload,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  respondWith({});
});

describe('DocumentSummaryTimeline', () => {
  it('fetches the client timeline on mount', async () => {
    render(<DocumentSummaryTimeline clientId="client-1" />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/client-document-summaries/client-1');
    });
  });

  it('renders a summary entry with its highlights and follow-ups', async () => {
    respondWith({ summaries: [makeSummary()] });

    render(<DocumentSummaryTimeline clientId="client-1" />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding pack filed and FNA completed')).toBeTruthy();
    });
    expect(screen.getByText('FNA completed 30 Jan 2026')).toBeTruthy();
    expect(screen.getByText('Medical aid comparison still outstanding')).toBeTruthy();
    // Month heading — the timeline is grouped, not a flat list.
    expect(screen.getByText('January 2026')).toBeTruthy();
  });

  it('says when the AI only read some of the batch', async () => {
    // One of the two documents was metadata-only. Claiming full coverage would
    // make the summary look more authoritative than it is.
    respondWith({ summaries: [makeSummary()] });

    render(<DocumentSummaryTimeline clientId="client-1" />);

    await waitFor(() => {
      expect(screen.getByText(/1 of 2 files read by the AI/i)).toBeTruthy();
    });
  });

  it('hides the edit affordance when the server says the user may not edit', async () => {
    respondWith({ summaries: [makeSummary()], canEdit: false });

    render(<DocumentSummaryTimeline clientId="client-1" />);
    await waitFor(() => expect(screen.getByText(/Onboarding pack filed/)).toBeTruthy());

    expect(screen.queryByTitle('Edit summary')).toBeNull();
    expect(screen.queryByTitle('Delete summary')).toBeNull();
  });

  it('lets a super admin edit and saves through PATCH', async () => {
    respondWith({ summaries: [makeSummary()], canEdit: true });
    vi.mocked(api.patch).mockResolvedValue({
      success: true,
      summary: makeSummary({ summary: 'Corrected.', edited: true, status: 'edited' }),
    });

    render(<DocumentSummaryTimeline clientId="client-1" />);
    await waitFor(() => expect(screen.getByTitle('Edit summary')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Edit summary'));
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Corrected.' } });
    fireEvent.click(screen.getByRole('button', { name: /save summary/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        '/client-document-summaries/client-1/pack_pack_1',
        expect.objectContaining({ summary: 'Corrected.' }),
      );
    });
  });

  it('offers to summarise batches that have none yet', async () => {
    respondWith({
      canGenerate: true,
      batches: [
        {
          key: 'pack_pack_2',
          scope: 'pack',
          packId: 'pack_2',
          title: 'Shawn Test',
          documentDate: '2026-05-13T00:00:00.000Z',
          documentCount: 2,
          hasSummary: false,
        },
      ],
    });
    vi.mocked(api.post).mockResolvedValue({
      success: true,
      created: true,
      summary: makeSummary({ id: 'pack_pack_2', title: 'Shawn Test' }),
    });

    render(<DocumentSummaryTimeline clientId="client-1" />);
    await waitFor(() => expect(screen.getByText(/has not\s+been summarised yet/i)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /^summarise$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/client-document-summaries/client-1/generate', {
        packId: 'pack_2',
        force: false,
      });
    });
  });

  it('does not offer generation to a caller the server did not authorise', async () => {
    // A client viewing their own documents may read the timeline but must not
    // be able to spend the practice's AI budget on it.
    respondWith({
      canGenerate: false,
      batches: [
        {
          key: 'doc_doc_9',
          scope: 'document',
          title: 'Consent form',
          documentDate: '2026-05-25T00:00:00.000Z',
          documentCount: 1,
          hasSummary: false,
        },
      ],
    });

    render(<DocumentSummaryTimeline clientId="client-1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: /summarise/i })).toBeNull();
  });

  it('lets ordinary staff retry a FAILED summary, without force', async () => {
    // Retrying a failure is finishing work that did not complete, not
    // overwriting a human's wording — so it must not need super admin, and the
    // request must not carry `force` (which the server rejects for non-super
    // admins, making the failure permanent).
    respondWith({
      canEdit: false,
      canGenerate: true,
      summaries: [makeSummary({ status: 'failed', error: 'OpenAI request failed (429)' })],
    });
    vi.mocked(api.post).mockResolvedValue({
      success: true,
      created: true,
      summary: makeSummary(),
    });

    render(<DocumentSummaryTimeline clientId="client-1" />);
    await waitFor(() => expect(screen.getByTitle('Retry this summary')).toBeTruthy());
    // Editing stays super admin only even on a failed entry.
    expect(screen.queryByTitle('Edit summary')).toBeNull();

    fireEvent.click(screen.getByTitle('Retry this summary'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/client-document-summaries/client-1/generate', {
        packId: 'pack_1',
        force: false,
      });
    });
  });

  it('does not offer a retry on a failed summary to someone who cannot generate', async () => {
    respondWith({
      canEdit: false,
      canGenerate: false,
      summaries: [makeSummary({ status: 'failed' })],
    });

    render(<DocumentSummaryTimeline clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Failed')).toBeTruthy());

    expect(screen.queryByTitle('Retry this summary')).toBeNull();
  });

  it('regenerating a summary that WORKED still forces, and stays super admin only', async () => {
    respondWith({ canEdit: true, canGenerate: true, summaries: [makeSummary()] });
    vi.mocked(api.post).mockResolvedValue({
      success: true,
      created: true,
      summary: makeSummary(),
    });

    render(<DocumentSummaryTimeline clientId="client-1" />);
    await waitFor(() => expect(screen.getByTitle('Regenerate this summary')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Regenerate this summary'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/client-document-summaries/client-1/generate', {
        packId: 'pack_1',
        force: true,
      });
    });
  });

  it('shows a failed summary as failed rather than as fact', async () => {
    respondWith({
      summaries: [
        makeSummary({
          status: 'failed',
          headline: 'Summary unavailable — Onboarding documents',
          error: 'OpenAI request failed (429)',
        }),
      ],
    });

    render(<DocumentSummaryTimeline clientId="client-1" />);

    await waitFor(() => expect(screen.getByText('Failed')).toBeTruthy());
    expect(screen.getByText(/OpenAI request failed \(429\)/)).toBeTruthy();
  });
});
