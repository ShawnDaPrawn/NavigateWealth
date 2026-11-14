/**
 * Add / edit a partner advertiser — a centred dialog (short form) with
 * submit validation: "Fix N fields", red fields with fix-it text, focus on
 * the first error.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Textarea } from '../../../../ui/textarea';
import { cn } from '../../../../ui/utils';
import { FormErrorBanner } from '../../../layout/page';
import type { PartnerInput, PartnerStatus, SocialPartner } from '../types';
import {
  EMPTY_PARTNER,
  PARTNER_STATUS_LABEL,
  partnerToInput,
  suggestReferralCode,
  validatePartner,
  type PartnerErrors,
} from './partnersModel';

const FIELD_ORDER: (keyof PartnerInput)[] = ['name', 'contactEmail', 'website', 'referralCode'];

interface PartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The partner being edited; null to add one. */
  partner: SocialPartner | null;
  partners: SocialPartner[];
  saving: boolean;
  onSave: (input: PartnerInput) => Promise<unknown>;
}

export function PartnerDialog({
  open,
  onOpenChange,
  partner,
  partners,
  saving,
  onSave,
}: PartnerDialogProps) {
  const [form, setForm] = useState<PartnerInput>(EMPTY_PARTNER);
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState<PartnerErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(partner ? partnerToInput(partner) : EMPTY_PARTNER);
    setCodeTouched(Boolean(partner));
    setErrors({});
    setSubmitted(false);
  }, [open, partner]);

  const others = partners.filter((p) => p.id !== partner?.id);
  const update = <K extends keyof PartnerInput>(key: K, value: PartnerInput[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !codeTouched) next.referralCode = suggestReferralCode(String(value));
      if (submitted) setErrors(validatePartner(next, others));
      return next;
    });
  };

  const submit = async () => {
    setSubmitted(true);
    const found = validatePartner(form, others);
    setErrors(found);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      document.getElementById(`partner-${first}`)?.focus();
      return;
    }
    try {
      await onSave({ ...form, referralCode: form.referralCode.trim().toLowerCase() });
      onOpenChange(false);
    } catch {
      // The mutation toasts the error; keep the dialog open with the input intact.
    }
  };

  const errorCount = Object.keys(errors).length;
  const fieldProps = (key: keyof PartnerInput) => ({
    id: `partner-${key}`,
    'aria-invalid': Boolean(errors[key]),
    'aria-describedby': errors[key] ? `partner-${key}-error` : undefined,
    className: cn(errors[key] && 'border-red-500 focus-visible:ring-red-500/40'),
  });
  const fieldError = (key: keyof PartnerInput) =>
    errors[key] ? (
      <p id={`partner-${key}-error`} className="text-xs text-red-600">
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{partner ? 'Edit partner' : 'Add partner'}</DialogTitle>
          <DialogDescription>
            A business you promote and that sends people to you. Its referral link carries UTM tags
            so visits can be attributed.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <FormErrorBanner
            count={errorCount}
            action={partner ? 'save the partner' : 'add the partner'}
          />
          <div className="space-y-1.5">
            <Label htmlFor="partner-name">Partner name *</Label>
            <Input
              {...fieldProps('name')}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Pretoria Property Group"
              maxLength={120}
            />
            {fieldError('name')}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="partner-contactName">Contact name</Label>
              <Input
                id="partner-contactName"
                value={form.contactName}
                onChange={(e) => update('contactName', e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-contactEmail">Contact email</Label>
              <Input
                {...fieldProps('contactEmail')}
                type="email"
                value={form.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
                maxLength={200}
              />
              {fieldError('contactEmail')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner-website">Website</Label>
            <Input
              {...fieldProps('website')}
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="https://"
              maxLength={500}
            />
            {fieldError('website')}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="partner-referralCode">Referral code *</Label>
              <Input
                {...fieldProps('referralCode')}
                value={form.referralCode}
                onChange={(e) => {
                  setCodeTouched(true);
                  update('referralCode', e.target.value.toLowerCase());
                }}
                placeholder="ppg"
                maxLength={40}
              />
              {fieldError('referralCode') ?? (
                <p className="text-xs text-nw-text-3">Used as utm_content in the referral link.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update('status', v as PartnerStatus)}
              >
                <SelectTrigger id="partner-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PARTNER_STATUS_LABEL) as PartnerStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {PARTNER_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner-notes">Notes</Label>
            <Textarea
              id="partner-notes"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {partner ? 'Save partner' : 'Add partner'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
