/**
 * LegalDocHeader — the top of a legal document: the way back to the hub,
 * the section it is filed under, its title and description, the PDF action
 * and the dates. The loading and unavailable states reuse the frame with the
 * live page's wording.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { LegalIcon, type LegalIconName } from './LegalIcons';

interface LegalDocHeaderProps {
  backHref: string;
  /** The section chip; left out when the section is not known. */
  section?: { label: string; icon: LegalIconName };
  title: string;
  description?: string | null;
  /** The header's right-hand action (Download PDF). */
  action?: ReactNode;
  /** What sits under the title: the dates, or a status. */
  children?: ReactNode;
}

export function LegalDocHeader({
  backHref,
  section,
  title,
  description,
  action,
  children,
}: LegalDocHeaderProps) {
  return (
    <header className="nwld-head">
      <div className="nw-wrap nwld-head-inner">
        <Link className="nwld-back" to={backHref}>
          <LegalIcon name="arrowLeft" size={16} />
          Back to legal hub
        </Link>
        <div className="nwld-head-row">
          <div className="nwld-head-copy">
            <div className="nwld-chips">
              {section ? (
                <span className="nwld-chip">
                  <LegalIcon name={section.icon} size={13} />
                  {section.label}
                </span>
              ) : null}
              <span className="nw-mono nwld-publication">Navigate Wealth legal publication</span>
            </div>
            <h1 className="nwld-h1">{title}</h1>
            {description ? <p className="nwld-desc">{description}</p> : null}
          </div>
          {action ? <div className="nwld-head-actions">{action}</div> : null}
        </div>
        {children}
      </div>
    </header>
  );
}

interface LegalDocFactsProps {
  effective: string;
  updated: string;
  version: string;
}

/** The three tiles under the title: effective date, last updated, version. */
export function LegalDocFacts({ effective, updated, version }: LegalDocFactsProps) {
  return (
    <dl className="nwld-facts">
      <div className="nwld-fact">
        <dt className="nw-mono nwld-fact-t">
          <LegalIcon name="calendar" size={13} stroke="#0D1626" />
          Effective date
        </dt>
        <dd className="nwld-fact-d">{effective}</dd>
      </div>
      <div className="nwld-fact">
        <dt className="nw-mono nwld-fact-t">
          <LegalIcon name="refresh" size={13} stroke="#0D1626" />
          Last updated
        </dt>
        <dd className="nwld-fact-d">{updated}</dd>
      </div>
      <div className="nwld-fact">
        <dt className="nw-mono nwld-fact-t">
          <LegalIcon name="shieldCheck" size={13} stroke="#0D1626" />
          <span className="nwld-hide-md">Reader mode</span>
          <span className="nwld-show-md">Version</span>
        </dt>
        <dd className="nwld-fact-d">Version {version}</dd>
      </div>
    </dl>
  );
}
