/**
 * Page frames for the Navigator account pages.
 *
 * - AccountSplit: the chart-paper stage with a white card — form on the right,
 *   brand panel on the left from tablet up (login, signup, forgot password).
 *   These routes sit inside the site layout, which supplies header and footer.
 * - AccountSolo: a standalone page — logo, one card, compliance line — for the
 *   routes that render without the site chrome (reset password, verify email,
 *   verification success).
 * - AccountAppShell: the installed-app (PWA) frame for login, signup and forgot
 *   password, which MainLayout renders without the marketing chrome.
 *
 * Each frame's root carries `nw-site` itself, because a signed-in visitor gets
 * the portal layout rather than the Navigator one.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CheckCircle, Lock, Shield } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { COMPANY } from '../../config/companyFacts';

/** The installed app's icon, as the live auth screens show it. */
const APP_ICON_SRC = '/maskable-icon-512x512.png?v=20260922';

interface AccountSplitProps {
  /** `nwx-<page>` class for the page root. */
  pageClass: string;
  brand: ReactNode;
  children: ReactNode;
  /** The password-recovery boards' flatter card and single-weight grid. */
  quiet?: boolean;
  /** Signup's taller card. */
  tall?: boolean;
}

export function AccountSplit({ pageClass, brand, children, quiet, tall }: AccountSplitProps) {
  const card = ['nwac-split', quiet ? 'nwac-split--quiet' : '', tall ? 'nwac-split--tall' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`nw-site nwx-account ${pageClass}`}>
      <div className={quiet ? 'nwac-stage nwac-stage--quiet' : 'nwac-stage'}>
        <div className="nw-wrap">
          <div className={card}>
            <div className="nwac-main">{children}</div>
            {brand}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AccountSoloProps {
  pageClass: string;
  children: ReactNode;
  /** Between the logo and the card (the verify page's progress steps). */
  above?: ReactNode;
  /** Between the card and the compliance line. */
  below?: ReactNode;
  /** Colour of the card's top rule. */
  rule?: 'ink' | 'success';
  /** The installed app shows its icon above the logo, as the live page does. */
  showAppIcon?: boolean;
}

export function AccountSolo({
  pageClass,
  children,
  above,
  below,
  rule = 'ink',
  showAppIcon = false,
}: AccountSoloProps) {
  return (
    <div className={`nw-site nwx-account ${pageClass} nwac-solo`}>
      <Link to="/" className="nwac-home" aria-label="Navigate Wealth home">
        {showAppIcon ? (
          <img src={APP_ICON_SRC} alt="" width={56} height={56} className="nwac-home-icon" />
        ) : null}
        <Logo />
      </Link>
      {above}
      <div className="nwac-card">
        <div className={`nwac-card-rule nwac-card-rule--${rule}`} aria-hidden="true" />
        <div className="nwac-card-body">{children}</div>
      </div>
      {below}
      <p className="nwac-solo-fsp nw-mono">Proudly South African · FSP No. {COMPANY.fspNumber}</p>
    </div>
  );
}

export function AccountAppShell({
  pageClass,
  children,
}: {
  pageClass: string;
  children: ReactNode;
}) {
  return (
    <div className={`nw-site nwx-account ${pageClass} nwac-app`}>
      <div className="nwac-app-inner">
        <div className="nwac-app-brand">
          <img src={APP_ICON_SRC} alt="" width={64} height={64} className="nwac-app-icon" />
          <p className="nwac-app-name">Navigate Wealth</p>
          <p className="nwac-app-cap">Client Portal</p>
        </div>
        <div className="nwac-app-card">{children}</div>
      </div>
    </div>
  );
}

/**
 * The installed app's Sign In / Sign Up switch. The two are separate routes,
 * so this is navigation (links with aria-current), not a tab set.
 */
export function AccountModeSwitch({ active }: { active: 'signin' | 'signup' }) {
  return (
    <nav className="nwac-mode" aria-label="Sign in or sign up">
      <Link to="/login" aria-current={active === 'signin' ? 'page' : undefined}>
        Sign In
      </Link>
      <Link to="/signup" aria-current={active === 'signup' ? 'page' : undefined}>
        Sign Up
      </Link>
    </nav>
  );
}

const TRUST_ITEMS = [
  { label: `FSP ${COMPANY.fspNumber}`, icon: Shield },
  { label: 'FSCA Regulated', icon: CheckCircle },
  { label: 'POPIA Compliant', icon: Lock },
] as const;

/**
 * Regulation and data-protection line under the form. The brand panel carries
 * the same reassurance from tablet up, so it shows on phones only — except in
 * the installed app, which has no brand panel.
 */
export function AccountTrustLine({ always = false }: { always?: boolean }) {
  return (
    <ul
      className={always ? 'nwac-trust nwac-trust--always' : 'nwac-trust'}
      aria-label="Regulation and data protection"
    >
      {TRUST_ITEMS.map(({ label, icon: Icon }) => (
        <li key={label}>
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
