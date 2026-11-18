/**
 * The message box the account pages use for submit failures (an alert, read
 * out at once), confirmations (a polite status) and warnings (a plain note).
 */
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';

type Tone = 'error' | 'success' | 'warn';

const ICONS = { error: AlertCircle, success: CheckCircle2, warn: AlertTriangle } as const;
const ROLES = { error: 'alert', success: 'status', warn: undefined } as const;

interface AccountAlertProps {
  tone: Tone;
  children: ReactNode;
  id?: string;
  /** Renders a close button with this accessible name. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function AccountAlert({
  tone,
  children,
  id,
  onDismiss,
  dismissLabel = 'Close message',
}: AccountAlertProps) {
  const Icon = ICONS[tone];
  return (
    <div id={id} role={ROLES[tone]} className={`nwac-alert nwac-alert--${tone}`}>
      <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
      <div className="nwac-alert-body">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          className="nwac-alert-x"
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
