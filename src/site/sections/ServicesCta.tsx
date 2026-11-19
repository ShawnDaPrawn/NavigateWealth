import { Link } from 'react-router';
import { ArrowIcon } from './ServicesIcons';
import '../styles/services.css';

interface ServicesCtaProps {
  badge: string;
  title: string;
  lead: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
}

/** The closing call to action: book a consultation or ask for a quote. */
export function ServicesCta({ badge, title, lead, primary, secondary }: ServicesCtaProps) {
  return (
    <section className="nwsv-cta" aria-labelledby="nwsv-cta-title">
      <div className="nw-wrap nwsv-cta-inner">
        <p className="nwsv-cta-pill">
          <span className="nwsv-cta-dot" aria-hidden="true" />
          <span>{badge}</span>
        </p>
        <h2 id="nwsv-cta-title" className="nwsv-cta-title">
          {title}
        </h2>
        <p className="nwsv-cta-lead">{lead}</p>
        <div className="nwsv-ctas nwsv-ctas--center">
          <Link className="nw-btn nw-btn--lg" to={primary.to}>
            {primary.label} <ArrowIcon size={18} />
          </Link>
          <Link className="nw-outline nw-btn--lg" to={secondary.to}>
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
