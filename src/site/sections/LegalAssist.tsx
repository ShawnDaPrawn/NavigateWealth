/**
 * LegalAssist — the hub's closing band: the live hub's "Need Legal
 * Assistance?" card, with its email address and phone number as links.
 */
import { LegalIcon } from './LegalIcons';
import { LEGAL_CONTACT } from './legalModel';

export function LegalAssist() {
  return (
    <section className="nwlg-assist">
      <div className="nw-wrap">
        <div className="nwlg-assist-card">
          <div className="nw-grid-bg" aria-hidden="true" />
          <div className="nwlg-assist-glow" aria-hidden="true" />
          <div className="nwlg-assist-copy">
            <h2 className="nwlg-assist-h2">Need Legal Assistance?</h2>
            <p className="nwlg-assist-p">
              If you have questions about any of our legal documents or need clarification on our
              policies, please don&apos;t hesitate to contact us.
            </p>
          </div>
          <div className="nwlg-assist-actions">
            <a className="nw-btn nwlg-assist-btn" href={LEGAL_CONTACT.emailHref}>
              <LegalIcon name="mail" size={17} />
              {LEGAL_CONTACT.email}
            </a>
            <a className="nw-ghost-dark nwlg-assist-btn" href={LEGAL_CONTACT.phoneHref}>
              <LegalIcon name="phone" size={17} />
              {LEGAL_CONTACT.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
