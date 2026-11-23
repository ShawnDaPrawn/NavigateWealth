import { useState, type ReactNode } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { VaultLockState } from '../../../shared/password-manager';
import { sendTwoFactorCode, unlockVault, verifyTwoFactorCode } from './vaultApi';
import { ErrorLine, useAction } from './ui';

/** Where the signed-in person turns on two-factor for their account. */
export const SECURITY_SETTINGS_URL = '/security';

export default function UnlockGate({
  state,
  userId,
  loadError,
  onRetry,
  onUnlocked,
}: {
  state: VaultLockState | null;
  userId: string | null;
  loadError: string;
  onRetry: () => void;
  onUnlocked: (state: VaultLockState) => void;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();

  if (loadError)
    return (
      <Shell title="Could not check the vault">
        <ErrorLine>{loadError}</ErrorLine>
        <Button onClick={onRetry}>Try again</Button>
      </Shell>
    );
  if (!state)
    return (
      <Shell title="Checking the vault">
        <p role="status" className="text-sm text-muted-foreground">
          Loading…
        </p>
      </Shell>
    );
  if (!state.twoFactorEnabled)
    return (
      <Shell title="Turn on two-factor to open the vault">
        <p className="text-sm text-muted-foreground">
          The password manager opens only after you confirm a code sent to your email. Turn on
          two-factor sign-in in your account security settings, then come back here.
        </p>
        <Button asChild>
          <a href={SECURITY_SETTINGS_URL}>Open security settings</a>
        </Button>
      </Shell>
    );

  return (
    <Shell title="Unlock the vault">
      <p className="text-sm text-muted-foreground">
        We will email you a 6-digit code. The vault stays open while you use it and locks after 15
        idle minutes.
      </p>
      <ErrorLine>{error}</ErrorLine>
      {!userId && <ErrorLine>Your account could not be identified. Sign in again.</ErrorLine>}
      {!sent ? (
        <Button
          disabled={busy || !userId}
          onClick={() =>
            void run(async () => {
              await sendTwoFactorCode(userId!);
              setSent(true);
            }, 'Could not send a code. Try again.')
          }
        >
          Send code
        </Button>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await verifyTwoFactorCode(userId!, code);
              onUnlocked(await unlockVault());
            }, 'That code did not work. Check it and try again.');
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            Verification code
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || code.length !== 6}>Unlock</Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setCode('');
                  await sendTwoFactorCode(userId!);
                }, 'Could not send a code. Try again.')
              }
            >
              Send a new code
            </Button>
          </div>
        </form>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <section
        aria-labelledby="vault-gate-title"
        className="grid w-full max-w-md gap-4 rounded-lg border bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-2">
          {title.startsWith('Unlock') ? (
            <LockKeyhole className="size-5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-5" aria-hidden="true" />
          )}
          <h2 id="vault-gate-title" className="text-lg font-semibold">
            {title}
          </h2>
        </div>
        {children}
      </section>
    </div>
  );
}
