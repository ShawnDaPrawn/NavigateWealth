import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import { Lock, Save, MailWarning, RefreshCw, XCircle, Clock, Loader2 } from 'lucide-react';
import { Personnel } from '../../types';
import { updateProfileSchema } from '../../schema';
import { useResendPersonnelInvite, useCancelPersonnelInvite } from '../../hooks';
import { z } from 'zod';

type PersonnelRole = 'admin' | 'adviser' | 'paraplanner' | 'compliance';
const VALID_ROLES: PersonnelRole[] = ['admin', 'adviser', 'paraplanner', 'compliance'];

function toValidRole(role: string): PersonnelRole | undefined {
  return VALID_ROLES.includes(role as PersonnelRole) ? (role as PersonnelRole) : undefined;
}

type ProfileFormValues = z.infer<typeof updateProfileSchema>;

interface TabProfileProps {
  selectedPersonnel: Personnel;
  onUpdate: (id: string, data: Partial<Personnel>) => Promise<boolean>;
  onInviteCancelled?: () => void;
}

export function TabProfile({ selectedPersonnel, onUpdate, onInviteCancelled }: TabProfileProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { mutate: resendInvite, isPending: isResending } = useResendPersonnelInvite();
  const { mutate: cancelInvite, isPending: isCancelling } = useCancelPersonnelInvite();

  const { 
    register, 
    handleSubmit, 
    setValue,
    reset,
    watch,
    formState: { isDirty, isSubmitting } 
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      role: toValidRole(selectedPersonnel.role),
      phone: selectedPersonnel.phone || '',
      jobTitle: selectedPersonnel.jobTitle || '',
      managerId: selectedPersonnel.managerId || 'none'
    }
  });

  // Reset form when selected person changes
  useEffect(() => {
    reset({
      role: toValidRole(selectedPersonnel.role),
      phone: selectedPersonnel.phone || '',
      jobTitle: selectedPersonnel.jobTitle || '',
      managerId: selectedPersonnel.managerId || 'none'
    });
  }, [selectedPersonnel, reset]);

  const onSubmit = async (data: ProfileFormValues) => {
    // Clean up 'none' managerId
    const payload = {
      ...data,
      managerId: data.managerId === 'none' ? null : data.managerId
    };
    
    await onUpdate(selectedPersonnel.id, payload);
    // Form remains populated with new values, isDirty becomes false
    reset(data); 
  };

  const roleValue = watch("role");
  const managerValue = watch("managerId");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
      {/* ── Pending Invite Banner ───────────────────────────────── */}
      {selectedPersonnel.status === 'pending' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-100 shrink-0 mt-0.5">
                <MailWarning className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-amber-900">Invitation Pending</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  This user has been invited but hasn't set up their account yet.
                  {selectedPersonnel.invitedAt && (
                    <span className="inline-flex items-center gap-1 ml-1">
                      <Clock className="h-3 w-3 inline" />
                      Sent {new Date(selectedPersonnel.invitedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 border-amber-300 bg-white hover:bg-amber-50 text-amber-800"
                    disabled={isResending || isCancelling}
                    onClick={() => resendInvite(selectedPersonnel.id)}
                  >
                    {isResending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {isResending ? 'Sending…' : 'Resend Invitation'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 border-red-200 bg-white hover:bg-red-50 text-red-700"
                    disabled={isResending || isCancelling}
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    {isCancelling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {isCancelling ? 'Cancelling…' : 'Cancel Invitation'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Access Control</CardTitle>
           {isDirty && (
            <Button size="sm" type="submit" disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>System Role</Label>
              <Select 
                value={roleValue} 
                onValueChange={(val) => setValue("role", val as PersonnelRole, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="adviser">Adviser</SelectItem>
                  <SelectItem value="paraplanner">Paraplanner</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Determines system permissions.</p>
            </div>
            <div>
              <Label>Reporting Manager</Label>
              <Select 
                value={managerValue || 'none'}
                onValueChange={(val) => setValue("managerId", val, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {/* Ideally populate with actual managers list */}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Phone</Label>
               <Input {...register("phone")} placeholder="+27..." />
             </div>
             <div className="space-y-2">
               <Label>Job Title</Label>
               <Input {...register("jobTitle")} placeholder="Senior Adviser" />
             </div>
          </div>
        </CardContent>
      </Card>

       <div className="flex gap-2 pt-4">
          <Button type="button" variant="destructive" className="w-full">
            <Lock className="h-4 w-4 mr-2" />
            Suspend User Access
          </Button>
          <Button type="button" variant="outline" className="w-full">
            Reset Password
          </Button>
       </div>

      {/* ── Cancel Invitation Confirmation Dialog ──────────────── */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation for{' '}
              <span className="font-medium text-gray-900">
                {selectedPersonnel.firstName} {selectedPersonnel.lastName}
              </span>{' '}
              ({selectedPersonnel.email})?
              This will remove their account and any pre-configured permissions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Invitation</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isCancelling}
              onClick={(e) => {
                e.preventDefault();
                cancelInvite(selectedPersonnel.id, {
                  onSuccess: () => {
                    setCancelDialogOpen(false);
                    if (onInviteCancelled) {
                      onInviteCancelled();
                    }
                  },
                });
              }}
            >
              {isCancelling ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelling…
                </div>
              ) : (
                'Yes, Cancel Invitation'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}