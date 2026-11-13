import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../../../../ui/button';
import { useConfirm } from '../../../../layout/page';
import { Input } from '../../../../../ui/input';
import { Textarea } from '../../../../../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Lock, LockOpen, KeyRound, MailWarning, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import { Personnel } from '../../types';
import { updateProfileSchema } from '../../schema';
import {
  useResendPersonnelInvite,
  useCancelPersonnelInvite,
  useSuspendPersonnelAccess,
  useRestorePersonnelAccess,
  useSendPersonnelPasswordReset,
} from '../../hooks';
import { useCurrentUserPermissions } from '../../hooks/usePermissions';
import { z } from 'zod';
import { sentAgo } from './sentAgo';

type PersonnelRole = 'admin' | 'adviser' | 'paraplanner' | 'compliance';
const VALID_ROLES: PersonnelRole[] = ['admin', 'adviser', 'paraplanner', 'compliance'];

/** The profile form's id: the page header's Save submits it. */
export const PROFILE_FORM_ID = 'personnel-profile-form';

function toValidRole(role: string): PersonnelRole | undefined {
  return VALID_ROLES.includes(role as PersonnelRole) ? (role as PersonnelRole) : undefined;
}

type ProfileFormValues = z.infer<typeof updateProfileSchema>;

export interface ProfileFormState {
  dirty: boolean;
  saving: boolean;
}

interface TabProfileProps {
  selectedPersonnel: Personnel;
  /** Resolves true when the changes were saved. */
  onUpdate: (id: string, data: Partial<Personnel>) => Promise<boolean>;
  onInviteCancelled?: () => void;
  /** Lets the page header enable its Save button. */
  onFormStateChange?: (state: ProfileFormState) => void;
}

