import { Link } from 'react-router';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import '../styles/sections.css';
import '../styles/home.css';

export interface AudiencePath {
  path: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

interface AudiencePathsProps {
  title: string;
  paths: readonly AudiencePath[];
  allLink: { label: string; to: string };
}

/** "Set your course": one card per audience, straight under the hero. */
export function AudiencePaths({ title, paths, allLink }: AudiencePathsProps) {
  return (
    <section className="nwdp" aria-labelledby="nwdp-title">
      <div className="nw-wrap">
        <div className="nw-sec-row">
          <div>
            <p className="nw-kicker nw-mono">Solutions</p>
            <h2 id="nwdp-title" className="nwdp-title">
              {title}
            </h2>
          </div>
          <Link className="nw-textlink" to={allLink.to}>
            {allLink.label}
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <ul className="nwdp-grid">
          {paths.map(({ path, label, description, icon: Icon }) => (
            <li key={path}>
              <Link className="nwdp-card" to={path}>
                <span className="nwdp-icon" aria-hidden="true">
                  <Icon size={24} strokeWidth={1.75} />
                </span>
                <span className="nwdp-text">
                  <span className="nwdp-t">{label}</span>
                  {description ? <span className="nwdp-s">{description}</span> : null}
                </span>
                <span className="nwdp-go" aria-hidden="true">
                  <ArrowRight size={17} strokeWidth={1.75} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
