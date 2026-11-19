import type { LucideIcon } from 'lucide-react';
import { SectionHead } from './SectionHead';
import { pad2 } from './format';
import '../styles/sections.css';
import '../styles/home.css';

export interface Waypoint {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface WaypointsProps {
  index: string;
  kicker: string;
  title: string;
  points: readonly Waypoint[];
}

/** Reasons set out as waypoints on a dashed course line (dark band). */
export function Waypoints({ index, kicker, title, points }: WaypointsProps) {
  return (
    <section className="nw-sec nwwp" aria-labelledby="nwwp-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap nwwp-inner">
        <SectionHead index={index} kicker={kicker} title={title} center dark titleId="nwwp-title" />
        <div className="nwwp-track">
          <ul className="nwwp-list">
            {points.map(({ title: t, description, icon: Icon }, i) => (
              <li key={t}>
                <span className="nwwp-marker" aria-hidden="true">
                  <Icon size={26} strokeWidth={1.75} />
                </span>
                <span className="nwwp-leg nw-mono" aria-hidden="true">
                  WAYPOINT {pad2(i + 1)}
                </span>
                <h3 className="nwwp-title">{t}</h3>
                <p className="nwwp-desc">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