export function TabProfile({
  selectedPersonnel,
  onUpdate,
  onInviteCancelled,
  onFormStateChange,
}: TabProfileProps) {
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const { canDo, isSuperAdmin, permissions } = useCurrentUserPermissions();
  const { mutate: resendInvite, isPending: isResending } = useResendPersonnelInvite();
  const { mutate: cancelInvite, isPending: isCancelling } = useCancelPersonnelInvite();
  const { mutate: suspendAccess, isPending: isSuspending } = useSuspendPersonnelAccess();
  const { mutate: restoreAccess, isPending: isRestoring } = useRestorePersonnelAccess();
  const { mutate: sendReset, isPending: isSendingReset } = useSendPersonnelPasswordReset();

  const fullName = `${selectedPersonnel.firstName} ${selectedPersonnel.lastName}`.trim();
  const isSelf = permissions?.personnelId === selectedPersonnel.id;
  // Only a super admin may act on a super admin account (the server agrees).
  const targetProtected = selectedPersonnel.role === 'super_admin' && !isSuperAdmin;
  const isPending = selectedPersonnel.status === 'pending';
  const isSuspended = selectedPersonnel.status === 'suspended';
  const canSuspend = canDo('personnel', 'delete') && !isSelf && !targetProtected && !isPending;
  const canReset = canDo('personnel', 'edit') && !targetProtected && !isPending && !isSuspended;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      role: toValidRole(selectedPersonnel.role),
      phone: selectedPersonnel.phone || '',
      jobTitle: selectedPersonnel.jobTitle || '',
      managerId: selectedPersonnel.managerId || 'none',
    },
  });

  // Reset form when selected person changes
  useEffect(() => {
    reset({
      role: toValidRole(selectedPersonnel.role),
      phone: selectedPersonnel.phone || '',
      jobTitle: selectedPersonnel.jobTitle || '',
      managerId: selectedPersonnel.managerId || 'none',
    });
  }, [selectedPersonnel, reset]);

  useEffect(() => {
    onFormStateChange?.({ dirty: isDirty, saving: isSubmitting });
  }, [isDirty, isSubmitting, onFormStateChange]);

  const onSubmit = async (data: ProfileFormValues) => {
    // Clean up 'none' managerId
    const payload = {
      ...data,
      managerId: data.managerId === 'none' ? null : data.managerId,
    };

    const saved = await onUpdate(selectedPersonnel.id, payload);
    // Saved values become the new baseline; a failed save keeps the edits.
    if (saved) reset(data);
  };

  const handleCancelInvite = async () => {
    const ok = await confirm({
      title: 'Cancel this invitation?',
      description: `Cancel the invitation for ${fullName} (${selectedPersonnel.email})? This removes their account and any pre-configured permissions. This cannot be undone.`,
      confirmLabel: 'Cancel invitation',
      cancelLabel: 'Keep invitation',
      destructive: true,
    });
    if (!ok) return;
    cancelInvite(selectedPersonnel.id, { onSuccess: () => onInviteCancelled?.() });
  };

  const handleRestore = async () => {
    const ok = await confirm({
      title: 'Restore access?',
      description: `${fullName} will be able to sign in again.`,
      confirmLabel: 'Restore access',
    });
    if (!ok) return;
    restoreAccess(selectedPersonnel.id);
  };

  const submitSuspend = () => {
    suspendAccess(
      { id: selectedPersonnel.id, reason: suspendReason },
      {
        onSuccess: () => {
          setSuspendOpen(false);
          setSuspendReason('');
        },
      },
    );
  };

  const roleValue = watch('role');
  const managerValue = watch('managerId');

  return (
    <form id={PROFILE_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ── Pending invite ───────────────────────────────────────── */}
      {isPending && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <MailWarning className="h-4.5 w-4.5 text-amber-600" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-amber-900">
                  Invitation pending
                  {selectedPersonnel.invitedAt && ` — sent ${sentAgo(selectedPersonnel.invitedAt)}`}
                  .
                </h4>
                <p className="mt-0.5 text-xs text-amber-700">
                  This user has been invited but hasn't set up their account yet.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-amber-300 bg-white text-xs text-amber-800 hover:bg-amber-50"
                    disabled={isResending || isCancelling}
                    onClick={() => resendInvite(selectedPersonnel.id)}
                  >
                    {isResending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isResending ? 'Sending…' : 'Resend invitation'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-red-200 bg-white text-xs text-red-700 hover:bg-red-50"
                    disabled={isResending || isCancelling}
                    onClick={() => void handleCancelInvite()}
                  >
                    {isCancelling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isCancelling ? 'Cancelling…' : 'Cancel invitation'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="personnel-role">System role</Label>
              <Select
                value={roleValue}
                onValueChange={(val) =>
                  setValue('role', val as PersonnelRole, { shouldDirty: true })
                }
              >
                <SelectTrigger id="personnel-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="adviser">Adviser</SelectItem>
                  <SelectItem value="paraplanner">Paraplanner</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin, Adviser, Paraplanner or Compliance. Determines system permissions.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="personnel-manager">Reporting manager</Label>
              <Select
                value={managerValue || 'none'}
                onValueChange={(val) => setValue('managerId', val, { shouldDirty: true })}
              >
                <SelectTrigger id="personnel-manager">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="personnel-phone">Phone</Label>
              <Input id="personnel-phone" {...register('phone')} placeholder="+27..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="personnel-job-title">Job title</Label>
              <Input
                id="personnel-job-title"
                {...register('jobTitle')}
                placeholder="Senior Adviser"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {(canSuspend || canReset) && (
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          {canSuspend &&
            (isSuspended ? (
              <Button
                type="button"
                variant="outline"
                className="sm:flex-1"
                disabled={isRestoring}
                onClick={() => void handleRestore()}
              >
                <LockOpen className="h-4 w-4" aria-hidden="true" />
                {isRestoring ? 'Restoring…' : 'Restore access'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50 sm:flex-1"
                onClick={() => setSuspendOpen(true)}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                Suspend user access
              </Button>
            ))}
          {canReset && (
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              onClick={() => setResetOpen(true)}
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Reset password
            </Button>
          )}
        </div>
      )}

      {/* ── Suspend ─────────────────────────────────────────────── */}
      <Dialog
        open={suspendOpen}
        onOpenChange={(open) => {
          if (!isSuspending) setSuspendOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Suspend user access</DialogTitle>
            <DialogDescription>
              {fullName} won't be able to sign in until access is restored. Their clients stay
              assigned to them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Textarea
              id="suspend-reason"
              value={suspendReason}
              maxLength={1000}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Why is access being suspended?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSuspending}
              onClick={() => setSuspendOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isSuspending}
              onClick={submitSuspend}
            >
              {isSuspending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSuspending ? 'Suspending…' : 'Suspend access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset password ──────────────────────────────────────── */}
      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          if (!isSendingReset) setResetOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Send {fullName} a password reset link at {selectedPersonnel.email}? Their current
              password stops working and they are signed out until they choose a new one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSendingReset}
              onClick={() => setResetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSendingReset}
              onClick={() =>
                sendReset(
                  { id: selectedPersonnel.id, email: selectedPersonnel.email },
                  { onSuccess: () => setResetOpen(false) },
                )
              }
            >
              {isSendingReset && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSendingReset ? 'Sending…' : 'Send reset link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </form>
  );
}
