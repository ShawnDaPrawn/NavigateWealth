/**
 * The dark brand panel beside the login, signup and password-recovery forms
 * (tablet and up; phones hide it and keep the form alone).
 *
 * It follows the form in the DOM so the page reads H1 → form first, and is
 * moved to the left column by CSS. It holds no focusable elements, so the
 * visual and tab orders cannot disagree.
 */
import { useId, type ComponentType, type ReactNode } from 'react';
import {
  Clock,
  Compass,
  Headphones,
  Lock,
  Shield,
  Target,
  TrendingUp,
  Users,
  type LucideProps,
} from 'lucide-react';
import { COMPANY } from '../../config/companyFacts';

const ICONS: Record<string, ComponentType<LucideProps>> = {
  Clock,
  Compass,
  Headphones,
  Lock,
  Shield,
  Target,
  TrendingUp,
  Users,
};

export interface BrandFeature {
  readonly iconSlug: string;
  readonly title: string;
  readonly description: string;
}

/** The compass rose drawn into the panel's bottom-right corner. */
function CompassMark() {
  return (
    <svg
      className="nwac-compass"
      aria-hidden="true"
      focusable="false"
      width="420"
      height="420"
      viewBox="0 0 480 480"
      fill="none"
    >
      <circle cx="240" cy="240" r="224" stroke="rgba(255,255,255,0.1)" />
      <circle
        cx="240"
        cy="240"
        r="208"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="8"
        strokeDasharray="1 17.15"
      />
      <circle
        cx="240"
        cy="240"
        r="208"
        stroke="rgba(201,209,224,0.4)"
        strokeWidth="16"
        strokeDasharray="2 106.92"
      />
      <polygon
        points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
        stroke="rgba(255,255,255,0.14)"
      />
    </svg>
  );
}

interface AccountBrandPanelProps {
  heading: ReactNode;
  lead: string;
  /** Shown above the heading (the "sent" state's tick). */
  badge?: ReactNode;
  /** Flatter variant used by the password-recovery boards. */
  quiet?: boolean;
  children?: ReactNode;
}

export function AccountBrandPanel({
  heading,
  lead,
  badge,
  quiet,
  children,
}: AccountBrandPanelProps) {
  const headingId = useId();
  return (
    <section
      className={quiet ? 'nwac-brand nwac-brand--quiet' : 'nwac-brand'}
      aria-labelledby={headingId}
    >
      <div className="nw-grid-bg" aria-hidden="true" />
      {quiet ? null : <div className="nwac-glow" aria-hidden="true" />}
      <CompassMark />
      <div className="nwac-brand-body">
        {badge}
        <h2 id={headingId} className="nwac-brand-h">
          {heading}
        </h2>
        <p className="nwac-brand-lead">{lead}</p>
        {children}
      </div>
      <p className="nwac-fsp nw-mono">Proudly South African · FSP No. {COMPANY.fspNumber}</p>
    </section>
  );
}

/** The panel's short list of reasons to trust the account area. */
export function BrandFeatureList({ items }: { items: readonly BrandFeature[] }) {
  return (
    <ul className="nwac-feats">
      {items.map((item) => {
        const Icon = ICONS[item.iconSlug] ?? Shield;
        return (
          <li key={item.title} className="nwac-feat">
            <span className="nwac-feat-i" aria-hidden="true">
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
