/**
 * "Choose your course" — the hero's switcher between the three Solutions
 * pages. The current page is marked with aria-current, as in the header.
 */
import { useId } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Briefcase, Building, User, type LucideIcon } from 'lucide-react';
import { SOLUTION_AUDIENCES, type SolutionAudience } from './navigatorContent';

const ICONS: Record<SolutionAudience, LucideIcon> = {
  individuals: User,
  businesses: Building,
  advisers: Briefcase,
};

export function AudienceNav({ current }: { current: SolutionAudience }) {
  const titleId = useId();
  return (
    <nav className="nwsol-aud" aria-labelledby={titleId}>
      <div className="nwsol-aud-head nw-mono">
        <span id={titleId} className="nwsol-aud-title">
          Choose your course
        </span>
        <span className="nwsol-aud-tag" aria-hidden="true">
          Solutions
        </span>
      </div>
      <ul className="nwsol-aud-list">
        {SOLUTION_AUDIENCES.map((a) => {
          const Icon = ICONS[a.id];
          const here = a.id === current;
          return (
            <li key={a.id}>
              <Link className="nwsol-aud-link" to={a.path} aria-current={here ? 'page' : undefined}>
                <span className="nwsol-aud-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="nwsol-aud-text">
                  <span className="nwsol-aud-label">{a.label}</span>
                  <span className="nwsol-aud-note">{a.note}</span>
                </span>
                {here ? (
                  <span className="nwsol-aud-here nw-mono">You are here</span>
                ) : (
                  <ArrowRight
                    className="nwsol-aud-arrow"
                    size={16}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
