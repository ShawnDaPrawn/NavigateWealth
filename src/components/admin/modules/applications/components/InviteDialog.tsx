/**
 * InviteDialog — Admin-initiated application invitation
 * Sends an email inviting a prospective client to create a Navigate Wealth account.
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { toast } from 'sonner';
import { Send, Loader2, Mail, User, Phone } from 'lucide-react';
import { applicationsApi } from '../api';
import { FormErrorBanner } from '../../../layout/page';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent: () => void;
}

interface InviteFormData {
  firstName: string;
  lastName: string;
  email: string;
  cellphoneNumber: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
}

const INITIAL_FORM: InviteFormData = {
  firstName: '',
  lastName: '',
  email: '',
  cellphoneNumber: '',
};

export function InviteDialog({ open, onOpenChange, onInviteSent }: InviteDialogProps) {
  const [form, setForm] = useState<InviteFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
    setErrors({});
  }, []);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) resetForm();
      onOpenChange(open);
    },
    [onOpenChange, resetForm],
  );

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.firstName.trim()) {
      newErrors.firstName = 'Enter a first name';
    }
    if (!form.lastName.trim()) {
      newErrors.lastName = 'Enter a last name';
    }
    if (!form.email.trim()) {
      newErrors.email = 'Enter an email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Enter a valid email address, like name@example.com';
    }

    setErrors(newErrors);
    const first = newErrors.firstName
      ? 'invite-first-name'
      : newErrors.lastName
        ? 'invite-last-name'
        : newErrors.email
          ? 'invite-email'
          : null;
    if (first) document.getElementById(first)?.focus();
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSending(true);
    try {
      const result = await applicationsApi.inviteApplicant({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        cellphoneNumber: form.cellphoneNumber.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Invitation sent to ${form.firstName} ${form.lastName}`, {
          description: `Application ${result.applicationNumber} created`,
        });
        resetForm();
        onOpenChange(false);
        onInviteSent();
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    } catch (error: unknown) {
      console.error('Invite error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to send invitation. Please try again.',
      );
    } finally {
      setSending(false);
    }
  }, [form, validate, resetForm, onOpenChange, onInviteSent]);

  const updateField = useCallback(
    (field: keyof InviteFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Invite applicant</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            They get an email with a link to complete the application form. It appears under Invited
            until they submit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FormErrorBanner
            count={Object.values(errors).filter(Boolean).length}
            action="send the invitation"
          />
          {/* First Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="invite-first-name"
              className="text-sm font-medium flex items-center gap-1.5"
            >
              <User className="h-3.5 w-3.5 text-gray-400" />
              First name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-first-name"
              aria-invalid={!!errors.firstName}
              placeholder="e.g. John"
              value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              className={errors.firstName ? 'border-red-300 focus:border-red-500' : ''}
              autoFocus
            />
            {errors.firstName && <p className="text-xs text-red-600">{errors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="invite-last-name"
              className="text-sm font-medium flex items-center gap-1.5"
            >
              <User className="h-3.5 w-3.5 text-gray-400" />
              Last name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-last-name"
              aria-invalid={!!errors.lastName}
              placeholder="e.g. Smith"
              value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              className={errors.lastName ? 'border-red-300 focus:border-red-500' : ''}
            />
            {errors.lastName && <p className="text-xs text-red-600">{errors.lastName}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-gray-400" />
              Email address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-email"
              aria-invalid={!!errors.email}
              type="email"
              placeholder="e.g. john.smith@example.com"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              className={errors.email ? 'border-red-300 focus:border-red-500' : ''}
            />
            {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
          </div>

          {/* Cellphone (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-phone" className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              Cellphone <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </Label>
            <Input
              id="invite-phone"
              type="tel"
              placeholder="e.g. +27 82 123 4567"
              value={form.cellphoneNumber}
              onChange={(e) => updateField('cellphoneNumber', e.target.value)}
            />
          </div>

          {/* Info note */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              An invitation email will be sent with a secure link to create their account. The
              application will appear in the <strong>Invited</strong> tab until the client completes
              their application or you approve it directly.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : 'Send invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
