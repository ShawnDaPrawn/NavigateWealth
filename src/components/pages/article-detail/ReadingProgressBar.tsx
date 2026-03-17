/**
 * ReadingProgressBar
 *
 * A thin accent-coloured bar fixed at the very top of the viewport that
 * fills from left to right as the reader scrolls through the article.
 *
 * Uses requestAnimationFrame-throttled scroll listener for smooth 60fps
 * updates without jank.
 *
 * @module article-detail/ReadingProgressBar
 */

import React, { useState, useEffect, useRef } from 'react';

interface ReadingProgressBarProps {
  /** Ref to the article content element whose scroll progress we track */
  contentRef: React.RefObject<HTMLElement | null>;
}

export function ReadingProgressBar({ contentRef }: ReadingProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return; // already scheduled

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

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

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [contentRef]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none"
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
    </div>
  );
}
