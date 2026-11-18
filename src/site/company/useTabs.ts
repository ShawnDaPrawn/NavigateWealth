/**
 * Roving-focus tabs (WAI-ARIA): one tab in the tab order, arrow keys move
 * between tabs (both axes, since a list can be vertical on desktop and a row
 * on phones), Home and End jump to the ends. Selection follows focus.
 */
import { useRef, useState, type KeyboardEvent } from 'react';

export function useTabs<K extends string>(keys: readonly K[], initial: K) {
  const [active, setActive] = useState<K>(initial);
  const refs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const i = keys.indexOf(active);
    const moves: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: keys.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = keys[(moves[e.key] + keys.length) % keys.length];
    setActive(next);
    refs.current[next]?.focus({ preventScroll: true });
  };

  const tabRef = (key: K) => (el: HTMLButtonElement | null) => {
    refs.current[key] = el;
  };

  return { active, setActive, onKeyDown, tabRef };
}
