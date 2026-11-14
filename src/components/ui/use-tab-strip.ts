import { useCallback, useEffect, useRef } from 'react';

/**
 * Behaviour for a row of tabs that may be wider than the screen (the
 * `.tab-strip` class in globals.css).
 *
 * On a phone a module's tabs rarely fit. Squeezing them made the labels run
 * into each other, so the row scrolls sideways instead, and this hook does the
 * two things that make a scrolling row usable:
 *
 * - marks which ends have more tabs past them (`data-fade-start` /
 *   `data-fade-end`), which the stylesheet turns into a fade so it is obvious
 *   the row scrolls;
 * - brings the selected tab into view whenever it changes, so a tab chosen
 *   from a link or the address bar is never hidden off the edge.
 *
 * Returns a callback ref, so it composes with a forwarded ref.
 */
export function useTabStrip<T extends HTMLElement>(forwardedRef?: React.Ref<T>) {
  const nodeRef = useRef<T | null>(null);

  const setRef = useCallback(
    (node: T | null) => {
      nodeRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<T | null>).current = node;
    },
    [forwardedRef],
  );

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    const updateFades = () => {
      const overflow = el.scrollWidth - el.clientWidth;
      el.dataset.fadeStart = String(overflow > 1 && el.scrollLeft > 1);
      el.dataset.fadeEnd = String(overflow > 1 && overflow - el.scrollLeft > 1);
    };

    const revealActive = () => {
      if (el.scrollWidth <= el.clientWidth) return;
      const active = el.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) return;
      const strip = el.getBoundingClientRect();
      const tab = active.getBoundingClientRect();
      const gutter = 32;
      if (tab.left < strip.left + gutter) {
        el.scrollLeft -= strip.left + gutter - tab.left;
      } else if (tab.right > strip.right - gutter) {
        el.scrollLeft += tab.right - (strip.right - gutter);
      }
      updateFades();
    };

    updateFades();
    revealActive();

    el.addEventListener('scroll', updateFades, { passive: true });

    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateFades();
            revealActive();
          });
    resize?.observe(el);

    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            revealActive();
            updateFades();
          });
    mutations?.observe(el, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });

    return () => {
      el.removeEventListener('scroll', updateFades);
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, []);

  return setRef;
}
