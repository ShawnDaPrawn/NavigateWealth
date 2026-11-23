/* eslint-disable react-refresh/only-export-components */
/** Small shared pieces for the password manager screens. */
import { useCallback, useEffect, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../../ui/utils';
import type {
  ConnectionTool,
  VaultRunState,
  CredentialHealth,
  VaultSummary,
} from '../../../shared/password-manager';
import { errorMessage } from './vaultApi';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('grid gap-1 text-sm font-medium', className)}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function ErrorLine({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
      {children}
    </p>
  );
}

/** A plain tab strip (buttons with tab semantics). */
export function TabStrip<T extends string>({
  label,
  tabs,
  value,
  onChange,
  className,
}: {
  label: string;
  tabs: ReadonlyArray<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex flex-wrap gap-1 border-b', className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={cn(
            '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab.value === value
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
          {tab.count ? (
            <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Busy flag and error message around one async action at a time. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (work: () => Promise<void>, fallback?: string) => {
    setBusy(true);
    setError('');
    try {
      await work();
      return true;
    } catch (e) {
      setError(errorMessage(e, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

/** Whole seconds left until `until` (epoch ms), ticking each second. */
export function useSecondsLeft(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

export function formatWhen(value: string | null | undefined, fallback = 'Never'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

export function formatDay(value: string | null | undefined, fallback = 'Never'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

export function formatLeft(seconds: number): string {
  if (seconds <= 0) return 'expired';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export const CLIPBOARD_CLEAR_MS = 30_000;

/** Copies text; secrets are wiped from the clipboard after 30 seconds. */
export async function copyText(text: string, secret = false): Promise<void> {
  await navigator.clipboard.writeText(text);
  if (secret)
    setTimeout(() => {
      void navigator.clipboard.writeText('').catch(() => {});
    }, CLIPBOARD_CLEAR_MS);
}

const healthLabels: Record<keyof CredentialHealth, string> = {
  reused: 'Reused',
  stale: 'Due for change',
  weak: 'Weak',
  exposed: 'Seen by AI',
};

export function healthIssues(health: CredentialHealth | undefined): string[] {
  if (!health) return [];
  return (Object.keys(healthLabels) as (keyof CredentialHealth)[])
    .filter((key) => health[key])
    .map((key) => healthLabels[key]);
}

export const needsAttention = (item: VaultSummary) => healthIssues(item.health).length > 0;

/** Strong random password from the browser's CSPRNG. */
export function generatePassword(length = 24): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => alphabet[v % alphabet.length]).join('');
}

export const splitList = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * A text box for a list. It keeps what is typed (so a trailing comma or new
 * line is not swallowed) and reports the parsed list on every change.
 */
export function ListInput({
  value,
  onChange,
  multiline = false,
  ...rest
}: {
  value: string[];
  onChange: (value: string[]) => void;
  multiline?: boolean;
  'aria-label'?: string;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const separator = multiline ? '\n' : ', ';
  const [text, setText] = useState(() => value.join(separator));
  const parse = (raw: string) =>
    raw
      .split(multiline ? '\n' : ',')
      .map((part) => part.trim())
      .filter(Boolean);
  const className = cn(
    'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20',
    rest.className,
  );
  const props = {
    ...rest,
    className,
    value: text,
    onChange: (e: { target: { value: string } }) => {
      setText(e.target.value);
      onChange(parse(e.target.value));
    },
  };
  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
}

export const toolLabels: Record<ConnectionTool, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  other: 'Other MCP client',
};

export const VAULT_MCP_ENDPOINT = 'https://www.navigatewealth.co/mcp/password-vault';

export const runStateLabels: Record<VaultRunState, string> = {
  running: 'Running',
  waiting_for_approval: 'Waiting for approval',
  held: 'Held',
  completed: 'Completed',
  failed: 'Failed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};
