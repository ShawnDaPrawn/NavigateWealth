/**
 * The site-wide loader, in the Navigator design.
 *
 * Four sizes, one look: the Navigate Wealth sail mark over a heading tape (degree
 * ticks sliding past a fixed lubber line, the way a ship's compass reads), with a
 * serif title and a short message.
 *
 * - BrandPageLoader     full screen, on paper and chart grid; route changes and first load
 * - BrandSectionLoader  inside a page that is already open
 * - BrandLoaderPanel    the bare stack, for overlays and custom layouts
 * - BrandInlineLoader   a quarter-size tape beside a label, for rows and status lines
 *
 * Behaviour worth knowing before changing it:
 * - Nothing appears for the first 250 ms (CSS animation-delay), so a fast route
 *   change never flashes a loader.
 * - After 8 s the message is replaced by SLOW_MESSAGE, so a slow connection does
 *   not look like a frozen site.
 * - All motion is CSS transforms; see the note at the top of brand-loader.css.
 */
import { useEffect, useState } from 'react';
import { cn } from './utils';
import { BrandLoaderMark } from './brand-loader-mark';
import './brand-loader.css';

interface BrandLoaderPanelProps {
  title?: string;
  message?: string;
  compact?: boolean;
  className?: string;
}

interface BrandPageLoaderProps extends BrandLoaderPanelProps {
  containerClassName?: string;
}

interface BrandSectionLoaderProps extends BrandLoaderPanelProps {
  containerClassName?: string;
}

interface BrandInlineLoaderProps {
  label?: string;
  className?: string;
}

export const SLOW_AFTER_MS = 8000;
export const SLOW_MESSAGE = 'This is taking longer than usual. A slow connection can do this.';

// ── Heading tape ──
//
// The strip covers -180 to 600 degrees, which keeps every heading the
// nwl-seek-* keyframes visit (042 to 402) at least half a window from either
// end. Ticks every 5 degrees, longer every 10, longest with a label every 30.

const TAPE_FROM = -180;
const TAPE_TO = 600;
const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

const TICKS = Array.from({ length: (TAPE_TO - TAPE_FROM) / 5 + 1 }, (_, i) => {
  const degree = TAPE_FROM + i * 5;
  const bearing = ((degree % 360) + 360) % 360;
  const rank = bearing % 30 === 0 ? 2 : bearing % 10 === 0 ? 1 : 0;
  return { degree, bearing, rank };
});

const TAPES = {
  full: { pxPerDegree: 2, height: 36, tickLengths: [5, 8, 12], labels: true },
  mini: { pxPerDegree: 1, height: 14, tickLengths: [3, 5, 8], labels: false },
} as const;

type TapeSize = keyof typeof TAPES;

function bearingLabel(bearing: number): string {
  return CARDINALS[bearing] ?? String(bearing).padStart(3, '0');
}

function HeadingTape({ size }: { size: TapeSize }) {
  const { pxPerDegree, height, tickLengths, labels } = TAPES[size];
  const width = (TAPE_TO - TAPE_FROM) * pxPerDegree;
  return (
    <span className={cn('nwl-tape', `nwl-tape-${size}`)} aria-hidden="true">
      <span className="nwl-tape-window">
        <svg
          className="nwl-strip"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          focusable="false"
        >
          <line x1={0} x2={width} y1={0.5} y2={0.5} />
          {TICKS.map(({ degree, bearing, rank }) => {
            const x = (degree - TAPE_FROM) * pxPerDegree + 0.5;
            const cardinal = bearing in CARDINALS;
            return (
              <g key={degree}>
                <line
                  className={rank === 2 ? 'nwl-major' : undefined}
                  x1={x}
                  x2={x}
                  y1={1}
                  y2={1 + tickLengths[rank]}
                />
                {labels && rank === 2 ? (
                  <text
                    x={x}
                    y={cardinal ? 29 : 28}
                    textAnchor="middle"
                    className={cardinal ? 'nwl-cardinal' : undefined}
                  >
                    {bearingLabel(bearing)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </span>
      {size === 'full' ? (
        <svg className="nwl-lubber" width="9" height="28" viewBox="0 0 9 28" focusable="false">
          <path d="M0 0h9L4.5 6z" />
          <rect x="3.75" y="4" width="1.5" height="24" rx=".75" />
        </svg>
      ) : (
        <svg className="nwl-lubber" width="7" height="17" viewBox="0 0 7 17" focusable="false">
          <path d="M0 0h7L3.5 4z" />
          <rect x="2.85" y="3" width="1.3" height="14" rx=".65" />
        </svg>
      )}
    </span>
  );
}

/** True once the loader has been on screen for SLOW_AFTER_MS. */
function useSlowLoad(): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return slow;
}

export function BrandLoaderPanel({
  title = 'Plotting your course',
  message = 'Bringing the next page into view.',
  compact = false,
  className,
}: BrandLoaderPanelProps) {
  const slow = useSlowLoad();
  return (
    <div
      className={cn('nwl-panel', compact && 'nwl-compact', className)}
      role="status"
      aria-live="polite"
    >
      <span className="nwl-rv">
        <BrandLoaderMark className="nwl-mark" height={compact ? 52 : 92} />
      </span>
      <span className="nwl-rv nwl-d1">
        <HeadingTape size="full" />
      </span>
      <p className="nwl-title nwl-rv nwl-d2">{title}</p>
      {message ? (
        <p className={cn('nwl-msg nwl-rv nwl-d3', slow && 'is-slow')}>
          <span className="nwl-msg-first" aria-hidden={slow}>
            {message}
          </span>
          <span className="nwl-msg-slow" aria-hidden={!slow}>
            {SLOW_MESSAGE}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function BrandPageLoader({ containerClassName, ...panelProps }: BrandPageLoaderProps) {
  return (
    <div className={cn('nwl-page', containerClassName)}>
      <BrandLoaderPanel {...panelProps} />
      <p className="nwl-sig nwl-rv nwl-d4">
        <span className="nwl-sig-name">Navigate Wealth</span>
        <span className="nwl-sig-dot" aria-hidden="true">
          ·
        </span>
        <span>Authorised Financial Services Provider</span>
        <span className="nwl-sig-dot" aria-hidden="true">
          ·
        </span>
        <span>FSP 54606</span>
      </p>
    </div>
  );
}

export function BrandSectionLoader({
  containerClassName,
  compact = true,
  ...panelProps
}: BrandSectionLoaderProps) {
  return (
    // Layout stays in Tailwind classes so a caller's containerClassName (HistoryPage
    // passes py-4) can override it. brand-loader.css is unlayered, so a padding
    // set there would beat Tailwind's layered utilities.
    <div className={cn('flex items-center justify-center py-12', containerClassName)}>
      <BrandLoaderPanel compact={compact} {...panelProps} />
    </div>
  );
}

/** Spans only, so it can sit inside a <p> or a button label. */
export function BrandInlineLoader({ label = 'Loading…', className }: BrandInlineLoaderProps) {
  return (
    <span className={cn('nwl-inline', className)} role="status" aria-live="polite">
      <HeadingTape size="mini" />
      <span>{label}</span>
    </span>
  );
}
