import { ArrowRight, Shield } from 'lucide-react';
import '../styles/sections.css';
import '../styles/about.css';

export interface RegisterEntry {
  label: string;
  value: string;
  /** Codes and numbers (registration, FSP) are set in tabular figures. */
  code?: boolean;
  /** The FSP number is picked out in cream, as on the board. */
  highlight?: boolean;
}

interface AboutHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  action: { label: string; href: string };
  register: RegisterEntry[];
}

/**
 * The About page's hero: the headline on the left, and on the right the
 * firm's entry as it reads on the public registers — every line a fact from
 * companyFacts that a reader can check.
 */
export function AboutHero({ badge, title, accent, lead, action, register }: AboutHeroProps) {
  return (
    <section className="nwab-hero" aria-labelledby="nwab-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwab-glow" aria-hidden="true" />
      <div className="nw-wrap nwab-hero-inner">
        <div className="nwab-hero-grid">
          <div>
            <p className="nwab-pill">
              <Shield size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{badge}</span>
            </p>
            <h1 id="nwab-title" className="nwab-h1">
              {title} <span className="nw-accent">{accent}</span>
            </h1>
            <p className="nwab-hero-lead">{lead}</p>
            <div className="nwab-hero-ctas">
              <a className="nw-btn nw-btn--lg nwab-cta" href={action.href}>
                {action.label}
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="nwab-reg">
            <div className="nwab-reg-head">
              <span className="nwab-reg-label nw-mono">On the register</span>
              <span className="nwab-reg-status">
                <span className="nwab-reg-dot" aria-hidden="true" />
                Authorised
              </span>
            </div>
            <dl className="nwab-reg-list">
              {register.map((row) => {
                const classes = [
                  row.code ? 'nwab-reg-code nw-mono' : '',
                  row.highlight ? 'nwab-reg-fsp' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div key={row.label} className="nwab-reg-row">
                    <dt className="nw-mono">{row.label}</dt>
                    <dd className={classes || undefined}>{row.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
