import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocumentManagement } from '../useDocumentManagement';
import type { EsignField } from '../../types';
import type { EnvelopeDocumentRef } from '../../api';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'sonner';

const mockListEnvelopeDocuments = vi.fn();
const mockAddEnvelopeDocument = vi.fn();
const mockRemoveEnvelopeDocument = vi.fn();

vi.mock('../../api', () => ({
  esignApi: {
    listEnvelopeDocuments: (...args: unknown[]) => mockListEnvelopeDocuments(...args),
    addEnvelopeDocument: (...args: unknown[]) => mockAddEnvelopeDocument(...args),
    removeEnvelopeDocument: (...args: unknown[]) => mockRemoveEnvelopeDocument(...args),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makeDoc = (
  document_id: string,
  url = `https://example.com/${document_id}.pdf`,
): EnvelopeDocumentRef => ({
  document_id,
  order: 0,
  url,
  display_name: `Doc ${document_id}`,
  page_count: 1,
});

const f = (id: string, document_id?: string): EsignField =>
  ({ id, document_id }) as unknown as EsignField;

type Props = Parameters<typeof useDocumentManagement>[0];

function makeProps(over: Partial<Props> = {}): Props {
  return {
    envelopeId: 'env-1',
    envelopeStatus: 'draft',
    initialDocumentId: 'doc-1',
    initialDocumentUrl: undefined,
    envelopeDocumentUrl: undefined,
    envelopeDocumentUrlLegacy: undefined,
    envelopePrimaryDocumentId: undefined,
    fields: [],
    setFields: vi.fn(),
    ...over,
  };
}

describe('useDocumentManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEnvelopeDocuments.mockResolvedValue({ documents: [makeDoc('doc-1')] });
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('initialises with correct default state', () => {
    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    expect(result.current.activeDocumentId).toBe('doc-1');
    expect(result.current.docsLoading).toBe(true); // loading starts immediately
    expect(result.current.addingDoc).toBe(false);
    expect(result.current.envelopeDocuments).toEqual([]);
  });

  // ── useEffect / listEnvelopeDocuments ─────────────────────────────────────

  it('fetches envelope documents on mount', async () => {
    const docs = [makeDoc('doc-1'), makeDoc('doc-2')];
    mockListEnvelopeDocuments.mockResolvedValue({ documents: docs });

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    expect(mockListEnvelopeDocuments).toHaveBeenCalledWith('env-1');
    expect(result.current.envelopeDocuments).toEqual(docs);
  });

  it('keeps activeDocumentId when it appears in fetched documents', async () => {
    const docs = [makeDoc('doc-1'), makeDoc('doc-2')];
    mockListEnvelopeDocuments.mockResolvedValue({ documents: docs });

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({ initialDocumentId: 'doc-1' }),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));
    expect(result.current.activeDocumentId).toBe('doc-1');
  });

  it('resets activeDocumentId to first doc when initial id not in fetched list', async () => {
    const docs = [makeDoc('doc-99')];
    mockListEnvelopeDocuments.mockResolvedValue({ documents: docs });

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({ initialDocumentId: 'doc-1' }),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));
    expect(result.current.activeDocumentId).toBe('doc-99');
  });

  it('does not crash when listEnvelopeDocuments throws (falls back gracefully)', async () => {
    mockListEnvelopeDocuments.mockRejectedValue(new Error('network error'));

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));
    // envelopeDocuments stays empty — no crash
    expect(result.current.envelopeDocuments).toEqual([]);
  });

  // ── activeDocumentUrl memo ─────────────────────────────────────────────────

  it('resolves activeDocumentUrl from the fetched list', async () => {
    const docs = [makeDoc('doc-1', 'https://cdn.example.com/doc-1.pdf')];
    mockListEnvelopeDocuments.mockResolvedValue({ documents: docs });

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));
    expect(result.current.activeDocumentUrl).toBe('https://cdn.example.com/doc-1.pdf');
  });

  it('falls back to initialDocumentUrl when list is empty', async () => {
    mockListEnvelopeDocuments.mockResolvedValue({ documents: [] });

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({ initialDocumentUrl: 'https://fallback.example.com/doc.pdf' }),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));
    expect(result.current.activeDocumentUrl).toBe('https://fallback.example.com/doc.pdf');
  });

  it('falls back to envelopeDocumentUrlLegacy as last resort', () => {
    // Don't resolve the list — we're testing the initial memo before fetch completes
    mockListEnvelopeDocuments.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({
        envelopeDocumentUrlLegacy: 'https://legacy.example.com/doc.pdf',
      }),
    });

    expect(result.current.activeDocumentUrl).toBe('https://legacy.example.com/doc.pdf');
  });

  // ── fieldCountsByDocument memo ─────────────────────────────────────────────

  it('counts fields per document', () => {
    mockListEnvelopeDocuments.mockReturnValue(new Promise(() => {}));

    const fields = [f('f1', 'doc-1'), f('f2', 'doc-1'), f('f3', 'doc-2')];
    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({ fields }),
    });

    expect(result.current.fieldCountsByDocument).toEqual({ 'doc-1': 2, 'doc-2': 1 });
  });

  it('falls back to envelopePrimaryDocumentId for fields without document_id', () => {
    mockListEnvelopeDocuments.mockReturnValue(new Promise(() => {}));

    const fields = [f('f1'), f('f2')]; // no document_id
    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({ fields, envelopePrimaryDocumentId: 'doc-primary' }),
    });

    expect(result.current.fieldCountsByDocument).toEqual({ 'doc-primary': 2 });
  });

  // ── handleAddDocument ──────────────────────────────────────────────────────

  it('toasts error when envelope is not a draft', async () => {
    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({ envelopeStatus: 'sent' }),
    });

    await act(async () => {
      await result.current.handleAddDocument(new File(['x'], 'test.pdf'));
    });

    expect(toast.error).toHaveBeenCalledWith('Only draft envelopes can have documents added');
    expect(mockAddEnvelopeDocument).not.toHaveBeenCalled();
  });

  it('uploads a document, updates list, and sets activeDocumentId', async () => {
    await waitFor(() => {}); // let initial fetch settle first
    const newDoc = makeDoc('doc-new');
    const updatedDocs = [makeDoc('doc-1'), newDoc];
    mockAddEnvelopeDocument.mockResolvedValue({
      documents: updatedDocs,
      added: { document_id: 'doc-new', page_count: 3 },
    });

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    const file = new File(['content'], 'new-doc.pdf', { type: 'application/pdf' });
    await act(async () => {
      await result.current.handleAddDocument(file);
    });

    expect(mockAddEnvelopeDocument).toHaveBeenCalledWith('env-1', file, expect.any(Object));
    expect(result.current.envelopeDocuments).toEqual(updatedDocs);
    expect(result.current.activeDocumentId).toBe('doc-new');
    expect(toast.success).toHaveBeenCalledWith('Added new-doc.pdf');
  });

  it('shows error toast when addEnvelopeDocument throws', async () => {
    mockAddEnvelopeDocument.mockRejectedValue(new Error('Upload failed'));

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    await act(async () => {
      await result.current.handleAddDocument(new File(['x'], 'bad.pdf'));
    });

    expect(toast.error).toHaveBeenCalledWith('Upload failed');
    expect(result.current.addingDoc).toBe(false);
  });

  // ── handleRemoveDocument ───────────────────────────────────────────────────

  it('toasts error when trying to remove the last document', async () => {
    mockListEnvelopeDocuments.mockResolvedValue({ documents: [makeDoc('doc-1')] });

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      await result.current.handleRemoveDocument('doc-1');
    });

    expect(toast.error).toHaveBeenCalledWith('An envelope must have at least one document');
    expect(mockRemoveEnvelopeDocument).not.toHaveBeenCalled();
  });

  it('removes a document after confirm, filters fields, and updates active doc', async () => {
    const docs = [makeDoc('doc-1'), makeDoc('doc-2')];
    mockListEnvelopeDocuments.mockResolvedValue({ documents: docs });
    mockRemoveEnvelopeDocument.mockResolvedValue({ documents: [makeDoc('doc-1')] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const setFields = vi.fn();
    const fields = [f('f1', 'doc-2'), f('f2', 'doc-1')];

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps({ fields, setFields }),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    await act(async () => {
      await result.current.handleRemoveDocument('doc-2');
    });

    expect(mockRemoveEnvelopeDocument).toHaveBeenCalledWith('env-1', 'doc-2');
    expect(setFields).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Document removed');
  });

  it('does nothing when user cancels confirm dialog', async () => {
    const docs = [makeDoc('doc-1'), makeDoc('doc-2')];
    mockListEnvelopeDocuments.mockResolvedValue({ documents: docs });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    await act(async () => {
      await result.current.handleRemoveDocument('doc-2');
    });

    expect(mockRemoveEnvelopeDocument).not.toHaveBeenCalled();
  });

  it('shows error toast when removeEnvelopeDocument throws', async () => {
    const docs = [makeDoc('doc-1'), makeDoc('doc-2')];
    mockListEnvelopeDocuments.mockResolvedValue({ documents: docs });
    mockRemoveEnvelopeDocument.mockRejectedValue(new Error('Remove failed'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    await act(async () => {
      await result.current.handleRemoveDocument('doc-2');
    });

    expect(toast.error).toHaveBeenCalledWith('Remove failed');
  });

  // ── setActiveDocumentId exposed ────────────────────────────────────────────

  it('exposes setActiveDocumentId and addDocInputRef', async () => {
    const { result } = renderHook((p: Props) => useDocumentManagement(p), {
      initialProps: makeProps(),
    });

    await waitFor(() => expect(result.current.docsLoading).toBe(false));

    act(() => {
      result.current.setActiveDocumentId('doc-99');
    });

    expect(result.current.activeDocumentId).toBe('doc-99');
    expect(result.current.addDocInputRef).toBeDefined();
  });
});
