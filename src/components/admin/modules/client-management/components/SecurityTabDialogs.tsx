/**
 * The suspend / unsuspend / reset-password dialogs of the client security
 * tab. JSX moved verbatim from SecurityTab.tsx; every captured name became
 * a prop.
 */
import React from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Checkbox } from '../../../../ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { Ban, Eye, EyeOff, Key, RefreshCw, UserCheck } from 'lucide-react';
import type { SecurityAction, SecurityTabProps } from './securityTabModel';

interface SecurityTabDialogsProps {
  selectedClient: SecurityTabProps['selectedClient'];
  activeAction: SecurityAction;
  suspendDialogOpen: boolean;
  setSuspendDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  unsuspendDialogOpen: boolean;
  setUnsuspendDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resetPasswordDialogOpen: boolean;
  setResetPasswordDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  suspensionReason: string;
  setSuspensionReason: React.Dispatch<React.SetStateAction<string>>;
  newPassword: string;
  setNewPassword: React.Dispatch<React.SetStateAction<string>>;
  emailPasswordToClient: boolean;
  setEmailPasswordToClient: React.Dispatch<React.SetStateAction<boolean>>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  handleSuspendAccount: () => Promise<void>;
  handleUnsuspendAccount: () => Promise<void>;
  handleResetPassword: () => Promise<void>;
}

export function SecurityTabDialogs({
  selectedClient,
  activeAction,
  suspendDialogOpen,
  setSuspendDialogOpen,
  unsuspendDialogOpen,
  setUnsuspendDialogOpen,
  resetPasswordDialogOpen,
  setResetPasswordDialogOpen,
  suspensionReason,
  setSuspensionReason,
  newPassword,
  setNewPassword,
  emailPasswordToClient,
  setEmailPasswordToClient,
  showPassword,
  setShowPassword,
  handleSuspendAccount,
  handleUnsuspendAccount,
  handleResetPassword,
}: SecurityTabDialogsProps) {
  return (
    <>
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suspend Client Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend {selectedClient.firstName} {selectedClient.lastName}
              &apos;s account? They will not be able to log in until the account is unsuspended.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Suspension</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for suspending this account..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendDialogOpen(false);
                setSuspensionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspendAccount}
              disabled={activeAction === 'suspend' || !suspensionReason.trim()}
            >
              {activeAction === 'suspend' ? (
                <div className="contents">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Suspending...
                </div>
              ) : (
                <div className="contents">
                  <Ban className="mr-2 h-4 w-4" />
                  Suspend Account
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unsuspendDialogOpen} onOpenChange={setUnsuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsuspend Client Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore access for {selectedClient.firstName}{' '}
              {selectedClient.lastName}? They will be able to log in immediately after unsuspension.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsuspendAccount}
              disabled={activeAction === 'unsuspend'}
              className="bg-green-600 hover:bg-green-700"
            >
              {activeAction === 'unsuspend' ? (
                <div className="contents">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Unsuspending...
                </div>
              ) : (
                <div className="contents">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Unsuspend Account
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Client Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedClient.firstName} {selectedClient.lastName}. Make sure
              to securely communicate this password to the client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="emailPassword"
                checked={emailPasswordToClient}
                onCheckedChange={(checked) => setEmailPasswordToClient(checked as boolean)}
              />
              <Label
                htmlFor="emailPassword"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email new password to client
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordDialogOpen(false);
                setNewPassword('');
                setShowPassword(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={activeAction === 'password' || newPassword.length < 8}
            >
              {activeAction === 'password' ? (
                <div className="contents">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </div>
              ) : (
                <div className="contents">
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
