/**
 * Create-cardholder dialog — a company (or individual) Issuing cardholder.
 * A cardholder must exist before a card can be issued to it.
 */

import { useEffect, useState } from 'react';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import type { CardholderInput, CardholderType } from '../types';

interface CreateCardholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CardholderInput) => void;
  isSubmitting: boolean;
}

const EMPTY = {
  name: '',
  email: '',
  phoneNumber: '',
  taxId: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

export function CreateCardholderDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: CreateCardholderDialogProps) {
  const [type, setType] = useState<CardholderType>('company');
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (open) {
      setType('company');
      setForm({ ...EMPTY });
    }
  }, [open]);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Company names must be at least two words (Stripe requirement).
  const nameValid =
    type === 'individual' ? form.name.trim().length > 0 : form.name.trim().split(/\s+/).length >= 2;
  const canSubmit =
    nameValid &&
    form.line1.trim() &&
    form.city.trim() &&
    form.postalCode.trim() &&
    form.country.trim() &&
    !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: form.name.trim(),
      type,
      email: form.email.trim() || undefined,
      phoneNumber: form.phoneNumber.trim() || undefined,
      taxId: type === 'company' ? form.taxId.trim() || undefined : undefined,
      billingAddress: {
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        postalCode: form.postalCode.trim(),
        country: form.country.trim().toUpperCase(),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New cardholder</DialogTitle>
          <DialogDescription>Create the entity a virtual card will be issued to.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ch-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CardholderType)}>
              <SelectTrigger id="ch-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-name">{type === 'company' ? 'Business name' : 'Full name'}</Label>
            <Input
              id="ch-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={type === 'company' ? 'e.g. Tokensoft Inc' : 'e.g. Jane Doe'}
              autoFocus
            />
            {type === 'company' && form.name.trim() && !nameValid ? (
              <p className="text-xs text-destructive">
                A company name must have at least two words.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-email">Email (optional)</Label>
              <Input
                id="ch-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="billing@tokensoft.io"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-phone">Phone (optional)</Label>
              <Input
                id="ch-phone"
                value={form.phoneNumber}
                onChange={(e) => set('phoneNumber', e.target.value)}
                placeholder="+1…"
              />
            </div>
          </div>
          {type === 'company' ? (
            <div className="space-y-2">
              <Label htmlFor="ch-taxid">Tax ID (optional)</Label>
              <Input
                id="ch-taxid"
                value={form.taxId}
                onChange={(e) => set('taxId', e.target.value)}
                placeholder="EIN"
              />
            </div>
          ) : null}

          <div className="pt-1 text-sm font-medium">Billing address</div>
          <div className="space-y-2">
            <Label htmlFor="ch-line1">Address line 1</Label>
            <Input
              id="ch-line1"
              value={form.line1}
              onChange={(e) => set('line1', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-line2">Address line 2 (optional)</Label>
            <Input
              id="ch-line2"
              value={form.line2}
              onChange={(e) => set('line2', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-city">City</Label>
              <Input id="ch-city" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-state">State / Province (optional)</Label>
              <Input
                id="ch-state"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-postal">Postal code</Label>
              <Input
                id="ch-postal"
                value={form.postalCode}
                onChange={(e) => set('postalCode', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-country">Country (ISO-2)</Label>
              <Input
                id="ch-country"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                maxLength={2}
                placeholder="US"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Creating…' : 'Create cardholder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
