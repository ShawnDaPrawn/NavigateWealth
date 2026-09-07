import { useEffect, useState, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Switch } from '../../../../ui/switch';
import { Separator } from '../../../../ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../ui/accordion';
import { ActivityLogTable } from '../../../ActivityLogTable';
import { AlertTriangle, Ban, Key, Lock, Mail, RefreshCw, Shield, Smartphone } from 'lucide-react';
import { api } from '../../../../../utils/api/client';
import { toast } from 'sonner';
import { useAuth } from '../../../../auth/AuthContext';
import { securityService } from '../../../../../utils/auth/securityService';

import {
  formatDateTime,
  formatEventType,
  formatRelativeDate,
  type ActivityLogEntry,
  type SecurityAction,
  type SecurityStatus,
  type SecurityTabProps,
} from './securityTabModel';
import { SecurityTabDialogs } from './SecurityTabDialogs';
import { SignInEmailCard } from './SignInEmailCard';

export function SecurityTab({ selectedClient }: SecurityTabProps) {
  const { user } = useAuth();
  const [statusLoading, setStatusLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<SecurityAction>(null);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    suspended: false,
    twoFactorEnabled: false,
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [unsuspendDialogOpen, setUnsuspendDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailPasswordToClient, setEmailPasswordToClient] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  // `selectedClient.email` is the CONTACT address, which for a client enrolled
  // on a household mailbox is somebody else's. Sign-in is about the login
  // identity, so read `signInEmail` and only fall back for records fetched
  // before the field existed.
  const [currentAuthEmail, setCurrentAuthEmail] = useState(
    selectedClient.signInEmail || selectedClient.email,
  );
  const [newEmail, setNewEmail] = useState('');
  const [newEmailCode, setNewEmailCode] = useState('');
  const hasPendingEmailChange = Boolean(securityStatus.pendingEmailChange);
  /** This client signs in with a derived alias off somebody else's mailbox. */
  const sharesMailbox = Boolean(
    selectedClient.signInEmail && selectedClient.signInEmail !== selectedClient.email,
  );

  const fetchSecurityStatus = useCallback(async () => {
    if (!selectedClient?.id) return;

    try {
      setStatusLoading(true);
      const data = await api.get<{ success: boolean; status?: SecurityStatus }>(
        `/security/${selectedClient.id}/status`,
      );
      if (data.success && data.status) {
        setSecurityStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch security status:', error);
      toast.error('Failed to load security status');
    } finally {
      setStatusLoading(false);
    }
  }, [selectedClient?.id]);

  const fetchActivityLogs = useCallback(async () => {
    if (!selectedClient?.id) return;

    try {
      setActivityLoading(true);
      const data = await api.get<{ success: boolean; logs?: ActivityLogEntry[] }>(
        `/security/${selectedClient.id}/activity?limit=50`,
      );
      if (data.success) {
        setActivityLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setActivityLoading(false);
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    if (selectedClient?.id) {
      void fetchSecurityStatus();
      void fetchActivityLogs();
    }
  }, [selectedClient?.id, fetchSecurityStatus, fetchActivityLogs]);

  useEffect(() => {
    setCurrentAuthEmail(selectedClient.email);
    setNewEmail('');
    setNewEmailCode('');
  }, [selectedClient.email, selectedClient.id]);

  const handleSuspendAccount = async () => {
    if (!selectedClient?.id || !user?.id) return;

    try {
      setActiveAction('suspend');
      const data = await api.post<{ success: boolean; error?: string; status?: SecurityStatus }>(
        `/security/${selectedClient.id}/suspend`,
        {
          suspended: true,
          reason: suspensionReason,
          adminId: user.id,
        },
      );

      if (!data.success || !data.status) {
        throw new Error(data.error || 'Failed to suspend account');
      }

      setSecurityStatus(data.status);
      toast.success('Account suspended successfully');
      setSuspendDialogOpen(false);
      setSuspensionReason('');
      void fetchActivityLogs();
    } catch (error) {
      console.error('Failed to suspend account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to suspend account');
    } finally {
      setActiveAction(null);
    }
  };

  const handleUnsuspendAccount = async () => {
    if (!selectedClient?.id || !user?.id) return;

    try {
      setActiveAction('unsuspend');
      const data = await api.post<{ success: boolean; error?: string; status?: SecurityStatus }>(
        `/security/${selectedClient.id}/suspend`,
        {
          suspended: false,
          adminId: user.id,
        },
      );

      if (!data.success || !data.status) {
        throw new Error(data.error || 'Failed to unsuspend account');
      }

      setSecurityStatus(data.status);
      toast.success('Account unsuspended successfully');
      setUnsuspendDialogOpen(false);
      void fetchActivityLogs();
    } catch (error) {
      console.error('Failed to unsuspend account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unsuspend account');
    } finally {
      setActiveAction(null);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedClient?.id || !newPassword) return;

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    try {
      setActiveAction('password');
      const data = await api.post<{ success: boolean; error?: string }>(
        `/security/${selectedClient.id}/password`,
        {
          currentPassword: 'admin-override',
          newPassword,
          emailPassword: emailPasswordToClient,
        },
      );

      if (!data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success('Password reset successfully');
      setResetPasswordDialogOpen(false);
      setNewPassword('');
      setShowPassword(false);
      void fetchActivityLogs();
      void fetchSecurityStatus();
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setActiveAction(null);
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    if (!selectedClient?.id) return;

    try {
      setActiveAction('twoFactor');
      const data = await api.post<{ success: boolean; error?: string; status?: SecurityStatus }>(
        `/security/${selectedClient.id}/2fa`,
        {
          enabled,
          method: 'email',
        },
      );

      if (!data.success || !data.status) {
        throw new Error(data.error || 'Failed to toggle 2FA');
      }

      setSecurityStatus(data.status);
      toast.success(
        `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} for ${selectedClient.firstName} ${selectedClient.lastName}`,
      );
      void fetchActivityLogs();
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to toggle 2FA');
    } finally {
      setActiveAction(null);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!selectedClient?.id) return;

    const normalizedNewEmail = newEmail.trim().toLowerCase();
    const normalizedCurrentEmail = currentAuthEmail.trim().toLowerCase();

    if (!normalizedNewEmail) {
      toast.error('Enter the new email address');
      return;
    }

    if (normalizedNewEmail === normalizedCurrentEmail) {
      toast.error('New email must be different from the current email');
      return;
    }

    try {
      setActiveAction('emailRequest');
      const result = await securityService.requestEmailChange(selectedClient.id, {
        newEmail: normalizedNewEmail,
      });

      setSecurityStatus((prev) => ({
        ...prev,
        pendingEmailChange: result.pendingEmailChange ?? null,
      }));
      setNewEmailCode('');
      toast.success(
        'Verification code sent to the new email address and a notice was sent to the current address',
      );
      void fetchActivityLogs();
    } catch (error) {
      console.error('Failed to start email change:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start email change');
    } finally {
      setActiveAction(null);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!selectedClient?.id || !securityStatus.pendingEmailChange) return;
    if (!newEmailCode) {
      toast.error('Enter the code sent to the new email address');
      return;
    }

    try {
      setActiveAction('emailVerify');
      const result = await securityService.verifyEmailChange(selectedClient.id, {
        requestId: securityStatus.pendingEmailChange.requestId,
        newEmailCode,
      });

      if (result.email) {
        setCurrentAuthEmail(result.email);
      }

      setSecurityStatus((prev) => ({
        ...prev,
        pendingEmailChange: null,
      }));
      setNewEmail('');
      setNewEmailCode('');
      toast.success('Client sign-in email updated successfully');
      void fetchActivityLogs();
      void fetchSecurityStatus();
    } catch (error) {
      console.error('Failed to verify email change:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to verify email change');
    } finally {
      setActiveAction(null);
    }
  };

  const handleResendEmailChangeCode = async () => {
    if (!selectedClient?.id || !securityStatus.pendingEmailChange) return;

    try {
      setActiveAction('emailResend');
      const result = await securityService.resendEmailChangeCodes(selectedClient.id, {
        requestId: securityStatus.pendingEmailChange.requestId,
        target: 'new',
      });

      setSecurityStatus((prev) => ({
        ...prev,
        pendingEmailChange: result.pendingEmailChange ?? prev.pendingEmailChange ?? null,
      }));
      toast.success('New email verification code resent');
    } catch (error) {
      console.error('Failed to resend email change code:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resend verification code');
    } finally {
      setActiveAction(null);
    }
  };

  if (!selectedClient) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Select a client to view their security settings
      </div>
    );
  }

  const sortedActivityLogs = [...activityLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const latestActivityLog = sortedActivityLogs[0];
  const failedActivityCount = activityLogs.filter((log) => !log.success).length;
  const accountState = securityStatus.deleted
    ? 'Closed'
    : securityStatus.suspended
      ? 'Suspended'
      : 'Active';
  const accountStateBadgeClass = securityStatus.deleted
    ? 'border-slate-300 bg-slate-100 text-slate-700'
    : securityStatus.suspended
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const accountStateDescription = securityStatus.deleted
    ? 'This account has been closed and should no longer be used for sign-in.'
    : securityStatus.suspended
      ? 'Access is currently restricted until an administrator restores the account.'
      : 'Client can sign in and complete normal authenticated workflows.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-medium tracking-tight">Security Management</h3>
            <Badge variant="outline" className={accountStateBadgeClass}>
              {accountState}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage security settings for {selectedClient.firstName} {selectedClient.lastName}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void fetchSecurityStatus();
            void fetchActivityLogs();
          }}
          disabled={statusLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {securityStatus.suspended && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Suspended</AlertTitle>
          <AlertDescription>
            This account was suspended on {formatDateTime(securityStatus.suspendedAt)}. Reason:{' '}
            {securityStatus.suspendedReason || 'No reason provided'}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Security Snapshot</CardTitle>
          <CardDescription>
            A compact view of access, authentication, and sign-in details for this client.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Account Access
              </span>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-base font-semibold">{accountState}</div>
            <p className="mt-1 text-xs text-muted-foreground">{accountStateDescription}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Two-Factor Authentication
              </span>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-base font-semibold">
              {securityStatus.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {securityStatus.twoFactorEnabled
                ? 'Login requires an email verification code.'
                : 'Standard email and password sign-in only.'}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sign-In Email
              </span>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 break-all text-sm font-semibold">{currentAuthEmail}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasPendingEmailChange
                ? `Pending change to ${securityStatus.pendingEmailChange?.newEmail}`
                : sharesMailbox
                  ? `Signs in with a linked alias. Mail is delivered to ${selectedClient.email}.`
                  : 'Current authenticated email address.'}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Password Last Changed
              </span>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-base font-semibold">
              {formatRelativeDate(securityStatus.passwordLastChanged)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {securityStatus.passwordLastChanged
                ? formatDateTime(securityStatus.passwordLastChanged)
                : 'No password change date is currently recorded.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access & Authentication</CardTitle>
          <CardDescription>
            Routine sign-in controls grouped separately from destructive account actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm font-medium">Account status</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={accountStateBadgeClass}>
                {accountState}
              </Badge>
              {securityStatus.suspendedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {formatRelativeDate(securityStatus.suspendedAt)}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {securityStatus.suspended
                ? `Suspended because: ${securityStatus.suspendedReason || 'No reason provided'}.`
                : accountStateDescription}
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Two-factor authentication</p>
              <p className="text-sm text-muted-foreground">
                Require a one-time verification code sent to the client&apos;s registered email
                address during login.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={
                  securityStatus.twoFactorEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : ''
                }
              >
                {securityStatus.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch
                checked={!!securityStatus.twoFactorEnabled}
                onCheckedChange={handleToggle2FA}
                disabled={activeAction === 'twoFactor'}
                className="shrink-0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <SignInEmailCard
        currentAuthEmail={currentAuthEmail}
        securityStatus={securityStatus}
        hasPendingEmailChange={hasPendingEmailChange}
        activeAction={activeAction}
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        newEmailCode={newEmailCode}
        setNewEmailCode={setNewEmailCode}
        handleRequestEmailChange={handleRequestEmailChange}
        handleVerifyEmailChange={handleVerifyEmailChange}
        handleResendEmailChangeCode={handleResendEmailChangeCode}
      />

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Reset the client&apos;s password without changing the surrounding workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-full bg-muted p-2">
              <Key className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Reset password</p>
              <p className="text-sm text-muted-foreground">
                Set a new password for the client and optionally email it to them from the existing
                dialog flow.
              </p>
              <p className="text-xs text-muted-foreground">
                Last changed:{' '}
                {securityStatus.passwordLastChanged
                  ? formatDateTime(securityStatus.passwordLastChanged)
                  : 'Not available'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setResetPasswordDialogOpen(true)}
            className="shrink-0"
          >
            Reset Password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Security Activity</CardTitle>
          <CardDescription>
            A quick summary of the latest account events, with the full audit log available on
            demand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Latest event
              </p>
              <p className="mt-2 text-sm font-semibold">
                {latestActivityLog
                  ? formatEventType(latestActivityLog.type)
                  : 'No activity recorded'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {latestActivityLog
                  ? formatDateTime(latestActivityLog.timestamp)
                  : 'Nothing to review yet.'}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Failed events
              </p>
              <p className="mt-2 text-sm font-semibold">{failedActivityCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Within the latest {activityLogs.length} loaded event
                {activityLogs.length === 1 ? '' : 's'}.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Activity refresh
              </p>
              <p className="mt-2 text-sm font-semibold">
                {activityLoading ? 'Refreshing...' : 'Up to date'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pulls the latest security audit entries for this client.
              </p>
            </div>
          </div>

          <Accordion type="single" collapsible className="rounded-lg border px-4">
            <AccordionItem value="security-audit-log" className="border-b-0">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div>
                  <p className="text-sm font-medium">Full security audit log</p>
                  <p className="text-xs text-muted-foreground">
                    Expand to review detailed security-related events for this account.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <ActivityLogTable
                  logs={activityLogs}
                  isLoading={activityLoading}
                  title="Security Audit Log"
                  description="Detailed history of security-related events for this account."
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>
            Destructive access controls are isolated here so they are harder to trigger
            accidentally.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-full bg-red-50 p-2">
              <Ban className="h-5 w-5 text-red-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {securityStatus.suspended ? 'Restore client access' : 'Suspend client access'}
              </p>
              <p className="text-sm text-muted-foreground">
                {securityStatus.suspended
                  ? 'This will allow the client to sign in again immediately.'
                  : 'This will temporarily prevent the client from signing in until access is restored.'}
              </p>
              {securityStatus.suspended && securityStatus.suspendedReason && (
                <p className="text-xs text-muted-foreground">
                  Current suspension reason: {securityStatus.suspendedReason}
                </p>
              )}
            </div>
          </div>
          <Button
            variant={securityStatus.suspended ? 'outline' : 'destructive'}
            onClick={() =>
              securityStatus.suspended ? setUnsuspendDialogOpen(true) : setSuspendDialogOpen(true)
            }
            disabled={activeAction === 'suspend' || activeAction === 'unsuspend'}
            className="shrink-0"
          >
            {securityStatus.suspended ? 'Unsuspend Access' : 'Suspend Access'}
          </Button>
        </CardContent>
      </Card>

      <SecurityTabDialogs
        selectedClient={selectedClient}
        activeAction={activeAction}
        suspendDialogOpen={suspendDialogOpen}
        setSuspendDialogOpen={setSuspendDialogOpen}
        unsuspendDialogOpen={unsuspendDialogOpen}
        setUnsuspendDialogOpen={setUnsuspendDialogOpen}
        resetPasswordDialogOpen={resetPasswordDialogOpen}
        setResetPasswordDialogOpen={setResetPasswordDialogOpen}
        suspensionReason={suspensionReason}
        setSuspensionReason={setSuspensionReason}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        emailPasswordToClient={emailPasswordToClient}
        setEmailPasswordToClient={setEmailPasswordToClient}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        handleSuspendAccount={handleSuspendAccount}
        handleUnsuspendAccount={handleUnsuspendAccount}
        handleResetPassword={handleResetPassword}
      />
    </div>
  );
}
