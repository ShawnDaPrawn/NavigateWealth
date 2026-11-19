/**
 * CareersHero — the Careers page's opening, as the "Careers" board draws it:
 * badge, headline, the two actions, the trust line, and the "crew manifest"
 * of departments beside them. Choosing a department there selects its tab in
 * Open Positions and brings that section into view.
 */
import type { MouseEvent } from 'react';
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Globe,
  Send,
  Shield,
} from 'lucide-react';
import type { CareersCategory } from './CareersOpenings';
import { pad2 } from './format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/careers.css';

interface CareersHeroProps {
  categories: readonly CareersCategory[];
  /** The in-page anchor of the Open Positions section. */
  openingsHref: string;
  onPickCategory: (id: string) => void;
  onSendCv: (event: MouseEvent<HTMLButtonElement>) => void;
}

const TRUST = [
  { label: 'FSCA Regulated', icon: Shield },
  { label: 'Independent', icon: Globe },
  { label: 'Equal Opportunity Employer', icon: CheckCircle },
] as const;

export function CareersHero({
  categories,
  openingsHref,
  onPickCategory,
  onSendCv,
}: CareersHeroProps) {
  return (
    <section className="nwcr-hero" aria-label="Careers hero">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwcr-glow" aria-hidden="true" />
      <div className="nw-wrap nwcr-hero-grid">
        <div>
          <div className="nwcr-pill">
            <Briefcase size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Careers at Navigate Wealth</span>
          </div>
          <h1 className="nwcr-h1">
            Build Your Career in <span className="nw-accent">Financial Advisory</span>
          </h1>
          <p className="nwcr-lead">
            Navigate Wealth is an independent, founder-led financial advisory practice. We combine
            modern technology with personalised service to help clients achieve their financial
            goals.
          </p>
          <div className="nwcr-hero-ctas">
            <a className="nw-btn nwcr-btn-lg" href={openingsHref}>
              View Open Positions
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
            <button type="button" className="nw-ghost-dark nwcr-btn-lg" onClick={onSendCv}>
              <Send size={18} strokeWidth={1.75} aria-hidden="true" />
              Send Your CV
            </button>
          </div>
          <ul className="nwcr-trust">
            {TRUST.map(({ label, icon: Icon }) => (
              <li key={label}>
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <aside className="nwcr-manifest" aria-label="Departments">
          <div className="nwcr-manifest-head">
            <span className="nw-mono nwcr-manifest-label">Crew manifest</span>
            <span className="nw-mono nwcr-manifest-count">{categories.length} departments</span>
          </div>
          <div className="nwcr-manifest-list">
            {categories.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className="nwcr-manifest-row"
                onClick={() => onPickCategory(c.id)}
              >
                <span className="nw-mono nwcr-manifest-no">{pad2(i + 1)}</span>
                <span className="nwcr-manifest-text">
                  <span className="nwcr-manifest-t">{c.title}</span>
                  <span className="nwcr-manifest-d">{c.description}</span>
                </span>
                <ChevronRight
                  className="nwcr-manifest-chev"
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
