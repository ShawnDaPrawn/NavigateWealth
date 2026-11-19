/**
 * LinksCard — the /links page's card when the links have loaded: the bio, the
 * licence chips, the social profiles, the quick contact row and every link,
 * each opening in a new tab. LinksEmpty is the same card when no link is
 * published yet.
 *
 * The links, the bio, the custom title and the social profiles are whatever
 * the admin Linktree manager publishes; the chips and the quick contact row
 * are the firm's own details from companyFacts.ts and siteLinks.ts.
 */
import { COMPANY } from '../../config/companyFacts';
import { WHATSAPP_HREF } from '../siteLinks';
import { LinksIcon, type LinksIconName } from './LinksIcons';
import '../styles/links.css';

export interface LinksSocial {
  key: string;
  label: string;
  url: string;
  icon: LinksIconName;
}

export interface LinksItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  display: string;
  icon: LinksIconName;
}

function Kicker() {
  return <p className="nw-mono nwlk-kicker">Official links</p>;
}

/** The admin's own page title, when it is not just the firm's name. */
function CustomTitle({ title }: { title?: string }) {
  return title ? <h1 className="nwlk-title">{title}</h1> : null;
}

function Socials({ socials }: { socials: LinksSocial[] }) {
  if (socials.length === 0) return null;
  return (
    <div className="nwlk-socials">
      {socials.map((s) => (
        <a
          key={s.key}
          className="nwlk-social"
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          title={s.label}
        >
          <LinksIcon name={s.icon} size={18} />
        </a>
      ))}
    </div>
  );
}

interface LinksCardProps {
  title?: string;
  bio: string;
  socials: LinksSocial[];
  links: LinksItem[];
  clickedId: string | null;
  onLinkClick: (id: string) => void;
}

export function LinksCard({ title, bio, socials, links, clickedId, onLinkClick }: LinksCardProps) {
  return (
    <section className="nwlk-state nwlk-rise" aria-label="Links">
      <div className="nwlk-card">
        <div className="nwlk-intro">
          <Kicker />
          <CustomTitle title={title} />
          <p className="nwlk-bio">{bio}</p>
          <div className="nwlk-chips">
            <span className="nwlk-chip nwlk-chip--accent">
              <LinksIcon name="shield" size={15} stroke="#0D1626" />
              FSCA Regulated
            </span>
            <span className="nwlk-chip">
              <LinksIcon name="globe" size={15} stroke="#12203A" />
              FSP {COMPANY.fspNumber}
            </span>
            <span className="nwlk-chip">
              <LinksIcon name="mapPin" size={15} stroke="#12203A" />
              South Africa
            </span>
          </div>
          <Socials socials={socials} />
        </div>

        <div className="nwlk-rule" aria-hidden="true" />

        <div className="nwlk-quick-row">
          <a
            className="nwlk-quick"
            href={COMPANY.phone.tel}
            aria-label={`Call ${COMPANY.phone.display}`}
          >
            <LinksIcon name="phone" size={18} stroke="#0D1626" />
            Call
          </a>
          <a
            className="nwlk-quick"
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${COMPANY.tradingName}`}
          >
            <LinksIcon name="message" size={18} stroke="#15803D" />
            WhatsApp
          </a>
          <a
            className="nwlk-quick"
            href={`mailto:${COMPANY.email}`}
            aria-label={`Email ${COMPANY.email}`}
          >
            <LinksIcon name="mail" size={18} stroke="#0D1626" />
            Email
          </a>
        </div>

        <div className="nwlk-list-head">
          <p className="nwlk-list-t">Links</p>
          <span className="nw-mono nwlk-list-n">
            {links.length} {links.length === 1 ? 'destination' : 'destinations'}
          </span>
        </div>

        <div className="nwlk-list">
          {links.map((link, index) => (
            <a
              key={link.id}
              className={`nwlk-link${clickedId === link.id ? ' nwlk-link-on' : ''}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onLinkClick(link.id)}
            >
              <span className={`nwlk-tile nwlk-tile--${index % 4}`}>
                <LinksIcon name={link.icon} size={20} />
              </span>
              <span className="nwlk-link-copy">
                <span className="nwlk-link-t">{link.title}</span>
                {link.description ? <span className="nwlk-link-d">{link.description}</span> : null}
                <span className="nw-mono nwlk-link-u">{link.display}</span>
              </span>
              <span className="nwlk-go" aria-hidden="true">
                <LinksIcon name="arrowUpRight" size={17} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

interface LinksEmptyProps {
  title?: string;
  socials: LinksSocial[];
}

/**
 * No link published. The board's empty card, plus the social profiles when
 * there are any, so the page never hides a link the live page shows.
 */
export function LinksEmpty({ title, socials }: LinksEmptyProps) {
  return (
    <section className="nwlk-state" aria-label="Links">
      <div className="nwlk-card nwlk-card--empty">
        <Kicker />
        <CustomTitle title={title} />
        <Socials socials={socials} />
        <div className="nwlk-empty">
          <span className="nwlk-empty-ic">
            <LinksIcon name="link" size={20} />
          </span>
          <p className="nwlk-empty-t">No links available yet.</p>
          <p className="nwlk-empty-p">Check back soon.</p>
        </div>
      </div>
    </section>
  );
}
