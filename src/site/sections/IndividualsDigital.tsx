/**
 * "Digital Convenience, Human Touch": a drawing of the client portal (pure
 * decoration, hidden from assistive technology) beside the copy and the four
 * digital features.
 */
import type { LucideIcon } from 'lucide-react';
import { IndividualsIcon } from './IndividualsIcons';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/for-individuals.css';

interface IndividualsDigitalProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  body: string;
  features: readonly { icon: LucideIcon; title: string; description: string }[];
}

/** The portal's look, drawn in placeholder bars; nothing in it is real data. */
function PortalSketch() {
  return (
    <div className="nwfi-portal" aria-hidden="true">
      <div className="nw-grid-bg nwfi-portal-gridbg" />
      <div className="nwfi-portal-win">
        <div className="nwfi-portal-side">
          <div className="nw-mono nwfi-portal-brand">CLIENT PORTAL</div>
          <div className="nwfi-portal-nav nwfi-portal-nav--on">Policies</div>
          <div className="nwfi-portal-nav">Documents</div>
          <div className="nwfi-portal-nav">Messages</div>
          <div className="nwfi-portal-nav">E-signatures</div>
        </div>
        <div className="nwfi-portal-main">
          <div className="nwfi-portal-top">
            <div className="nwfi-bar nwfi-bar--title" />
            <div className="nwfi-portal-avatar" />
          </div>
          <div className="nwfi-portal-tiles">
            <div className="nwfi-portal-tile">
              <div className="nwfi-portal-sq" />
              <div className="nwfi-bar nwfi-bar--strong" style={{ width: '70%' }} />
              <div className="nwfi-bar nwfi-bar--soft" style={{ width: '45%' }} />
            </div>
            <div className="nwfi-portal-tile">
              <div className="nwfi-portal-sq nwfi-portal-sq--ok" />
              <div className="nwfi-bar nwfi-bar--strong" style={{ width: '60%' }} />
              <div className="nwfi-bar nwfi-bar--soft" style={{ width: '50%' }} />
            </div>
          </div>
          <div className="nwfi-portal-row">
            <div className="nwfi-portal-doc" />
            <div className="nwfi-portal-lines">
              <div className="nwfi-bar nwfi-bar--strong" style={{ width: '60%' }} />
              <div className="nwfi-bar nwfi-bar--soft nwfi-bar--tight" style={{ width: '35%' }} />
            </div>
            <span className="nwfi-portal-tag nwfi-portal-tag--ok">Signed</span>
          </div>
          <div className="nwfi-portal-row">
            <div className="nwfi-portal-doc" />
            <div className="nwfi-portal-lines">
              <div className="nwfi-bar nwfi-bar--strong" style={{ width: '50%' }} />
              <div className="nwfi-bar nwfi-bar--soft nwfi-bar--tight" style={{ width: '30%' }} />
            </div>
            <span className="nwfi-portal-tag">New</span>
          </div>
          <div className="nwfi-portal-input">
            <div className="nwfi-portal-dot" />
            <div className="nwfi-portal-field" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function IndividualsDigital({
  index,
  kicker,
  title,
  lead,
  body,
  features,
}: IndividualsDigitalProps) {
  return (
    <section className="nw-sec nwfi-white" aria-labelledby="nwfi-digital-title">
      <div className="nw-wrap nwfi-split">
        <PortalSketch />
        <div>
          <SectionHead
            index={index}
            kicker={kicker}
            title={title}
            lead={lead}
            titleId="nwfi-digital-title"
            className="nwfi-head--long"
          />
          <p className="nwfi-digital-body">{body}</p>
          <ul className="nwfi-feats">
            {features.map(({ icon, title: feature, description }) => (
              <li key={feature} className="nwfi-feat">
                <span className="nwfi-feat-icon" aria-hidden="true">
                  <IndividualsIcon icon={icon} size={18} />
                </span>
                <span>
                  <span className="nwfi-feat-t">{feature}</span>
                  <span className="nwfi-feat-d">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
