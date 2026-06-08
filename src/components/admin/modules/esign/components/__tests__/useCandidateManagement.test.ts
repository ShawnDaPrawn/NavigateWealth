import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCandidateManagement, type Candidate } from '../useCandidateManagement';
import type { EsignField, SignerFormData } from '../../types';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
import { toast } from 'sonner';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makeCandidate = (id: string): Candidate =>
  ({
    id,
    type: 'signature',
    page: 1,
    x: 10,
    y: 20,
    width: 100,
    height: 40,
    required: true,
    source: 'pdf',
    label: `Label ${id}`,
    metadata: {},
  }) as unknown as Candidate;

const makeSigner = (email: string): SignerFormData =>
  ({ email, name: email }) as unknown as SignerFormData;

const f = (id: string): EsignField => ({ id }) as unknown as EsignField;

type Props = Parameters<typeof useCandidateManagement>[0];

function makeProps(over: Partial<Props> = {}): Props {
  return {
    envelopeId: 'env-1',
    initialCandidates: [],
    autoPopulateSuggestedFields: false,
    fields: [],
    pushToHistory: vi.fn(),
    selectedSignerId: undefined,
    eligibleSigners: [makeSigner('signer@example.com')],
    buildFieldsFromCandidates: vi.fn().mockReturnValue([]),
    ...over,
  };
}

