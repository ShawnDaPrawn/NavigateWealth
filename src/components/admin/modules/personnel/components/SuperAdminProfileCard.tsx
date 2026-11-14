import { useState } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Badge } from '../../../../ui/badge';
import { Avatar, AvatarFallback } from '../../../../ui/avatar';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Shield, Edit2, Mail, Phone, Loader2 } from 'lucide-react';
import { SuperAdminProfile } from '../types';
import { FormErrorBanner } from '../../../layout/page';
import {
  validateAdminProfile,
  type AdminProfileErrors,
  type AdminProfileValues,
} from '../adminProfileValidation';

interface SuperAdminProfileCardProps {
  profile: SuperAdminProfile | null;
  loading: boolean;
  /** Resolves true when the changes were saved. */
  onUpdate: (updates: Partial<SuperAdminProfile>) => Promise<boolean>;
  /** Told when the edit dialog opens or closes (the page breadcrumb shows "Edit"). */
  onEditingChange?: (editing: boolean) => void;
}

/** The super admin's own profile, shown under the Personnel header; Edit opens a dialog. */
export function SuperAdminProfileCard({
  profile,
  loading,
  onUpdate,
  onEditingChange,
}: SuperAdminProfileCardProps) {
  const [editOpen, setEditOpenState] = useState(false);
  const setEditOpen = (open: boolean) => {
    setEditOpenState(open);
    onEditingChange?.(open);
  };
  const [values, setValues] = useState<AdminProfileValues>({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [errors, setErrors] = useState<AdminProfileErrors>({});
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    if (!profile) return;
    setValues({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phone: profile.phone || '',
    });
    setErrors({});
    setEditOpen(true);
  };

  const handleSave = async () => {
    const found = validateAdminProfile(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      document.getElementById(`sa-${first}`)?.focus();
      return;
    }
    setSaving(true);
    const success = await onUpdate({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
    });
    setSaving(false);
    if (success) setEditOpen(false);
  };

  if (loading) {
    return (
      <Card className="border-nw-line shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-4" aria-busy="true">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="border-nw-line shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shield className="h-5 w-5 text-purple-400" aria-hidden="true" />
            <p className="text-sm">Unable to load the admin profile. Check your permissions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayFirstName = profile.firstName || 'Super';
  const displayLastName = profile.lastName || 'Admin';
  const displayPhone = profile.phone || 'Not set';
  const initials = `${displayFirstName[0] || 'S'}${displayLastName[0] || 'A'}`.toUpperCase();

  const field = (key: keyof AdminProfileValues, label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`sa-${key}`}>{label}</Label>
      <Input
        id={`sa-${key}`}
        value={values[key]}
        onChange={(e) => {
          setValues({ ...values, [key]: e.target.value });
          if (errors[key]) setErrors({ ...errors, [key]: undefined });
        }}
        placeholder={placeholder}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `sa-${key}-error` : undefined}
        className={errors[key] ? 'border-red-400 focus-visible:ring-red-400' : undefined}
      />
      {errors[key] && (
        <p id={`sa-${key}-error`} className="text-xs text-red-600">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <Card className="border-nw-line shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarFallback className="bg-nw-violet text-sm font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-nw-ink">
                  {displayFirstName} {displayLastName}
                </h2>
                <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px]">
                  Super admin
                </Badge>
                <Badge
                  variant="outline"
                  className="h-5 border-green-400 px-1.5 py-0 text-[10px] text-green-700"
                >
                  Active
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {profile.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {displayPhone}
                </span>
              </div>
            </div>
          </div>

          <Button onClick={handleEdit} variant="outline" size="sm" className="flex-shrink-0">
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </CardContent>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!saving) setEditOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit super admin profile</DialogTitle>
            <DialogDescription>Your name and phone number as staff see them.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <FormErrorBanner
              count={Object.values(errors).filter(Boolean).length}
              action="save the profile"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {field('firstName', 'First name', 'First name')}
              {field('lastName', 'Last name', 'Last name')}
            </div>
            {field('phone', 'Phone number', '+27...')}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
