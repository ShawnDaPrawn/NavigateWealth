import React, { useEffect, useState, useCallback } from 'react';
import { ErrorState, Notice } from '../../../layout/page';
import { Button } from '../../../../ui/button';
import { Switch } from '../../../../ui/switch';
import { ActivityLogTable } from '../../../ActivityLogTable';
import { Ban, Key, Lock, RefreshCw, Shield, Smartphone } from 'lucide-react';
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
  const [showAuditLog, setShowAuditLog] = useState(false);
  /** The status read failed: show an error, not a made-up "Active" account. */
  const [statusError, setStatusError] = useState<string | null>(null);
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
      setStatusError(null);
    } catch (error) {
      console.error('Failed to fetch security status:', error);
      setStatusError(error instanceof Error ? error.message : String(error));
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

  const lastActivity = sortedActivityLogs[0];
  const recentLogs = sortedActivityLogs.slice(0, 5);
  const loggedBy = (log: ActivityLogEntry): string => {
    const m = log.metadata ?? {};
    const by = m.performedByRole ?? m.actorRole ?? m.by ?? m.performedBy ?? m.actor;
    return typeof by === 'string' && by ? by : '—';
  };

  if (statusError) {
    return (
      <ErrorState
        title="Couldn't load security"
        description="This client's account status could not be loaded."
        onRetry={() => {
          void fetchSecurityStatus();
          void fetchActivityLogs();
        }}
        details={statusError}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Status strip */}
      <section
        aria-label="Security status"
        className="grid grid-cols-2 divide-nw-line-2 rounded-xl border border-nw-line bg-white md:grid-cols-4 md:divide-x"
      >
        <StatusCell label="Account status" icon={Shield}>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${accountStateBadgeClass}`}
          >
            {accountState}
          </span>
        </StatusCell>
        <StatusCell label="Two-factor authentication" icon={Smartphone}>
          {securityStatus.twoFactorEnabled ? 'Enabled' : 'Disabled'}
        </StatusCell>
        <StatusCell label="Password" icon={Lock}>
          {securityStatus.passwordLastChanged
            ? `Changed ${formatRelativeDate(securityStatus.passwordLastChanged)}`
            : 'No change recorded'}
        </StatusCell>
        <StatusCell label="Last activity" icon={RefreshCw}>
          {lastActivity ? formatRelativeDate(lastActivity.timestamp) : 'None recorded'}
        </StatusCell>
      </section>

      {sharesMailbox && (
        <Notice title="Signs in with a linked alias.">
          Mail is delivered to {selectedClient.email}.
        </Notice>
      )}

      {securityStatus.suspended && (
        <Notice kind="error" title="Account suspended.">
          Suspended on {formatDateTime(securityStatus.suspendedAt)}. Reason:{' '}
          {securityStatus.suspendedReason || 'No reason provided'}.
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
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

        <section aria-label="Password" className="rounded-xl border border-nw-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-nw-line-2 px-5 py-3.5">
            <h3 className="text-[15px] font-semibold text-nw-ink">Password</h3>
            <Button variant="outline" size="sm" onClick={() => setResetPasswordDialogOpen(true)}>
              <Key className="h-3.5 w-3.5" aria-hidden="true" />
              Reset password
            </Button>
          </div>
          <p className="px-5 py-4 text-sm text-nw-text-3">
            Last changed:{' '}
            {securityStatus.passwordLastChanged
              ? formatDateTime(securityStatus.passwordLastChanged)
              : 'Not available'}
          </p>
        </section>

        <section
          aria-label="Two-factor authentication"
          className="rounded-xl border border-nw-line bg-white lg:col-span-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="space-y-0.5">
              <h3 className="text-[15px] font-semibold text-nw-ink">Two-factor authentication</h3>
              <p className="text-sm text-nw-text-3">
                Require a one-time verification code sent to the client&apos;s registered email
                address during login.
              </p>
            </div>
            <Switch
              aria-label="Two-factor authentication"
              checked={!!securityStatus.twoFactorEnabled}
              onCheckedChange={handleToggle2FA}
              disabled={activeAction === 'twoFactor'}
              className="shrink-0"
            />
          </div>
        </section>
      </div>

      <section
        aria-label="Recent security activity"
        className="rounded-xl border border-nw-line bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nw-line-2 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-nw-ink">Recent security activity</h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void fetchSecurityStatus();
                void fetchActivityLogs();
              }}
              disabled={statusLoading || activityLoading}
              aria-label="Refresh security activity"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${statusLoading || activityLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAuditLog((v) => !v)}>
              {showAuditLog ? 'Hide full audit log' : 'Full security audit log'}
            </Button>
          </div>
        </div>
        {showAuditLog ? (
          <div className="p-4">
            <ActivityLogTable
              logs={activityLogs}
              isLoading={activityLoading}
              title="Security audit log"
              description={`Detailed history of security-related events for this account. ${failedActivityCount} failed.`}
            />
          </div>
        ) : recentLogs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-nw-text-3">
            {activityLoading ? 'Loading activity…' : 'No activity recorded.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-nw-text-3">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-5 py-2 font-medium">Event</th>
                <th className="px-5 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nw-line-2">
              {recentLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-2 text-nw-text-2">{formatDateTime(log.timestamp)}</td>
                  <td className="px-5 py-2 text-nw-ink">
                    {formatEventType(log.type)}
                    {!log.success && <span className="ml-2 text-xs text-red-700">Failed</span>}
                  </td>
                  <td className="px-5 py-2 text-nw-text-2">{loggedBy(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Danger zone" className="rounded-xl border border-red-200 bg-white">
        <h3 className="border-b border-red-100 px-5 py-3.5 text-[15px] font-semibold text-red-800">
          Danger zone
        </h3>
        <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-nw-ink">
              {securityStatus.suspended ? 'Restore client access' : 'Suspend client access'}
            </p>
            <p className="text-sm text-nw-text-3">
              {securityStatus.suspended
                ? 'The client can sign in again immediately.'
                : "The client can't sign in until access is restored. You'll be asked for a reason, which is kept in the audit log."}
            </p>
          </div>
          <Button
            variant={securityStatus.suspended ? 'outline' : 'destructive'}
            onClick={() =>
              securityStatus.suspended ? setUnsuspendDialogOpen(true) : setSuspendDialogOpen(true)
            }
            disabled={activeAction === 'suspend' || activeAction === 'unsuspend'}
            className="shrink-0"
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            {securityStatus.suspended ? 'Unsuspend access' : 'Suspend access'}
          </Button>
        </div>
      </section>

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

function StatusCell({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5">
      <p className="flex items-center gap-1.5 text-xs text-nw-text-3">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-nw-ink">{children}</div>
    </div>
  );
}