describe('useCandidateManagement', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Initial state ──────────────────────────────────────────────────────────

  it('initialises with empty candidates when none provided', () => {
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps(),
    });

    expect(result.current.candidates).toEqual([]);
    expect(result.current.showCandidatesPanel).toBe(false);
  });

  it('shows panel when initial candidates are provided', () => {
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({ initialCandidates: [makeCandidate('c1')] }),
    });

    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.showCandidatesPanel).toBe(true);
  });

  // ── acceptCandidate ────────────────────────────────────────────────────────

  it('accepts a candidate and removes it from the list', () => {
    const pushToHistory = vi.fn();
    const fields = [f('f1')];
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1'), makeCandidate('c2')],
        fields,
        pushToHistory,
        selectedSignerId: 'signer@example.com',
      }),
    });

    act(() => {
      result.current.acceptCandidate('c1');
    });

    expect(pushToHistory).toHaveBeenCalledTimes(1);
    // The history call should include the original fields plus one new field
    const calledWith: EsignField[] = pushToHistory.mock.calls[0][0];
    expect(calledWith.length).toBe(2); // original f1 + new field
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates[0].id).toBe('c2');
  });

  it('uses first eligible signer email when no signer is selected', () => {
    const pushToHistory = vi.fn();
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        pushToHistory,
        selectedSignerId: undefined,
        eligibleSigners: [makeSigner('first@example.com')],
      }),
    });

    act(() => {
      result.current.acceptCandidate('c1');
    });

    expect(pushToHistory).toHaveBeenCalled();
    const calledWith: EsignField[] = pushToHistory.mock.calls[0][0];
    expect(calledWith[0].signer_id).toBe('first@example.com');
  });

  it('toasts error when no target signer is available', () => {
    const pushToHistory = vi.fn();
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        pushToHistory,
        selectedSignerId: undefined,
        eligibleSigners: [],
      }),
    });

    act(() => {
      result.current.acceptCandidate('c1');
    });

    expect(toast.error).toHaveBeenCalledWith('Add a recipient first.');
    expect(pushToHistory).not.toHaveBeenCalled();
  });

  it('does nothing when accepting a non-existent candidate id', () => {
    const pushToHistory = vi.fn();
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        pushToHistory,
        selectedSignerId: 'signer@example.com',
      }),
    });

    act(() => {
      result.current.acceptCandidate('non-existent');
    });

    expect(pushToHistory).not.toHaveBeenCalled();
    expect(result.current.candidates).toHaveLength(1);
  });

  // ── acceptAllCandidates ────────────────────────────────────────────────────

  it('accepts all candidates and clears list', () => {
    const pushToHistory = vi.fn();
    const buildFieldsFromCandidates = vi.fn().mockReturnValue([f('new1'), f('new2')]);
    const fields = [f('f1')];
    const candidates = [makeCandidate('c1'), makeCandidate('c2')];

    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: candidates,
        fields,
        pushToHistory,
        selectedSignerId: 'signer@example.com',
        buildFieldsFromCandidates,
      }),
    });

    act(() => {
      result.current.acceptAllCandidates();
    });

    expect(buildFieldsFromCandidates).toHaveBeenCalledWith(candidates, 'signer@example.com');
    expect(pushToHistory).toHaveBeenCalledWith([f('f1'), f('new1'), f('new2')]);
    expect(result.current.candidates).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith('Accepted 2 suggested fields');
  });

  it('shows info toast when all fields already exist and clears candidates', () => {
    const pushToHistory = vi.fn();
    const buildFieldsFromCandidates = vi.fn().mockReturnValue([]); // all duplicates

    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        pushToHistory,
        selectedSignerId: 'signer@example.com',
        buildFieldsFromCandidates,
      }),
    });

    act(() => {
      result.current.acceptAllCandidates();
    });

    expect(toast.info).toHaveBeenCalledWith('All suggested fields already match an existing one.');
    expect(pushToHistory).not.toHaveBeenCalled();
    expect(result.current.candidates).toHaveLength(0);
  });

  it('toasts error when no signer available on acceptAll', () => {
    const pushToHistory = vi.fn();
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        pushToHistory,
        selectedSignerId: undefined,
        eligibleSigners: [],
      }),
    });

    act(() => {
      result.current.acceptAllCandidates();
    });

    expect(toast.error).toHaveBeenCalledWith('Add a recipient first.');
    expect(pushToHistory).not.toHaveBeenCalled();
  });

  it('is a no-op when acceptAll is called with empty candidates list', () => {
    const pushToHistory = vi.fn();
    const buildFieldsFromCandidates = vi.fn();

    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [],
        pushToHistory,
        selectedSignerId: 'signer@example.com',
        buildFieldsFromCandidates,
      }),
    });

    act(() => {
      result.current.acceptAllCandidates();
    });

    expect(buildFieldsFromCandidates).not.toHaveBeenCalled();
    expect(pushToHistory).not.toHaveBeenCalled();
  });

  // ── dismissCandidate / dismissAllCandidates ────────────────────────────────

  it('dismisses a single candidate', () => {
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1'), makeCandidate('c2')],
      }),
    });

    act(() => {
      result.current.dismissCandidate('c1');
    });

    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates[0].id).toBe('c2');
  });

  it('dismisses all candidates and hides the panel', () => {
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1'), makeCandidate('c2')],
      }),
    });

    act(() => {
      result.current.dismissAllCandidates();
    });

    expect(result.current.candidates).toHaveLength(0);
    expect(result.current.showCandidatesPanel).toBe(false);
  });

  // ── setShowCandidatesPanel ─────────────────────────────────────────────────

  it('exposes setShowCandidatesPanel', () => {
    const { result } = renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps(),
    });

    act(() => {
      result.current.setShowCandidatesPanel(true);
    });

    expect(result.current.showCandidatesPanel).toBe(true);
  });

  // ── autoPopulate effect ────────────────────────────────────────────────────

  it('auto-populates fields when autoPopulateSuggestedFields is true', () => {
    const pushToHistory = vi.fn();
    const buildFieldsFromCandidates = vi.fn().mockReturnValue([f('auto1')]);

    renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        autoPopulateSuggestedFields: true,
        fields: [],
        pushToHistory,
        selectedSignerId: 'signer@example.com',
        buildFieldsFromCandidates,
      }),
    });

    expect(buildFieldsFromCandidates).toHaveBeenCalled();
    expect(pushToHistory).toHaveBeenCalledWith([f('auto1')]);
    expect(toast.success).toHaveBeenCalledWith('Auto-added 1 suggested field from the PDF.');
  });

  it('does not auto-populate when autoPopulateSuggestedFields is false', () => {
    const pushToHistory = vi.fn();

    renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        autoPopulateSuggestedFields: false,
        pushToHistory,
        selectedSignerId: 'signer@example.com',
      }),
    });

    expect(pushToHistory).not.toHaveBeenCalled();
  });

  it('skips auto-populate when no target signer available', () => {
    const pushToHistory = vi.fn();

    renderHook((p: Props) => useCandidateManagement(p), {
      initialProps: makeProps({
        initialCandidates: [makeCandidate('c1')],
        autoPopulateSuggestedFields: true,
        pushToHistory,
        selectedSignerId: undefined,
        eligibleSigners: [],
      }),
    });

    expect(pushToHistory).not.toHaveBeenCalled();
  });
});
