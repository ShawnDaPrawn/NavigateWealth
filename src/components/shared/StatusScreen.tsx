/**
 * StatusScreen — the Navigator design's full-screen (or in-page) state card.
 *
 * One layout for the moments the app has to stop and say something: a render
 * crash (ErrorBoundary), a stale build after a deploy ("a new version is
 * ready", also ErrorBoundary), and the installed app's 404. It is the offline
 * screen's family (OfflineScreen.tsx): paper and chart grid, the sail mark in
 * range rings, a serif title, violet only on the main action, and the FSP line
 * under the card.
 *
 * It renders in the public site, the client portal, the admin and the
 * installed app, so it carries its own tokens (`.nwl-tokens` from
 * brand-loader.css plus `--nws-` values in status-screen.css) rather than the
 * public site's `.nw-site`. Its faces load on demand (see the effect below).
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { COMPANY } from '../../config/companyFacts';
import { BrandLoaderMark } from '../ui/brand-loader-mark';
import { cn } from '../ui/utils';
import '../ui/brand-loader.css';
import './status-screen.css';

export type StatusScreenVariant = 'error' | 'update' | 'lost';

export interface StatusScreenAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  /** Defaults to the first action being primary and the rest secondary. */
  kind?: 'primary' | 'secondary';
}

interface StatusScreenProps {
  variant: StatusScreenVariant;
  /** Short label above the title, e.g. "Update available". */
  eyebrow: string;
  title: string;
  /** The one or two sentences under the title. */
  lead: ReactNode;
  actions: readonly StatusScreenAction[];
  /** A reassurance strip along the bottom of the card. */
  note?: ReactNode;
  /** Collapsed technical details (error message, stack). */
  details?: ReactNode;
  /**
   * `page` fills the viewport on paper and chart grid; `inline` is the card
   * alone, for a layout's content area that keeps its own header and footer.
   */
  layout?: 'page' | 'inline';
  /** Move focus to the main action on mount (full-screen takeovers). */
  focusPrimary?: boolean;
  /** The page's main heading level: h1 when this is the whole page. */
  headingLevel?: 'h1' | 'h2';
  role?: 'alert';
  className?: string;
}

/** The sail mark in range rings, with a mark of its own for each state. */
function StatusPlot({ variant }: { variant: StatusScreenVariant }) {
  return (
    <div className={cn('nws-plot', `nws-plot--${variant}`)} aria-hidden="true">
      <svg className="nws-rings" viewBox="0 0 132 132" focusable="false">
        <circle className="nws-ring-outer" cx="66" cy="66" r="64" />
        <circle className="nws-ring-inner" cx="66" cy="66" r="44" />
        {Array.from({ length: 12 }, (_, i) => i * 30)
          .filter((angle) => angle !== 0)
          .map((angle) => (
            <line
              key={angle}
              className={angle % 90 === 0 ? 'nws-cardinal' : undefined}
              x1="66"
              x2="66"
              y1="2"
              y2={angle % 90 === 0 ? 9 : 6}
              transform={`rotate(${angle} 66 66)`}
            />
          ))}
        {/* North: the loader's lubber head. */}
        <path className="nws-lubber" d="M61.5 -1.5h9L66 5.5z" />

        {variant === 'update' && (
          // A refresh arc riding the inner ring, turning slowly.
          <g className="nws-arc">
            <path className="nws-arc-line" d="M66 22 A44 44 0 1 1 27.9 44" />
            <path className="nws-arc-head" d="M30.9 38.8 L30.8 48 L23 43.5 z" />
          </g>
        )}

        {variant === 'lost' && (
          // The heading needle, swung well off north: off course.
          <g className="nws-needle">
            <line className="nws-needle-line" x1="66" y1="66" x2="66" y2="12" />
            <path className="nws-needle-head" d="M60.5 17 L66 6 L71.5 17 z" />
          </g>
        )}
      </svg>
      <span className="nws-halo" />
      <BrandLoaderMark className="nws-mark" height={58} />
      {variant === 'error' && (
        <span className="nws-badge">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 7v6" />
            <path d="M12 16.5v.5" />
          </svg>
        </span>
      )}
    </div>
  );
}

export function StatusScreen({
  variant,
  eyebrow,
  title,
  lead,
  actions,
  note,
  details,
  layout = 'page',
  focusPrimary = false,
  headingLevel = 'h1',
  role,
  className,
}: StatusScreenProps) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const Heading = headingLevel;

  useEffect(() => {
    if (focusPrimary) primaryRef.current?.focus();
  }, [focusPrimary]);

  // The serif and sans faces, fetched only when a status screen is shown (the
  // portal and admin do not otherwise register them). Until they arrive, and
  // if they cannot, the stacks fall back to Georgia and the system sans.
  useEffect(() => {
    import('../../site/styles/fonts.css').catch(() => undefined);
  }, []);

  const card = (
    <div className="nws-card">
      <div className="nws-body">
        <StatusPlot variant={variant} />

        <p className="nws-eyebrow">
          <span className="nws-eyebrow-dot" aria-hidden="true" />
          {eyebrow}
        </p>
        <Heading id={titleId} className="nws-title">
          {title}
        </Heading>
        <div className="nws-lead">{lead}</div>

        <div className="nws-actions">
          {actions.map((action, index) => {
            const primary = (action.kind ?? (index === 0 ? 'primary' : 'secondary')) === 'primary';
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                ref={primary && index === 0 ? primaryRef : undefined}
                type="button"
                className={cn('nws-btn', !primary && 'nws-btn--quiet')}
                onClick={action.onClick}
              >
                {Icon ? <Icon aria-hidden="true" /> : null}
                {action.label}
              </button>
            );
          })}
        </div>

        {details ? (
          <details className="nws-details">
            <summary>Technical details</summary>
            <div className="nws-details-body">{details}</div>
          </details>
        ) : null}
      </div>

      {note ? <div className="nws-note">{note}</div> : null}
    </div>
  );

  if (layout === 'inline') {
    return (
      <section
        className={cn('nws nws--inline nwl-tokens', `nws--${variant}`, className)}
        role={role}
        aria-labelledby={titleId}
      >
        {card}
      </section>
    );
  }

  return (
    <div
      className={cn('nws nws--page nwl-tokens', `nws--${variant}`, className)}
      role={role}
      aria-labelledby={titleId}
    >
      <div className="nws-grid" aria-hidden="true" />
      <div className="nws-center">
        {card}
        <p className="nws-sig">
          <span className="nws-sig-name">Navigate Wealth</span>
          <span className="nws-sig-dot" aria-hidden="true">
            ·
          </span>
          <span>FSP {COMPANY.fspNumber}</span>
        </p>
      </div>
    </div>
  );
}
