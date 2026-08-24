/**
 * The Sign-In Email card of the client security tab: current address,
 * change request, verification code entry, and resend. JSX moved verbatim
 * from SecurityTab.tsx; every captured name became a prop.
 */
import React from 'react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-In Email</CardTitle>
        <CardDescription>
          Update the client&apos;s authentication email while preserving the existing verification
          flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          Changes do not complete immediately. The current address receives a notice, and the client
          must provide the code sent to the new email before sign-in switches over.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currentClientAuthEmail">Current sign-in email</Label>
            <Input
              id="currentClientAuthEmail"
              value={currentAuthEmail}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
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
        </div>

        {hasPendingEmailChange && (
          <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Verification pending</p>
                <p className="text-xs text-muted-foreground">
                  Waiting for the code sent to {securityStatus.pendingEmailChange?.newEmail}.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-amber-200 text-amber-700">
                Pending
              </Badge>
            </div>

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

        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasPendingEmailChange ? (
            <>
              <Button
                variant="outline"
                onClick={handleResendEmailChangeCode}
                disabled={activeAction === 'emailResend' || activeAction === 'emailVerify'}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${activeAction === 'emailResend' ? 'animate-spin' : ''}`}
                />
                Resend Code
              </Button>
              <Button
                onClick={handleVerifyEmailChange}
                disabled={
                  activeAction === 'emailVerify' || activeAction === 'emailResend' || !newEmailCode
                }
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Email Change
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={handleRequestEmailChange}
              disabled={activeAction === 'emailRequest' || !newEmail}
            >
              <Mail className="mr-2 h-4 w-4" />
              Start Email Change
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
