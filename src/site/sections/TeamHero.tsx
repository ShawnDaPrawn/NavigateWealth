/**
 * TeamHero — the Team page's opening, as the "Team" board draws it: the
 * founder-led badge, the page's one H1, the lead, two actions, the fact line
 * and the founder's portrait with its caption card.
 */
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import { UserCheckIcon } from './TeamIcons';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/team.css';

export interface TeamAction {
  label: string;
  to: string;
}

export interface TeamPortrait {
  src: string;
  imageKey: string;
  alt: string;
  name: string;
  role: string;
  badge: string;
}

interface TeamHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  primary: TeamAction;
  secondary: TeamAction;
  facts: readonly string[];
  portrait: TeamPortrait;
}

export function TeamHero({
  badge,
  title,
  accent,
  lead,
  primary,
  secondary,
  facts,
  portrait,
}: TeamHeroProps) {
  return (
    <section className="nwtm-hero" aria-label="Hero">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwtm-glow" aria-hidden="true" />
      <div className="nw-wrap nwtm-hero-inner">
        <div>
          <p className="nwtm-pill">
            <UserCheckIcon size={14} />
            <span>{badge}</span>
          </p>
          <h1 className="nwtm-h1">
            {title} <span className="nw-accent">{accent}</span>
          </h1>
          <p className="nwtm-lead">{lead}</p>
          <div className="nwtm-ctas">
            <Link className="nw-btn nw-btn--lg" to={primary.to}>
              {primary.label}
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link className="nw-ghost-dark nw-btn--lg" to={secondary.to}>
              {secondary.label}
            </Link>
          </div>
          <ul className="nwtm-facts">
            {facts.map((fact) => (
              <li key={fact} className="nw-mono">
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <figure className="nwtm-figure">
          <div className="nwtm-ring" aria-hidden="true" />
          <div className="nwtm-portrait">
            <NwImage
              src={portrait.src}
              imageKey={portrait.imageKey}
              alt={portrait.alt}
              sizes="(min-width: 540px) 480px, 100vw"
              width={1254}
              height={1254}
              priority
            />
            <div className="nwtm-shade" aria-hidden="true" />
          </div>
          <figcaption className="nwtm-cap">
            <span>
              <span className="nw-h nwtm-cap-name">{portrait.name}</span>
              <span className="nwtm-cap-role">{portrait.role}</span>
            </span>
            <span className="nw-mono nwtm-cap-badge">{portrait.badge}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
