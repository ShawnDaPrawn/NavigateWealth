/**
 * ReadingProgressBar
 *
 * A thin accent-coloured bar fixed below the site header that fills from left
 * to right as the reader scrolls through the article.
 *
 * Mounts into the sticky header slot in MainLayout so the bar tracks the nav
 * without affecting logo/menu spacing (no body-level fixed overlay on the nav).
 *
 * @module article-detail/ReadingProgressBar
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { READING_PROGRESS_SLOT_ID } from '../../layout/MainLayout';

interface ReadingProgressBarProps {
  /** Ref to the article content element whose scroll progress we track */
  contentRef: React.RefObject<HTMLElement | null>;
}

export function ReadingProgressBar({ contentRef }: ReadingProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(READING_PROGRESS_SLOT_ID));
  }, []);

  useEffect(() => {
    const update = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

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

  if (!slot) {
    return null;
  }

  return createPortal(
    <div
      className="absolute inset-0 overflow-hidden print:hidden"
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
    slot,
  );
}
