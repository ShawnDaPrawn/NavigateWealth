/**
 * Small pieces shared by the Navigator home and services pages: the trust
 * strip under each hero, the "call / email / office" strip beside each call
 * to action, and the stretched card link.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Mail, MapPin, Phone } from 'lucide-react';
import { COMPANY, TRUST_FACTS } from '../../config/companyFacts';

/** The firm's checkable credentials, as the live pages' stats strip shows them. */
export function TrustStrip() {
  return (
    <ul className="nwhm-trust" aria-label="Credentials">
      {TRUST_FACTS.map((fact) => (
        <li key={fact.value}>
          <span className="nwhm-trust-i" aria-hidden="true">
            <fact.icon size={19} strokeWidth={1.75} />
          </span>
          <span>
            <span className="nwhm-trust-v">{fact.value}</span>
            <span className="nwhm-trust-l">{fact.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Call, email and office — the contact strip beside each closing call to action. */
export function ContactStrip({ center }: { center?: boolean }) {
  return (
    <ul className={center ? 'nwhm-contact nwhm-contact--center' : 'nwhm-contact'}>
      <li>
        <a href={COMPANY.phone.tel}>
          <span className="nwhm-contact-i" aria-hidden="true">
            <Phone size={17} strokeWidth={1.75} />
          </span>
          <span>
            <span className="nwhm-contact-l nw-mono">Call us</span>
            <span className="nwhm-contact-v">{COMPANY.phone.display}</span>
          </span>
        </a>
      </li>
      <li>
        <a href={`mailto:${COMPANY.email}`}>
          <span className="nwhm-contact-i" aria-hidden="true">
            <Mail size={17} strokeWidth={1.75} />
          </span>
          <span>
            <span className="nwhm-contact-l nw-mono">Email</span>
            <span className="nwhm-contact-v">{COMPANY.email}</span>
          </span>
        </a>
      </li>
      <li>
        <span className="nwhm-contact-i" aria-hidden="true">
          <MapPin size={17} strokeWidth={1.75} />
        </span>
        <span>
          <span className="nwhm-contact-l nw-mono">Office</span>
          <span className="nwhm-contact-v">{COMPANY.address.city}</span>
        </span>
      </li>
    </ul>
  );
}

/**
 * A card's one link, on its heading. Its hit area stretches over the whole
 * card (the card must be `position: relative`), so the card is clickable
 * while the link's name stays the heading rather than every line of the card.
 */
export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="nwhm-stretch">
      {children}
    </Link>
  );
}
