/**
 * PressContact — "Media Contact": how to reach the firm for press enquiries,
 * and the company's registered details. Every value comes from the page, which
 * reads them from companyFacts.ts.
 */
import { PressIcon } from './PressIcons';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/press.css';

export interface PressCompanyRow {
  label: string;
  value: string;
  /** Set for a value that is a link. */
  href?: string;
  /** Licence numbers are set in the tabular face. */
  mono?: boolean;
}

interface PressContactProps {
  id: string;
  index: string;
  title: string;
  lead: string;
  email: string;
  phone: { display: string; tel: string };
  responseTime: string;
  company: readonly PressCompanyRow[];
}

export function PressContact({
  id,
  index,
  title,
  lead,
  email,
  phone,
  responseTime,
  company,
}: PressContactProps) {
  return (
    <section id={id} className="nwpr2-contact" aria-labelledby="nwpr2-contact-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Contact"
          title={title}
          lead={lead}
          titleId="nwpr2-contact-title"
          center
          className="nwpr2-head-center"
        />
        <div className="nwpr2-contact-grid">
          <div className="nwpr2-card-dark">
            <div className="nw-grid-bg" aria-hidden="true" />
            <div className="nwpr2-card-dark-inner">
              <h3 className="nwpr2-card-title">
                <span className="nwpr2-card-icon nwpr2-card-icon--dark">
                  <PressIcon name="mail" size={18} />
                </span>
                Press Enquiries
              </h3>
              <div className="nwpr2-reach">
                <a href={`mailto:${email}`}>
                  <span className="nwpr2-reach-l nw-mono">Email</span>
                  <span className="nwpr2-reach-v nwpr2-reach-v--email">{email}</span>
                </a>
                <a href={phone.tel}>
                  <span className="nwpr2-reach-l nw-mono">Phone</span>
                  <span className="nwpr2-reach-v">{phone.display}</span>
                </a>
              </div>
              <p className="nwpr2-response">
                <PressIcon name="clock" size={15} stroke="#C5CAD3" />
                {responseTime}
              </p>
            </div>
          </div>

          <div className="nwpr2-card-light">
            <h3 className="nwpr2-card-title">
              <span className="nwpr2-card-icon">
                <PressIcon name="office" size={18} />
              </span>
              Company Information
            </h3>
            <dl className="nwpr2-dl">
              {company.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd
                    className={
                      row.mono ? 'nw-mono nwpr2-dd-mono' : row.href ? 'nwpr2-dd-link' : undefined
                    }
                  >
                    {row.href ? <a href={row.href}>{row.value}</a> : row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
