/**
 * ForgotPasswordBrand — the navy panel beside the forgot-password form: the
 * three ways a reset is kept safe while the form is open, and the "sent
 * securely" note once the link has gone. The words are the live page's
 * (ForgotPasswordPage.tsx); the layout is the "ForgotPassword" board's. Hidden
 * on phones, as the board hides it.
 */
import { ForgotPasswordIcon, type ForgotPasswordIconName } from './ForgotPasswordIcons';
import '../styles/sections.css';
import '../styles/forgot-password.css';

const SAFEGUARDS: readonly { icon: ForgotPasswordIconName; title: string; text: string }[] = [
  {
    icon: 'lock',
    title: 'Bank-Level Encryption',
    text: '256-bit SSL encryption protects your data and reset tokens at all times.',
  },
  {
    icon: 'clock',
    title: 'Time-Limited Tokens',
    text: 'Reset links expire after 15 minutes to prevent unauthorized access.',
  },
  {
    icon: 'userCheck',
    title: 'Verified Access Only',
    text: 'Only registered email addresses can receive password reset links.',
  },
];

interface ForgotPasswordBrandProps {
  /** True once the reset link has been requested. */
  sent: boolean;
  /** "Proudly South African · FSP No. …", from companyFacts. */
  footnote: string;
}

/** The compass rings drawn in the panel's lower right corner. */
function CompassArt() {
  return (
    <svg
      className="nwfp-brand-art"
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
        stroke="rgba(201,209,224,0.3)"
        strokeWidth="16"
        strokeDasharray="2 106.92"
      />
      <polygon
        points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
        stroke="rgba(255,255,255,0.14)"
      />
    </svg>
  );
}

export function ForgotPasswordBrand({ sent, footnote }: ForgotPasswordBrandProps) {
  return (
    <div className="nwfp-brand">
      <div className="nw-grid-bg" aria-hidden="true" />
      <CompassArt />

      {sent ? (
        <div className="nwfp-brand-body nw-in">
          <span className="nwfp-shield" aria-hidden="true">
            <ForgotPasswordIcon name="shieldCheck" size={26} />
          </span>
          <h2 className="nwfp-brand-title nwfp-brand-title--sent">
            Reset link sent <span className="nw-accent">securely</span>
          </h2>
          <p className="nwfp-brand-lead">
            Your password reset request has been processed with our highest security standards.
          </p>
          <div className="nwfp-level">
            <div className="nwfp-level-row">
              <span className="nwfp-level-label">Security Level</span>
              <span className="nwfp-level-value nw-mono">Maximum</span>
            </div>
            <div className="nwfp-level-bar" aria-hidden="true">
              <div className="nwfp-level-fill" />
            </div>
            <p className="nwfp-level-note">Your account is protected with bank-level security</p>
          </div>
        </div>
      ) : (
        <div className="nwfp-brand-body">
          <h2 className="nwfp-brand-title">
            Secure Account <span className="nw-accent">Recovery</span>
          </h2>
          <p className="nwfp-brand-lead">
            We take your security seriously with industry-leading protection measures.
          </p>
          <ul className="nwfp-safeguards">
            {SAFEGUARDS.map((item) => (
              <li key={item.title} className="nwfp-safeguard">
                <span className="nwfp-safeguard-icon" aria-hidden="true">
                  <ForgotPasswordIcon name={item.icon} size={20} />
                </span>
                <div>
                  <h3 className="nwfp-safeguard-title">{item.title}</h3>
                  <p className="nwfp-safeguard-text">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="nwfp-footnote nw-mono">{footnote}</p>
    </div>
  );
}
