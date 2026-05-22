/**
 * ReadingProgressBar
 *
 * A thin accent-coloured bar fixed below the site header that fills from left
 * to right as the reader scrolls through the article.
 *
 * Measures the public nav position locally so article reading progress does
 * not need any special wiring in the shared site header.
 *
 * @module article-detail/ReadingProgressBar
 */

import React, { useState, useEffect, useRef } from 'react';

interface ReadingProgressBarProps {
  /** Ref to the article content element whose scroll progress we track */
  contentRef: React.RefObject<HTMLElement | null>;
}

const DEFAULT_NAV_BOTTOM = 64;
const NAV_SELECTOR = 'nav[aria-label="Main navigation"]';

export function ReadingProgressBar({ contentRef }: ReadingProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [barTop, setBarTop] = useState(DEFAULT_NAV_BOTTOM);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const nav = document.querySelector<HTMLElement>(NAV_SELECTOR);
        const navBottom = nav?.getBoundingClientRect().bottom ?? DEFAULT_NAV_BOTTOM;
        setBarTop(Math.max(0, navBottom));

        const el = contentRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        const scrolledPast = -rect.top;
        const totalScrollable = rect.height - windowHeight;

        if (totalScrollable <= 0) {
          setProgress(rect.top <= 0 ? 100 : 0);
          return;
        }

        const pct = Math.min(100, Math.max(0, (scrolledPast / totalScrollable) * 100));
        setProgress(pct);
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [contentRef]);

  return (
    <div
      className="fixed left-0 right-0 z-[45] h-[3px] overflow-hidden pointer-events-none print:hidden"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
      style={{ top: `${barTop}px` }}
    >
      <div
        className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
