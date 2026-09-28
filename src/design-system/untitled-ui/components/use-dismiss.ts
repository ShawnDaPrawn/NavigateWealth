import * as React from 'react';

/**
 * Calls `onDismiss` when a pointer goes down outside every ref in `refs`, or
 * when Escape is pressed, while `active` is true, saying which happened. Shared by the popover
 * components (Select, Dropdown, Context menu).
 */
export function useDismiss(
  active: boolean,
  refs: ReadonlyArray<React.RefObject<HTMLElement | null>>,
  onDismiss: (reason: 'outside' | 'escape') => void,
) {
  const latest = React.useRef(onDismiss);
  latest.current = onDismiss;

  React.useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (refs.every((r) => !r.current?.contains(target))) latest.current('outside');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current('escape');
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // refs are stable ref objects; listing them would re-subscribe every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/** Index of the next enabled item from `from` in `dir`, wrapping; -1 if none. */
export function nextEnabled(disabled: boolean[], from: number, dir: 1 | -1): number {
  const n = disabled.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + dir * step) % n) + n) % n;
    if (!disabled[i]) return i;
  }
  return -1;
}
