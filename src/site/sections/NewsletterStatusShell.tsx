/**
 * The frame the three newsletter status boards share — "Newsletter Confirm",
 * "Newsletter Unsubscribe" and "Newsletter Click": a ruled paper page with its
 * own small header (the logo and a "Newsletter" label) and one copyright line,
 * not the site's header and footer, around a single card with a coloured rule
 * across its top. The routes render outside MainLayout, so this frame also
 * carries the `.nw-site` scope the Navigator styles need.
 *
 * Also here: the round badge each state opens with, and the "Need help?" line
 * under the card's content.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import siteLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { COMPANY } from '../../config/companyFacts';
import { NewsletterStatusIcon, type NewsletterStatusIconName } from './NewsletterStatusIcons';

/**
 * The rule across the top of the card. `track` is the click page's moving
 * bar, drawn while the link is being looked up.
 */
export type NewsletterStatusAccent = 'ink' | 'wait' | 'success' | 'warn' | 'danger' | 'quiet';

interface NewsletterStatusShellProps {
  /** The small label at the right of the header. */
  label: string;
  accent: NewsletterStatusAccent | 'track';
  /** The click board's card is 440px wide; the others are 480px. */
  narrow?: boolean;
  /** The confirm board's page glow is a touch stronger than the others'. */
  bright?: boolean;
  /** The click board lays its card out as a centred column. */
  column?: boolean;
  children: ReactNode;
}

export function NewsletterStatusShell({
  label,
  accent,
  narrow = false,
  bright = false,
  column = false,
  children,
}: NewsletterStatusShellProps) {
  const year = new Date().getFullYear();
  return (
    <div className={`nw-site nwnl${bright ? ' nwnl--bright' : ''}`}>
      <header className="nwnl-head">
        <Link to="/" className="nwnl-logo" aria-label={`${COMPANY.tradingName} home`}>
          <img src={siteLogo} alt="" />
        </Link>
        <span className="nwnl-label nwnl-mono">{label}</span>
      </header>

      <main className="nwnl-main">
        <div className={`nwnl-card${narrow ? ' nwnl-card--narrow' : ''}`}>
          {accent === 'track' ? (
            <div className="nwnl-rule nwnl-rule--track" aria-hidden="true">
              <div className="nwnl-track" />
            </div>
          ) : (
            <div className={`nwnl-rule nwnl-rule--${accent}`} aria-hidden="true" />
          )}
          <div className={column ? 'nwnl-body nwnl-body--column' : 'nwnl-body'}>{children}</div>
        </div>
      </main>

      <footer className="nwnl-foot nwnl-mono">
        © {year} {COMPANY.legalName} t/a {COMPANY.tradingName} · FSP {COMPANY.fspNumber} ·{' '}
        <Link to="/legal">Legal</Link>
      </footer>
    </div>
  );
}

export type NewsletterStatusBadgeTone = 'plain' | 'ring' | 'success' | 'warn' | 'danger' | 'quiet';

interface NewsletterStatusBadgeProps {
  icon: NewsletterStatusIconName;
  /** The boards draw each badge's icon at its own size and in a fixed colour. */
  iconSize: number;
  stroke: string;
  tone: NewsletterStatusBadgeTone;
  /** 64px, as on the click board, rather than 72px. */
  small?: boolean;
}

export function NewsletterStatusBadge({
  icon,
  iconSize,
  stroke,
  tone,
  small = false,
}: NewsletterStatusBadgeProps) {
  return (
    <div className={`nwnl-badge nwnl-badge--${tone}${small ? ' nwnl-badge--sm' : ''}`}>
      <NewsletterStatusIcon
        name={icon}
        size={iconSize}
        stroke={stroke}
        className={icon === 'spinner' ? 'nwnl-spin' : undefined}
      />
    </div>
  );
}

/** The live pages' help line, in every state as the boards draw it. */
export function NewsletterStatusHelp() {
  return (
    <p className="nwnl-help">
      Need help? Contact us at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
    </p>
  );
}
