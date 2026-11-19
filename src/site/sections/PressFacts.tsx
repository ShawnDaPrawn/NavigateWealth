/**
 * PressFacts — the strip of checkable company facts under the press hero.
 * The page passes the same four facts the live press page shows, read from
 * companyFacts.ts.
 */
import { PressIcon, type PressIconName } from './PressIcons';
import '../styles/press.css';

export interface PressFact {
  value: string;
  label: string;
  icon: PressIconName;
}

export function PressFacts({ facts }: { facts: readonly PressFact[] }) {
  return (
    <section className="nwpr2-facts" aria-label="Company facts">
      <ul className="nw-wrap nwpr2-facts-grid">
        {facts.map((fact) => (
          <li key={fact.label} className="nwpr2-fact">
            <span className="nwpr2-fact-icon">
              <PressIcon name={fact.icon} size={20} />
            </span>
            <span>
              <span className="nwpr2-fact-v">{fact.value}</span>
              <span className="nwpr2-fact-l">{fact.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
