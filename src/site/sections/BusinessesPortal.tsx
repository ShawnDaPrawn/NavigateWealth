/**
 * "Technology & partnership": a drawn sketch of the business portal (purely
 * decorative, so hidden from assistive technology) beside the copy and the
 * four platform features.
 */
import type { BusinessesIcon } from './BusinessesIcons';
import '../styles/for-businesses.css';

export interface BusinessesFeature {
  title: string;
  description: string;
  icon: BusinessesIcon;
}

interface BusinessesPortalProps {
  kicker: string;
  title: string;
  lead: string;
  body: string;
  features: readonly BusinessesFeature[];
}

const MOCK_CARDS = [
  { tint: 'rgba(13, 22, 38, 0.072)', bar: '70%' },
  { tint: 'rgba(22, 163, 74, 0.12)', bar: '55%' },
  { tint: 'rgba(14, 116, 144, 0.12)', bar: '65%' },
] as const;

const MOCK_BARS = [
  { h: '40%', c: 'var(--nw-line-soft)' },
  { h: '55%', c: 'var(--nw-on-dark)' },
  { h: '48%', c: 'var(--nw-line-soft)' },
  { h: '70%', c: 'var(--nw-on-dark)' },
  { h: '62%', c: 'var(--nw-on-dark)' },
  { h: '86%', c: 'var(--nw-ink)' },
] as const;

function PortalSketch() {
  return (
    <div className="nwfb-mock" aria-hidden="true">
      <div className="nw-grid-bg nwfb-mock-grid" />
      <div className="nwfb-mock-screen">
        <div className="nwfb-mock-side">
          <div className="nw-mono nwfb-mock-brand">BUSINESS PORTAL</div>
          <div className="nwfb-mock-nav nwfb-mock-nav--on">Dashboard</div>
          <div className="nwfb-mock-nav">Policies</div>
          <div className="nwfb-mock-nav">Reports</div>
          <div className="nwfb-mock-nav">Messages</div>
        </div>
        <div className="nwfb-mock-main">
          <div className="nwfb-mock-top">
            <div className="nwfb-mock-title" />
            <div className="nwfb-mock-avatar" />
          </div>
          <div className="nwfb-mock-cards">
            {MOCK_CARDS.map(({ tint, bar }) => (
              <div key={tint} className="nwfb-mock-card">
                <div className="nwfb-mock-sq" style={{ background: tint }} />
                <div className="nwfb-mock-line" style={{ width: bar }} />
              </div>
            ))}
          </div>
          <div className="nwfb-mock-chart">
            <div className="nwfb-mock-chart-t" />
            <div className="nwfb-mock-bars">
              {MOCK_BARS.map(({ h, c }, i) => (
                <div key={i} style={{ height: h, background: c }} />
              ))}
            </div>
          </div>
          <div className="nwfb-mock-foot">
            <div className="nwfb-mock-dot" />
            <div className="nwfb-mock-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BusinessesPortal({ kicker, title, lead, body, features }: BusinessesPortalProps) {
  return (
    <section className="nw-sec nwfb-tech" aria-labelledby="nwfb-tech-title">
      <div className="nw-wrap nwfb-split">
        <PortalSketch />
        <div>
          <p className="nw-kicker nw-mono">{kicker}</p>
          <h2 id="nwfb-tech-title" className="nwfb-h2">
            {title}
          </h2>
          <p className="nwfb-lead nwfb-lead--loose">{lead}</p>
          <p className="nwfb-tech-body">{body}</p>
          <ul className="nwfb-feats">
            {features.map(({ title: name, description, icon: Icon }) => (
              <li key={name} className="nwfb-feat">
                <span className="nwfb-feat-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="nwfb-feat-t">{name}</span>
                  <span className="nwfb-feat-d">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
