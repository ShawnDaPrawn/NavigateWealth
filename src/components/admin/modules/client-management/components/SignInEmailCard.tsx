/**
 * The Sign-In Email card of the client security tab: current address,
 * change request, verification code entry, and resend. JSX moved verbatim
 * from SecurityTab.tsx; every captured name became a prop.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { VerificationCodeField } from '../../../../security/VerificationCodeField';
import type { SecurityAction, SecurityStatus } from './securityTabModel';

interface SignInEmailCardProps {
  currentAuthEmail: string;
  securityStatus: SecurityStatus;
  hasPendingEmailChange: boolean;
  activeAction: SecurityAction;
  newEmail: string;
  setNewEmail: React.Dispatch<React.SetStateAction<string>>;
  newEmailCode: string;
  setNewEmailCode: React.Dispatch<React.SetStateAction<string>>;
  handleRequestEmailChange: () => Promise<void>;
  handleVerifyEmailChange: () => Promise<void>;
  handleResendEmailChangeCode: () => Promise<void>;
}

export function SignInEmailCard({
  currentAuthEmail,
  securityStatus,
  hasPendingEmailChange,
  activeAction,
  newEmail,
  setNewEmail,
  newEmailCode,
  setNewEmailCode,
  handleRequestEmailChange,
  handleVerifyEmailChange,
  handleResendEmailChangeCode,
}: SignInEmailCardProps) {
  const [open, setOpen] = useState(false);
  // A change that completes (or is cancelled on the server) closes the dialog.
  const wasPending = useRef(hasPendingEmailChange);
  useEffect(() => {
    if (wasPending.current && !hasPendingEmailChange) setOpen(false);
    wasPending.current = hasPendingEmailChange;
  }, [hasPendingEmailChange]);

  return (
    <section aria-label="Sign-in email" className="rounded-xl border border-nw-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-nw-line-2 px-5 py-3.5">
        <h3 className="text-[15px] font-semibold text-nw-ink">Sign-in email</h3>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {hasPendingEmailChange ? 'Enter code' : 'Change email'}
        </Button>
      </div>
      <div className="space-y-1 px-5 py-4">
        <p className="break-all text-sm font-medium text-nw-ink">{currentAuthEmail}</p>
        {hasPendingEmailChange ? (
          <p className="text-xs text-nw-amber-700">
            Verification pending — waiting for the code sent to{' '}
            {securityStatus.pendingEmailChange?.newEmail}.
          </p>
        ) : (
          <p className="text-xs text-nw-text-3">
            Changing it sends a verification code to the new address; the change completes once the
            code is entered (resend available).
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change sign-in email</DialogTitle>
            <DialogDescription>
              The current address receives a notice, and the client must give you the code sent to
              the new email before sign-in switches over.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentClientAuthEmail">Current sign-in email</Label>
              <Input
                id="currentClientAuthEmail"
                value={currentAuthEmail}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newClientAuthEmail">New sign-in email</Label>
              <Input
                id="newClientAuthEmail"
                type="email"
                value={securityStatus.pendingEmailChange?.newEmail || newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={hasPendingEmailChange || activeAction === 'emailRequest'}
                placeholder="client@example.com"
              />
            </div>
            {hasPendingEmailChange && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-sm text-nw-amber-700">
                  <span className="font-semibold">Verification pending</span> — Waiting for the code
                  sent to {securityStatus.pendingEmailChange?.newEmail}.
                </p>
                <VerificationCodeField
                  id="adminNewEmailCode"
                  label="Verification code from the new email"
                  description="Ask the client for the 6-digit code sent to the new email address."
                  value={newEmailCode}
                  onChange={setNewEmailCode}
                  disabled={activeAction === 'emailVerify' || activeAction === 'emailResend'}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {hasPendingEmailChange && (
              <Button
                variant="outline"
                onClick={handleResendEmailChangeCode}
                disabled={activeAction === 'emailResend' || activeAction === 'emailVerify'}
                className="sm:mr-auto"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${activeAction === 'emailResend' ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Resend code
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {hasPendingEmailChange ? (
              <Button
                onClick={handleVerifyEmailChange}
                disabled={
                  activeAction === 'emailVerify' || activeAction === 'emailResend' || !newEmailCode
                }
              >
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Confirm email change
              </Button>
            ) : (
              <Button
                onClick={handleRequestEmailChange}
                disabled={activeAction === 'emailRequest' || !newEmail}
              >
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                Send verification code
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
