/**
 * The signing page's card states, as the ESign board draws them: a ruled
 * paper page with the logo, one card with a coloured band across its top,
 * and the help and "Powered by" lines under it. Here: the frame, and the
 * loading, waiting, link-unavailable and declined cards. The identity checks
 * are in ESignVerify.tsx.
 *
 * Every word is the live page's (SignerLandingPage.tsx and the signer i18n
 * dictionary), in the signer's language.
 */
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import siteLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { t, type SignerLang } from '../../components/esign-signer/i18n';
import type { SignerOrderSummary } from '../../components/esign-signer/types';
import { ESignIcon } from './ESignIcons';

export type ESignBand = 'ink' | 'warn' | 'danger' | 'muted';

interface ESignCardPageProps {
  /** The main landmark's name. */
  label: string;
  band: ESignBand;
  /** A firm's own accent, when it has set one; the band takes it. */
  bandStyle?: CSSProperties;
  lang: SignerLang;
  supportEmail: string;
  children: ReactNode;
}

export function ESignCardPage({
  label,
  band,
  bandStyle,
  lang,
  supportEmail,
  children,
}: ESignCardPageProps) {
  return (
    <div className="nw-site nwes">
      <main className="nwes-cardpage" aria-label={label}>
        <img className="nwes-logo" src={siteLogo} alt="Navigate Wealth" />
        <div className="nwes-card">
          <div className={`nwes-band nwes-band--${band}`} style={bandStyle} aria-hidden="true" />
          <div className="nwes-card-body">{children}</div>
        </div>
        <p className="nwes-help">{t('footer.support', lang, { email: supportEmail })}</p>
        <p className="nwes-powered">{t('footer.poweredBy', lang)}</p>
      </main>
    </div>
  );
}

/** A real link home that navigates in the app, as the live buttons do. */
export function HomeLink({
  className,
  onNavigate,
  children,
}: {
  className: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate();
  };
  return (
    <a className={className} href="/" onClick={onClick}>
      {children}
    </a>
  );
}

/** The board's radar: a dial with a sweeping hand. */
function Radar() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true" focusable="false">
      <circle cx="44" cy="44" r="40" fill="none" stroke="#EFEBE3" strokeWidth="1.5" />
      <circle
        cx="44"
        cy="44"
        r="40"
        fill="none"
        stroke="#D3CCBF"
        strokeWidth="6"
        strokeDasharray="1 9.47"
      />
      <g className="nwes-sweep">
        <path d="M44 44 L44 6 A38 38 0 0 1 71 17 Z" fill="#0D1626" fillOpacity="0.18" />
        <line x1="44" y1="44" x2="44" y2="8" stroke="#0D1626" strokeWidth="1.5" />
      </g>
      <circle cx="44" cy="44" r="4" fill="#0D1626" />
    </svg>
  );
}

export function ESignLoading({ lang }: { lang: SignerLang }) {
  return (
    <div className="nwes-loading" role="status" aria-live="polite">
      <Radar />
      <h1 className="nw-h nwes-title nwes-loading-title">{t('loading.title', lang)}</h1>
      <p className="nwes-loading-sub">{t('loading.subtitle', lang)}</p>
      <span className="nwes-secure">
        <ESignIcon name="lock" size={13} />
        {t('loading.secure', lang)}
      </span>
    </div>
  );
}

export function ESignExpired({
  lang,
  message,
  onHome,
}: {
  lang: SignerLang;
  message: string;
  onHome: () => void;
}) {
  return (
    <div className="nwes-end">
      <span className="nwes-end-badge nwes-end-badge--danger">
        <ESignIcon name="unlink" size={28} />
      </span>
      <h1 className="nw-h nwes-title nwes-end-title">{t('expired.title', lang)}</h1>
      <p className="nwes-end-text" role="alert">
        {message || t('expired.fallback', lang)}
      </p>
      <HomeLink className="nw-btn nwes-end-action" onNavigate={onHome}>
        {t('expired.return', lang)}
      </HomeLink>
    </div>
  );
}

export function ESignRejected({
  lang,
  title,
  onHome,
}: {
  lang: SignerLang;
  title: string;
  onHome: () => void;
}) {
  return (
    <div className="nwes-end">
      <span className="nwes-end-badge nwes-end-badge--muted">
        <ESignIcon name="xCircle" size={28} />
      </span>
      <h1 className="nw-h nwes-title nwes-end-title">{t('rejected.title', lang)}</h1>
      <p className="nwes-end-text" role="status">
        {t('rejected.body', lang, { title })}
      </p>
      <HomeLink className="nw-outline nwes-end-action" onNavigate={onHome}>
        {t('rejected.close', lang)}
      </HomeLink>
    </div>
  );
}

function signerTone(signer: SignerOrderSummary): 'signed' | 'current' | 'queued' {
  if (signer.status === 'signed') return 'signed';
  if (signer.is_current) return 'current';
  return 'queued';
}

export function ESignWaiting({
  lang,
  signers,
  email,
  onHome,
}: {
  lang: SignerLang;
  signers: SignerOrderSummary[];
  email: string | undefined;
  onHome: () => void;
}) {
  return (
    <div className="nwes-stack">
      <div className="nwes-head">
        <span className="nwes-badge nwes-badge--warn">
          <ESignIcon name="hourglass" size={26} />
        </span>
        <h1 className="nw-h nwes-head-title nwes-head-title--sm">{t('waiting.title', lang)}</h1>
        <p className="nwes-head-text">{t('waiting.body', lang)}</p>
      </div>
      {signers.length > 0 && (
        <div>
          <h2 className="nwes-order-title">{t('waiting.order', lang)}</h2>
          <ol className="nwes-order">
            {signers.map((signer) => {
              const tone = signerTone(signer);
              return (
                <li key={signer.order} className={`nwes-signer nwes-signer--${tone}`}>
                  <span className="nwes-signer-no">{signer.order}</span>
                  <span className="nwes-signer-who">
                    <span className="nwes-signer-name">
                      {signer.is_current ? `${signer.name} (You)` : signer.name}
                    </span>
                    {signer.role && <span className="nwes-signer-role">{signer.role}</span>}
                  </span>
                  <span className="nwes-signer-state">
                    {tone === 'signed' ? 'Signed' : tone === 'current' ? 'Waiting' : 'Queued'}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <div className="nwes-info">
        You will be notified by email at <strong>{email}</strong> when it is your turn to sign.
      </div>
      <HomeLink className="nw-outline nwes-wide" onNavigate={onHome}>
        Close
      </HomeLink>
    </div>
  );
}
