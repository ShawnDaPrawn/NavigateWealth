/**
 * Tests for useSearchInputAutofillGuard hook.
 *
 * This is a pure-React hook (useState + useCallback) — no external module
 * dependencies to mock.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchInputAutofillGuard } from '../useSearchInputAutofillGuard';
import type * as React from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultOpts = { id: 'search-input' };

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSearchInputAutofillGuard — static props', () => {
  it('returns the provided id', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard({ id: 'my-search' }));
    expect(result.current.id).toBe('my-search');
  });

  it('sets name to the same value as id', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard({ id: 'my-search' }));
    expect(result.current.name).toBe('my-search');
  });

  it('type is always "text"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.type).toBe('text');
  });

  it('inputMode is "search"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.inputMode).toBe('search');
  });

  it('enterKeyHint is "search"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.enterKeyHint).toBe('search');
  });

  it('autoComplete is "off"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.autoComplete).toBe('off');
  });

  it('autoCorrect is "off"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.autoCorrect).toBe('off');
  });

  it('autoCapitalize is "off"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.autoCapitalize).toBe('off');
  });

  it('spellCheck is false', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.spellCheck).toBe(false);
  });

  it('data-1p-ignore is "true"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current['data-1p-ignore']).toBe('true');
  });

  it('data-lpignore is "true"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current['data-lpignore']).toBe('true');
  });

  it('data-form-type is "other"', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current['data-form-type']).toBe('other');
  });
});

describe('useSearchInputAutofillGuard — ARIA props', () => {
  it('passes role through when provided', () => {
    const { result } = renderHook(() =>
      useSearchInputAutofillGuard({ id: 'search', role: 'combobox' }),
    );
    expect(result.current.role).toBe('combobox');
  });

  it('role is undefined when not provided', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.role).toBeUndefined();
  });

  it('passes aria-autocomplete through when provided', () => {
    const { result } = renderHook(() =>
      useSearchInputAutofillGuard({ id: 'search', ariaAutocomplete: 'list' }),
    );
    expect(result.current['aria-autocomplete']).toBe('list');
  });

  it('passes aria-controls through when provided', () => {
    const { result } = renderHook(() =>
      useSearchInputAutofillGuard({ id: 'search', ariaControls: 'listbox-id' }),
    );
    expect(result.current['aria-controls']).toBe('listbox-id');
  });

  it('passes aria-expanded through when provided', () => {
    const { result } = renderHook(() =>
      useSearchInputAutofillGuard({ id: 'search', ariaExpanded: true }),
    );
    expect(result.current['aria-expanded']).toBe(true);
  });
});

describe('useSearchInputAutofillGuard — readOnly guard', () => {
  it('readOnly is true on initial render', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    expect(result.current.readOnly).toBe(true);
  });

  it('readOnly becomes false after onFocus is called', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));

    act(() => {
      result.current.onFocus!({} as React.FocusEvent<HTMLInputElement>);
    });

    expect(result.current.readOnly).toBe(false);
  });

  it('readOnly stays false after a second onFocus call', () => {
    const { result } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));

    act(() => {
      result.current.onFocus!({} as React.FocusEvent<HTMLInputElement>);
    });
    act(() => {
      result.current.onFocus!({} as React.FocusEvent<HTMLInputElement>);
    });

    expect(result.current.readOnly).toBe(false);
  });

  it('onFocus is a stable function reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useSearchInputAutofillGuard(defaultOpts));
    const first = result.current.onFocus;
    rerender();
    expect(result.current.onFocus).toBe(first);
  });
});
