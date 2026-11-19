/**
 * ResetPasswordShell — the frame of the reset-password page: the logo, the
 * card with its navy top rule, and the firm's line beneath. The route renders
 * without the site's header and footer, so the page carries its own `.nw-site`
 * scope and paper background, as the "ResetPassword" board draws it.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import '../styles/reset-password.css';

interface ResetPasswordShellProps {
  children: ReactNode;
  /** "Proudly South African · FSP No. …", from companyFacts. */
  footnote: string;
}

export function ResetPasswordShell({ children, footnote }: ResetPasswordShellProps) {
  return (
    <div className="nw-site">
      <div className="nwrp">
        <Link to="/" className="nwrp-home" aria-label="Navigate Wealth home">
          <img src={navigateWealthLogo} alt="" className="nwrp-logo" decoding="async" />
        </Link>
        <div className="nwrp-card">
          <div className="nwrp-card-rule" aria-hidden="true" />
          <div className="nwrp-card-body">{children}</div>
        </div>
        <p className="nwrp-footnote nw-mono">{footnote}</p>
      </div>
    </div>
  );
}
