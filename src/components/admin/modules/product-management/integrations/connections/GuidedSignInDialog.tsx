/**
 * Guided sign-in
 * ==============
 *
 * Connecting a provider used to mean four tabs and a vocabulary nobody outside
 * this codebase has: a credential profile, a flow, a discovery run, a dry run.
 * Every one of those is an implementation detail of how the worker gets in. The
 * adviser has exactly three facts — where the portal is, who they sign in as,
 * and the PIN their phone is about to show — and this collects those three and
 * nothing else.
 *
 * The test it starts writes nothing. It opens the portal, signs in, clears the
 * verification step and stops, so it is safe to run repeatedly against a
 * provider that has not been configured at all. That is the point: the question
 * "do these credentials work" now has an answer that costs nothing to ask.
 */
import { useEffect, useState } from 'react';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '../../../../../ui/utils';
import type { PortalProviderConnection, PortalSyncJob } from '../../types';

interface GuidedSignInDialogProps {
  connection: PortalProviderConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The connection-test job in flight, when one is. */
  job?: PortalSyncJob | null;
  onSaveLoginUrl: (loginUrl: string) => Promise<void> | void;
  onSaveCredentials: (credentials: { username: string; password: string }) => Promise<void> | void;
  onStartTest: () => Promise<void> | void;
  onSubmitOtp: (otp: string) => Promise<void> | void;
  isSaving: boolean;
  isStartingTest: boolean;
  isSubmittingOtp: boolean;
}

export function GuidedSignInDialog({
  connection,
  open,
  onOpenChange,
  job,
  onSaveLoginUrl,
  onSaveCredentials,
  onStartTest,
  onSubmitOtp,
  isSaving,
  isStartingTest,
  isSubmittingOtp,
}: GuidedSignInDialogProps) {
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  // Re-seed from the connection each time the dialog opens, so re-opening it
  // after a failed attempt shows what is actually stored rather than whatever
  // was last typed.
  useEffect(() => {
    if (!open) return;
    setLoginUrl(connection?.loginUrl || '');
    setUsername('');
    setPassword('');
    setOtp('');
  }, [open, connection]);

  if (!connection) return null;

  const waitingForOtp = job?.status === 'waiting_for_otp';
  const testing = connection.state === 'testing' || (!!job && !isTerminal(job.status));
  const succeeded = !testing && connection.state === 'connected';
  const failed = !testing && connection.state === 'failed';

  const trimmedUrl = loginUrl.trim();
  const urlChanged = trimmedUrl !== (connection.loginUrl || '').trim();
  const credentialsEntered = !!username.trim() && !!password;

  const canStart =
    !testing &&
    !isSaving &&
    !isStartingTest &&
    !!trimmedUrl &&
    (connection.hasCredentials || credentialsEntered);

  /**
   * Save first, then test — and abandon the whole thing if a save fails.
   *
   * Testing after a failed save would sign in with the details the adviser has
   * just replaced and report a pass on credentials that are no longer what is
   * stored. The caller has already surfaced the failure, so the catch is silent
   * rather than a second message about the same thing.
   */
  const handleStart = async () => {
    try {
      if (urlChanged) await onSaveLoginUrl(trimmedUrl);
      if (credentialsEntered) {
        await onSaveCredentials({ username: username.trim(), password });
      }
    } catch {
      return;
    }
    await onStartTest();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Connect {connection.providerName}</DialogTitle>
          <DialogDescription>
            We will open the provider portal and sign in once, to check the details work. Nothing is
            read from the portal and no policy is changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="guided-login-url">Portal sign-in address</Label>
            <Input
              id="guided-login-url"
              value={loginUrl}
              onChange={(event) => setLoginUrl(event.target.value)}
              placeholder="https://provider.example/login"
              disabled={testing}
            />
            <p className="text-xs text-gray-500">
              The page you would normally open to sign in to this provider.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-500" />
              <Label className="mb-0">Sign-in details</Label>
            </div>
            {connection.hasCredentials && !credentialsEntered && (
              <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                A username and password are already stored for this provider. Leave these blank to
                test what is stored, or type new details to replace them.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                autoComplete="off"
                aria-label="Provider portal username"
                disabled={testing}
              />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="new-password"
                aria-label="Provider portal password"
                disabled={testing}
              />
            </div>
          </div>

          {testing && (
            <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Loader2 className="h-4 w-4 animate-spin" />
                {job?.message || 'Signing in to the provider portal.'}
              </div>

              {waitingForOtp && (
                <div className="space-y-2">
                  <Label htmlFor="guided-otp">One-time PIN</Label>
                  <div className="flex gap-2">
                    <Input
                      id="guided-otp"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder="Enter the PIN the provider sent"
                      inputMode="numeric"
                      className="max-w-[220px]"
                    />
                    <Button
                      onClick={async () => {
                        await onSubmitOtp(otp.trim());
                        setOtp('');
                      }}
                      disabled={!otp.trim() || isSubmittingOtp}
                    >
                      {isSubmittingOtp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Submit PIN'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {job?.liveView?.signedUrl && (
                <div className="space-y-1">
                  <img
                    src={job.liveView.signedUrl}
                    alt="Live view of the provider portal during sign-in"
                    className="w-full rounded border"
                  />
                  {job.liveView.note && (
                    <p className="text-xs text-gray-500">{job.liveView.note}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!testing && (succeeded || failed) && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                succeeded
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800',
              )}
            >
              {succeeded ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                {succeeded
                  ? `Signed in to ${connection.providerName} successfully.`
                  : connection.message ||
                    `Could not sign in to ${connection.providerName}. Check the address and details above.`}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {succeeded ? 'Done' : 'Close'}
          </Button>
          <Button onClick={handleStart} disabled={!canStart}>
            {isSaving || isStartingTest ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {succeeded || failed ? 'Test again' : 'Test sign-in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Job statuses that mean the worker has stopped, one way or the other. */
function isTerminal(status: PortalSyncJob['status']): boolean {
  return (
    status === 'discovery_ready' ||
    status === 'dry_run_ready' ||
    status === 'staged' ||
    status === 'failed' ||
    status === 'cancelled'
  );
}
