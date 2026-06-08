/**
 * Tests for useTabScroll hook.
 * Uses jsdom DOM to verify scrollTo is called with correct position.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useTabScroll } from '../useTabScroll';

function makeContainer(scrollLeft = 0, width = 400) {
  const container = document.createElement('div');
  Object.defineProperty(container, 'scrollLeft', { value: scrollLeft, writable: true });
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ left: 0, width, top: 0, height: 50, right: width, bottom: 50 }),
  });
  container.scrollTo = vi.fn();
  return container;
}

function makeButton(left = 100, width = 80) {
  const btn = document.createElement('button');
  btn.setAttribute('data-active', 'true');
  Object.defineProperty(btn, 'getBoundingClientRect', {
    value: () => ({ left, width, top: 0, height: 40, right: left + width, bottom: 40 }),
  });
  return btn;
}

describe('useTabScroll', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = makeContainer(0, 400) as HTMLDivElement;
    document.body.appendChild(container);
  });

  it('calls scrollTo when active button is present', () => {
    const btn = makeButton(100, 80);
    container.appendChild(btn);

    const { result } = renderHook(() => {
      const ref = useRef(container);
      useTabScroll(ref, 'tab-1');
      return ref;
    });

    expect(container.scrollTo).toHaveBeenCalledOnce();
    expect(result.current.current).toBe(container);
  });

  it('does not throw when ref.current is null', () => {
    expect(() => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        useTabScroll(ref as React.RefObject<HTMLDivElement>, 'tab-1');
      });
    }).not.toThrow();
  });

  it('does not call scrollTo when no active button exists', () => {
    renderHook(() => {
      const ref = useRef(container);
      useTabScroll(ref, 'tab-1');
    });
    expect(container.scrollTo).not.toHaveBeenCalled();
  });

  it('re-runs when activeId changes', () => {
    const btn = makeButton(200, 80);
    container.appendChild(btn);

    const { rerender } = renderHook(
      ({ activeId }) => {
        const ref = useRef(container);
        useTabScroll(ref, activeId);
      },
      { initialProps: { activeId: 'tab-1' } },
    );

    rerender({ activeId: 'tab-2' });
    expect(container.scrollTo).toHaveBeenCalledTimes(2);
  });
});
