/**
 * Decorative pictures for the Solutions and Why Us pages, drawn in markup
 * rather than shipped as images: the client / business portal, the adviser
 * transition route, and the compass and building line art behind the dark
 * bands. All are aria-hidden — the text beside each one says what it shows.
 */
import { Check } from 'lucide-react';

const PORTAL_MENUS = {
  client: { title: 'Client portal', items: ['Policies', 'Documents', 'Messages', 'E-signatures'] },
  business: { title: 'Business portal', items: ['Dashboard', 'Policies', 'Reports', 'Messages'] },
} as const;

/** A sketch of the online portal: menu, tiles and document rows (or a chart). */
export function PortalArt({ variant }: { variant: 'client' | 'business' }) {
  const menu = PORTAL_MENUS[variant];
  return (
    <div className="nwsol-art" aria-hidden="true">
      <div className="nw-grid-bg" />
      <div className="nwsol-portal">
        <div className="nwsol-portal-menu">
          <span className="nwsol-portal-title nw-mono">{menu.title}</span>
          {menu.items.map((item, i) => (
            <span key={item} className={i === 0 ? 'nwsol-portal-item is-on' : 'nwsol-portal-item'}>
              {item}
            </span>
          ))}
        </div>
        <div className="nwsol-portal-main">
          <div className="nwsol-portal-top">
            <span className="nwsol-bar nwsol-bar--title" />
            <span className="nwsol-portal-avatar" />
          </div>
          {variant === 'client' ? (
            <>
              <div className="nwsol-portal-tiles">
                <span className="nwsol-portal-tile">
                  <span className="nwsol-sq" />
                  <span className="nwsol-bar nwsol-w70" />
                  <span className="nwsol-bar nwsol-bar--soft nwsol-w45" />
                </span>
                <span className="nwsol-portal-tile">
                  <span className="nwsol-sq nwsol-sq--green" />
                  <span className="nwsol-bar nwsol-w60" />
                  <span className="nwsol-bar nwsol-bar--soft nwsol-w50" />
                </span>
              </div>
              <div className="nwsol-portal-row">
                <span className="nwsol-doc" />
                <span className="nwsol-portal-lines">
                  <span className="nwsol-bar nwsol-w60" />
                  <span className="nwsol-bar nwsol-bar--soft nwsol-w35" />
                </span>
                <span className="nwsol-chip nwsol-chip--ok">Signed</span>
              </div>
              <div className="nwsol-portal-row">
                <span className="nwsol-doc" />
                <span className="nwsol-portal-lines">
                  <span className="nwsol-bar nwsol-w50" />
                  <span className="nwsol-bar nwsol-bar--soft nwsol-w30" />
                </span>
                <span className="nwsol-chip">New</span>
              </div>
            </>
          ) : (
            <>
              <div className="nwsol-portal-tiles nwsol-portal-tiles--three">
                <span className="nwsol-portal-tile">
                  <span className="nwsol-sq" />
                  <span className="nwsol-bar nwsol-w70" />
                </span>
                <span className="nwsol-portal-tile">
                  <span className="nwsol-sq nwsol-sq--green" />
                  <span className="nwsol-bar nwsol-w55" />
                </span>
                <span className="nwsol-portal-tile">
                  <span className="nwsol-sq nwsol-sq--teal" />
                  <span className="nwsol-bar nwsol-w65" />
                </span>
              </div>
              <div className="nwsol-portal-chart">
                <span className="nwsol-bar nwsol-w40" />
                <span className="nwsol-chart">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`nwsol-col nwsol-col--${i}`} />
                  ))}
                </span>
              </div>
            </>
          )}
          <div className="nwsol-portal-chat">
            <span className="nwsol-portal-dot" />
            <span className="nwsol-portal-input" />
          </div>
        </div>
      </div>
    </div>
  );
}

const ROUTE_STEPS = [
  { label: 'Initial planning', status: 'Complete', state: 'done' },
  { label: 'Practice valuation', status: 'Complete', state: 'done' },
  { label: 'Deal structuring', status: 'In progress', state: 'now' },
  { label: 'Client handovers', status: 'Next', state: 'next' },
] as const;

/** An adviser's practice transition, step by step. */
export function TransitionArt() {
  return (
    <div className="nwsol-art nwsol-art--route" aria-hidden="true">
      <div className="nw-grid-bg" />
      <div className="nwsol-route">
        <div className="nwsol-route-head nw-mono">
          <span>Transition route</span>
          <span className="nwsol-route-tag">All parties · Secure</span>
        </div>
        <ol className="nwsol-route-list">
          {ROUTE_STEPS.map((s) => (
            <li key={s.label} className={`nwsol-route-step is-${s.state}`}>
              <span className="nwsol-route-dot">
                {s.state === 'done' ? <Check size={16} strokeWidth={2} /> : null}
                {s.state === 'now' ? <span className="nwsol-route-pip" /> : null}
              </span>
              <span className="nwsol-route-card">
                <span className="nwsol-route-label">{s.label}</span>
                <span className="nwsol-route-status nw-mono">{s.status}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Compass rose with a ticked bezel, behind the dark bands and CTA panels. */
export function CompassArt({ className, ticks = true }: { className: string; ticks?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 480 480" fill="none" aria-hidden="true">
      <circle cx="240" cy="240" r="224" className="nwsol-art-ring" />
      <circle
        cx="240"
        cy="240"
        r="208"
        className="nwsol-art-ticks"
        strokeWidth="8"
        strokeDasharray="1 17.15"
      />
      {ticks ? (
        <circle
          cx="240"
          cy="240"
          r="208"
          className="nwsol-art-major"
          strokeWidth="16"
          strokeDasharray="2 106.92"
        />
      ) : null}
      <polygon
        points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
        className="nwsol-art-rose"
      />
    </svg>
  );
}

/** An office block in line art, behind the Why Us closing panel. */
export function BuildingArt({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 480 480" fill="none" aria-hidden="true">
      <rect x="140" y="80" width="200" height="320" rx="12" className="nwsol-art-ring" />
      <path d="M200 400v-60h80v60" className="nwsol-art-ring" />
      <path
        d="M190 140h.01M240 140h.01M290 140h.01M190 200h.01M240 200h.01M290 200h.01M190 260h.01M240 260h.01M290 260h.01"
        className="nwsol-art-windows"
        strokeWidth="10"
        strokeLinecap="round"
      />
    </svg>
  );
}
