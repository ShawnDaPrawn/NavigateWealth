/**
 * Create / edit dialog for a supplier profile (name, registration + VAT
 * numbers, industry, default VAT treatment, optional address/billing/contact).
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
import { Textarea } from '../../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { INDUSTRY_OPTIONS, VAT_TREATMENT_OPTIONS } from '../constants';
import type { Supplier, SupplierInput, VatTreatment } from '../types';

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this supplier; otherwise it creates a new one. */
  supplier?: Supplier | null;
  onSubmit: (values: SupplierInput) => void;
  isSubmitting: boolean;
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSubmit,
  isSubmitting,
}: SupplierFormDialogProps) {
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [industry, setIndustry] = useState('');
  const [defaultVatTreatment, setDefaultVatTreatment] = useState<VatTreatment>('standard');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [billingInfo, setBillingInfo] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  useEffect(() => {
    if (open) {
      setName(supplier?.name ?? '');
      setRegistrationNumber(supplier?.registrationNumber ?? '');
      setVatNumber(supplier?.vatNumber ?? '');
      setIndustry(supplier?.industry ?? '');
      setDefaultVatTreatment(supplier?.defaultVatTreatment ?? 'standard');
      setRegisteredAddress(supplier?.registeredAddress ?? '');
      setBillingInfo(supplier?.billingInfo ?? '');
      setContactNumber(supplier?.contactNumber ?? '');
    }
  }, [open, supplier]);

  const canSubmit = Boolean(name.trim() && registrationNumber.trim() && vatNumber.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    onSubmit({
      name: name.trim(),
      registrationNumber: registrationNumber.trim(),
      vatNumber: vatNumber.trim(),
      industry,
      defaultVatTreatment,
      registeredAddress: registeredAddress.trim(),
      billingInfo: billingInfo.trim(),
      contactNumber: contactNumber.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          <DialogDescription>
            {supplier
              ? 'Update the VAT-registered supplier profile.'
              : 'A VAT-registered provider, supplier or contractor that invoices your entities.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-name">Supplier Name</Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Construction (Pty) Ltd"
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-reg">Registration Number</Label>
              <Input
                id="supplier-reg"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g. 2019/123456/07"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-vat">VAT Number</Label>
              <Input
                id="supplier-vat"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="e.g. 4123456789"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-industry">Industry</Label>
              <Select value={industry || undefined} onValueChange={setIndustry}>
                <SelectTrigger id="supplier-industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-vat-type">VAT Type</Label>
              <Select
                value={defaultVatTreatment}
                onValueChange={(value) => setDefaultVatTreatment(value as VatTreatment)}
              >
                <SelectTrigger id="supplier-vat-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_TREATMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default VAT treatment for this supplier's invoice line items.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-address">Registered Address (optional)</Label>
            <Textarea
              id="supplier-address"
              className="bg-white border-border shadow-sm min-h-16"
              value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)}
              placeholder="Street, city, postal code"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-billing">Billing Info (optional)</Label>
            <Textarea
              id="supplier-billing"
              className="bg-white border-border shadow-sm min-h-16"
              value={billingInfo}
              onChange={(e) => setBillingInfo(e.target.value)}
              placeholder="Bank, account number, branch code, payment terms…"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-contact">Contact Number (optional)</Label>
            <Input
              id="supplier-contact"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. 021 555 0123"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
