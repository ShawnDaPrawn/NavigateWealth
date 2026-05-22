/**
 * ReadingProgressBar
 *
 * A thin accent-coloured bar fixed below the site header that fills from left
 * to right as the reader scrolls through the article.
 *
 * Rendered via portal so position:fixed is never broken by layout ancestors
 * (e.g. display:contents wrappers). The bar tracks the sticky nav bottom edge
 * so it stays visible while scrolling down, not only near the page top.
 *
 * @module article-detail/ReadingProgressBar
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ReadingProgressBarProps {
  /** Ref to the article content element whose scroll progress we track */
  contentRef: React.RefObject<HTMLElement | null>;
}

const NAV_SELECTOR = 'nav[aria-label="Main navigation"]';

function measureHeaderBottomOffset(): number {
  const nav = document.querySelector(NAV_SELECTOR);
  if (!nav) return 0;
  return Math.max(0, Math.round(nav.getBoundingClientRect().bottom));
}

export function ReadingProgressBar({ contentRef }: ReadingProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [topOffset, setTopOffset] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        setTopOffset(measureHeaderBottomOffset());

        const el = contentRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // How far the top of the content has scrolled past the top of the viewport
        const scrolledPast = -rect.top;
        // Total scrollable distance for this element
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

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[100] h-[3px] bg-transparent pointer-events-none print:hidden"
      style={{ top: topOffset }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>,
    document.body,
  );
}
