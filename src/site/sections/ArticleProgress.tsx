/**
 * The reading-progress line across the top of the window and the back-to-top
 * button, as the board draws them.
 *
 * Both behave as the live page's do (ReadingProgressBar.tsx, BackToTop.tsx):
 * progress measures how far the article body has been read, not the whole
 * page, and the button appears once the page is scrolled past 600px. Going
 * back to the top is instant when reduced motion is asked for.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArticleIcon } from './ArticleIcons';

const TOP_THRESHOLD = 600;

export function ArticleProgress({ contentRef }: { contentRef: RefObject<HTMLElement | null> }) {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const el = contentRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrolledPast = -rect.top;
        const totalScrollable = rect.height - window.innerHeight;
        if (totalScrollable <= 0) {
          setProgress(rect.top <= 0 ? 100 : 0);
          return;
        }
        setProgress(Math.min(100, Math.max(0, (scrolledPast / totalScrollable) * 100)));
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [contentRef]);

  const pct = Math.round(progress);
  return (
    <div
      className="nwar-progress nwar-noprint"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="nwar-progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}

export function ArticleBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > TOP_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      className="nwar-totop nwar-noprint nw-in"
      aria-label="Back to top"
      onClick={() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      }}
    >
      <ArticleIcon name="arrowUp" size={19} />
    </button>
  );
}
