/**
 * LoginCard — the shell the "Login" and "Signup" boards share: a paper
 * section with a white card, the dark brand panel on the left and the form on
 * the right.
 *
 * The brand panel carries the live pages' headline, line and three features
 * (authConstants.ts, which the legacy pages read too) and the firm's FSP
 * number from companyFacts. It is decorative context, hidden below 768px as
 * the boards hide it. The form comes first in the document, so the page's one
 * H1 ("Log in", "Create your account") is its first heading and screen readers
 * reach the form first; CSS `order` puts the panel back on the left.
 */
import type { ReactNode } from 'react';
import { COMPANY } from '../../config/companyFacts';
import { LoginIcon, type LoginIconName } from './LoginIcons';
import '../styles/sections.css';
import '../styles/login.css';

export interface LoginBrandFeature {
  readonly iconSlug: string;
  readonly title: string;
  readonly description: string;
}

/** authConstants' icon names, drawn with the boards' icons. */
const ICONS: Record<string, LoginIconName> = {
  Shield: 'shield',
  TrendingUp: 'trendingUp',
  Compass: 'compass',
  Target: 'target',
};

interface LoginCardProps {
  headline: string;
  lead: string;
  features: readonly LoginBrandFeature[];
  /** The sign-up board draws the card taller and its headline narrower. */
  variant?: 'login' | 'signup';
  children: ReactNode;
}

export function LoginCard({
  headline,
  lead,
  features,
  variant = 'login',
  children,
}: LoginCardProps) {
  const signup = variant === 'signup';
  return (
    <section className="nwli-sec">
      <div className="nw-wrap nwli-wrap">
        <div className={`nwli-card${signup ? ' nwli-card--tall' : ''}`}>
          <div className="nwli-main">{children}</div>

          <div className="nwli-brand">
            <div className="nw-grid-bg" aria-hidden="true" />
            <div className="nwli-glow" aria-hidden="true" />
            <svg
              className="nwli-compass"
              aria-hidden="true"
              focusable="false"
              width="420"
              height="420"
              viewBox="0 0 480 480"
              fill="none"
            >
              <circle cx="240" cy="240" r="224" stroke="rgba(255,255,255,0.1)" />
              <circle
                cx="240"
                cy="240"
                r="208"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="8"
                strokeDasharray="1 17.15"
              />
              <circle
                cx="240"
                cy="240"
                r="208"
                stroke="rgba(201, 209, 224, 0.4)"
                strokeWidth="16"
                strokeDasharray="2 106.92"
              />
              <polygon
                points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
                stroke="rgba(255,255,255,0.14)"
              />
            </svg>

            <div className="nwli-brand-body">
              <h2 className={`nwli-brand-title${signup ? ' nwli-brand-title--narrow' : ''}`}>
                {headline}
              </h2>
              <p className="nwli-brand-lead">{lead}</p>
              <ul className="nwli-feats">
                {features.map((feature) => (
                  <li key={feature.title} className="nwli-feat">
                    <span className="nwli-feat-icon">
                      <LoginIcon name={ICONS[feature.iconSlug] ?? 'shield'} size={20} />
                    </span>
                    <div>
                      <h3 className="nwli-feat-t">{feature.title}</h3>
                      <p className="nwli-feat-d">{feature.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <p className="nw-mono nwli-brand-foot">
              Proudly South African · FSP No. {COMPANY.fspNumber}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
