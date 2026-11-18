/**
 * The dark opening band of the company pages (About, Team, Careers, Press),
 * built on the shared service-page hero (service.css: .nws-hero, .nws-h1,
 * .nws-slogan, .nws-lead, .nws-ctas) so every page opens the same way: a
 * label, the page's one H1, the live headline kept as a slogan beneath it,
 * the lead, the actions, a trust line, and a panel on the right.
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import '../styles/service.css';
import '../styles/company.css';

interface CompanyHeroProps {
  titleId: string;
  pillIcon: LucideIcon;
  pill: ReactNode;
  /** The H1 — leads with what people search for. */
  title: ReactNode;
  /** The live page's headline, kept beneath the H1. */
  slogan?: ReactNode;
  lead: ReactNode;
  actions: ReactNode;
  /** A trust line or fact row under the actions. */
  meta?: ReactNode;
  aside?: ReactNode;
}

export function CompanyHero({
  titleId,
  pillIcon: PillIcon,
  pill,
  title,
  slogan,
  lead,
  actions,
  meta,
  aside,
}: CompanyHeroProps) {
  return (
    <section className="nws-hero nwco-hero" aria-labelledby={titleId}>
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap nws-hero-inner">
        <div className="nwco-hero-copy">
          <p className="nwco-pill">
            <PillIcon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{pill}</span>
          </p>
          <h1 id={titleId} className="nws-h1">
            {title}
          </h1>
          {slogan ? <p className="nws-slogan">{slogan}</p> : null}
          <p className="nws-lead">{lead}</p>
          <div className="nws-ctas">{actions}</div>
          {meta}
        </div>
        {aside}
      </div>
    </section>
  );
}
