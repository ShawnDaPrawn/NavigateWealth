import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import type { EsignField, SignerFormData } from '../../types';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// isEditableTarget lives in prepareFormStudioUtils — mock it so we control
// whether the target is treated as editable without depending on DOM elements.
const mockIsEditableTarget = vi.fn().mockReturnValue(false);

vi.mock('../prepareFormStudioUtils', () => ({
  isEditableTarget: (...args: unknown[]) => mockIsEditableTarget(...args),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const f = (id: string, signer_id = 'signer@example.com'): EsignField =>
  ({ id, signer_id }) as unknown as EsignField;

const makeSigner = (email: string): SignerFormData =>
  ({ email, name: email }) as unknown as SignerFormData;

type Props = Parameters<typeof useKeyboardShortcuts>[0];

function makeProps(over: Partial<Props> = {}): Props {
  return {
    selectedFieldIds: new Set<string>(),
    primarySelectedId: null,
    fields: [],
    visibleSignerIds: null,
    handleCopy: vi.fn(),
    handlePaste: vi.fn(),
    handleDuplicate: vi.fn(),
    handleBulkDelete: vi.fn(),
    persistFields: vi.fn().mockResolvedValue(true),
    eligibleSigners: [],
    clearSelection: vi.fn(),
    selectMany: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    setShowShortcuts: vi.fn(),
    setSelectedSignerId: vi.fn(),
    ...over,
  };
}

/** Fire a keydown event on the window with given options */
function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(window, { key, bubbles: true, cancelable: true, ...opts });
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEditableTarget.mockReturnValue(false);
  });

  afterEach(() => {
    // Nothing to restore — renderHook cleans up listeners via cleanup
  });

  // ── '?' — help toggle ──────────────────────────────────────────────────────

  it('toggles shortcuts help on "?" key', () => {
    const setShowShortcuts = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ setShowShortcuts }),
    });

    pressKey('?');
    expect(setShowShortcuts).toHaveBeenCalledTimes(1);
  });

  it('does not toggle shortcuts help when meta is held', () => {
    const setShowShortcuts = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ setShowShortcuts }),
    });

    pressKey('?', { metaKey: true });
    expect(setShowShortcuts).not.toHaveBeenCalled();
  });

  // ── Escape — clear selection ───────────────────────────────────────────────

  it('clears selection on Escape when fields are selected', () => {
    const clearSelection = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        selectedFieldIds: new Set(['f1']),
        clearSelection,
      }),
    });

    pressKey('Escape');
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it('does not call clearSelection when nothing is selected', () => {
    const clearSelection = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ selectedFieldIds: new Set(), clearSelection }),
    });

    pressKey('Escape');
    expect(clearSelection).not.toHaveBeenCalled();
  });

  // ── Ctrl+S — save ─────────────────────────────────────────────────────────

  it('calls persistFields on Ctrl+S', () => {
    const persistFields = vi.fn().mockResolvedValue(true);
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ persistFields }),
    });

    pressKey('s', { ctrlKey: true });
    expect(persistFields).toHaveBeenCalledTimes(1);
  });

  it('calls persistFields on Cmd+S (metaKey)', () => {
    const persistFields = vi.fn().mockResolvedValue(true);
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ persistFields }),
    });

    pressKey('s', { metaKey: true });
    expect(persistFields).toHaveBeenCalledTimes(1);
  });

  // ── Ctrl+Z — undo / Shift+Ctrl+Z — redo ───────────────────────────────────

  it('calls undo on Ctrl+Z', () => {
    const undo = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ undo }),
    });

    pressKey('z', { ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('calls redo on Shift+Ctrl+Z', () => {
    const redo = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ redo }),
    });

    pressKey('z', { ctrlKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledTimes(1);
  });

  // ── Ctrl+C — copy ─────────────────────────────────────────────────────────

  it('calls handleCopy on Ctrl+C when fields are selected', () => {
    const handleCopy = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        selectedFieldIds: new Set(['f1']),
        handleCopy,
      }),
    });

    pressKey('c', { ctrlKey: true });
    expect(handleCopy).toHaveBeenCalledTimes(1);
  });

  it('does not call handleCopy when no fields are selected', () => {
    const handleCopy = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ selectedFieldIds: new Set(), handleCopy }),
    });

    pressKey('c', { ctrlKey: true });
    expect(handleCopy).not.toHaveBeenCalled();
  });

  // ── Ctrl+V — paste ────────────────────────────────────────────────────────

  it('calls handlePaste on Ctrl+V regardless of selection', () => {
    const handlePaste = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ handlePaste }),
    });

    pressKey('v', { ctrlKey: true });
    expect(handlePaste).toHaveBeenCalledTimes(1);
  });

  // ── Ctrl+D — duplicate ────────────────────────────────────────────────────

  it('calls handleDuplicate on Ctrl+D when fields are selected', () => {
    const handleDuplicate = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        selectedFieldIds: new Set(['f1']),
        handleDuplicate,
      }),
    });

    pressKey('d', { ctrlKey: true });
    expect(handleDuplicate).toHaveBeenCalledTimes(1);
  });

  it('does not call handleDuplicate when nothing is selected', () => {
    const handleDuplicate = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ selectedFieldIds: new Set(), handleDuplicate }),
    });

    pressKey('d', { ctrlKey: true });
    expect(handleDuplicate).not.toHaveBeenCalled();
  });

  // ── Delete / Backspace ────────────────────────────────────────────────────

  it('calls handleBulkDelete on Delete when fields are selected', () => {
    const handleBulkDelete = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        selectedFieldIds: new Set(['f1']),
        handleBulkDelete,
      }),
    });

    pressKey('Delete');
    expect(handleBulkDelete).toHaveBeenCalledTimes(1);
  });

  it('calls handleBulkDelete on Backspace when fields are selected', () => {
    const handleBulkDelete = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        selectedFieldIds: new Set(['f1']),
        handleBulkDelete,
      }),
    });

    pressKey('Backspace');
    expect(handleBulkDelete).toHaveBeenCalledTimes(1);
  });

  it('does not delete when no fields are selected', () => {
    const handleBulkDelete = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ selectedFieldIds: new Set(), handleBulkDelete }),
    });

    pressKey('Delete');
    expect(handleBulkDelete).not.toHaveBeenCalled();
  });

  // ── Ctrl+A — select all ───────────────────────────────────────────────────

  it('calls selectMany with all field ids on Ctrl+A', () => {
    const selectMany = vi.fn();
    const fields = [f('f1'), f('f2'), f('f3')];
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ fields, selectMany }),
    });

    pressKey('a', { ctrlKey: true });
    expect(selectMany).toHaveBeenCalledWith(['f1', 'f2', 'f3']);
  });

  it('filters by visibleSignerIds when Ctrl+A is pressed', () => {
    const selectMany = vi.fn();
    const fields = [f('f1', 'signerA'), f('f2', 'signerB'), f('f3', 'signerA')];
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        fields,
        selectMany,
        visibleSignerIds: new Set(['signerA']),
      }),
    });

    pressKey('a', { ctrlKey: true });
    expect(selectMany).toHaveBeenCalledWith(['f1', 'f3']);
  });

  it('does not call selectMany when fields list is empty', () => {
    const selectMany = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ fields: [], selectMany }),
    });

    pressKey('a', { ctrlKey: true });
    expect(selectMany).not.toHaveBeenCalled();
  });

  // ── Number keys — jump to signer ──────────────────────────────────────────

  it('sets selected signer on number key press', () => {
    const setSelectedSignerId = vi.fn();
    const eligibleSigners = [makeSigner('signer1@example.com'), makeSigner('signer2@example.com')];
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ eligibleSigners, setSelectedSignerId }),
    });

    pressKey('1');
    expect(setSelectedSignerId).toHaveBeenCalledWith('signer1@example.com');

    pressKey('2');
    expect(setSelectedSignerId).toHaveBeenCalledWith('signer2@example.com');
  });

  it('ignores number key when index is out of range', () => {
    const setSelectedSignerId = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        eligibleSigners: [makeSigner('signer1@example.com')],
        setSelectedSignerId,
      }),
    });

    pressKey('9'); // out of range
    expect(setSelectedSignerId).not.toHaveBeenCalled();
  });

  it('ignores number keys when no eligible signers', () => {
    const setSelectedSignerId = vi.fn();
    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ eligibleSigners: [], setSelectedSignerId }),
    });

    pressKey('1');
    expect(setSelectedSignerId).not.toHaveBeenCalled();
  });

  // ── editable target guard ─────────────────────────────────────────────────

  it('ignores all keyboard shortcuts when target is editable', () => {
    mockIsEditableTarget.mockReturnValue(true);

    const handleCopy = vi.fn();
    const clearSelection = vi.fn();
    const persistFields = vi.fn();

    renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({
        selectedFieldIds: new Set(['f1']),
        handleCopy,
        clearSelection,
        persistFields,
      }),
    });

    pressKey('c', { ctrlKey: true });
    pressKey('Escape');
    pressKey('s', { ctrlKey: true });

    expect(handleCopy).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
    expect(persistFields).not.toHaveBeenCalled();
  });

  // ── cleanup ───────────────────────────────────────────────────────────────

  it('removes event listener on unmount', () => {
    const persistFields = vi.fn().mockResolvedValue(true);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook((p: Props) => useKeyboardShortcuts(p), {
      initialProps: makeProps({ persistFields }),
    });

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
