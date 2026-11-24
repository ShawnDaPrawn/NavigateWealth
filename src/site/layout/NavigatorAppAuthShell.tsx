/**
 * NavigatorAppAuthShell — Log in and Sign up inside the installed app.
 *
 * The installed PWA opens straight onto these screens with no website header
 * or footer (MainLayout strips them), so the shell carries the brand itself:
 * the sail mark and wordmark with "Client portal" under them, a Log in / Sign
 * up switch, the form on a white card, and the firm's regulatory line, all on
 * the paper and chart grid the website's Log in page sits on. It respects the
 * device safe areas (notch, home bar).
 *
 * The forms inside are the website's own (LoginForm, SignupForm), so the
 * installed app and the browser sign in and sign up through the same code.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { COMPANY } from '../../config/companyFacts';
import { Logo } from '../../components/layout/Logo';
import { BrandLoaderMark } from '../../components/ui/brand-loader-mark';
import '../../components/ui/brand-loader.css';
import '../styles/app-auth.css';

interface NavigatorAppAuthShellProps {
  active: 'login' | 'signup';
  children: ReactNode;
}

const SWITCH: ReadonlyArray<{ key: 'login' | 'signup'; to: string; label: string }> = [
  { key: 'login', to: '/login', label: 'Log in' },
  { key: 'signup', to: '/signup', label: 'Sign up' },
];

export function NavigatorAppAuthShell({ active, children }: NavigatorAppAuthShellProps) {
  return (
    <div className="nwap nwl-tokens">
      <div className="nwap-grid" aria-hidden="true" />
      <div className="nwap-inner">
        <div className="nwap-brand">
          <BrandLoaderMark className="nwap-mark" height={52} />
          <Logo className="nwap-wordmark" />
          <p className="nwap-caption">Client portal</p>
        </div>

        <nav className="nwap-switch" aria-label="Log in or create an account">
          {SWITCH.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              replace
              className="nwap-switch-item"
              aria-current={active === item.key ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nwap-card">{children}</div>

        <ul className="nwap-trust" aria-label="Regulation">
          <li>FSP {COMPANY.fspNumber}</li>
          <li>FSCA regulated</li>
          <li>POPIA compliant</li>
        </ul>
      </div>
    </div>
  );
}
