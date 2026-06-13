/**
 * Add / edit dialog for a refund-cluster entity.
 *
 * Creating: first pick the entity type (Sole Proprietor / Company), then the
 * matching form is shown. Editing: the type is fixed and the form is
 * pre-populated. The eFiling password field is write-only — it is sent to the
 * server for encrypted storage and never echoed back; a stored password can
 * be revealed only via the audited reveal action.
 */

import { useEffect, useState } from 'react';
import { Building2, Eye, EyeOff, User } from 'lucide-react';
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
import { Separator } from '../../../../../ui/separator';
import { ACCOUNT_TYPE_OPTIONS, ENTITY_TYPE_LABELS } from '../constants';
import {
  buildEntityPayload,
  emptyEntityForm,
  formFromEntity,
  validateEntityForm,
  type EntityFormState,
} from '../formState';
import { useRevealEfilingPassword } from '../hooks/useRefundClusters';
import type {
  BankAccountDetails,
  RefundEntity,
  RefundEntityInput,
  RefundEntityType,
} from '../types';

interface EntityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string;
  /** When set the dialog edits this entity; otherwise it creates a new one. */
  entity?: RefundEntity | null;
  onSubmit: (payload: RefundEntityInput) => void;
  isSubmitting: boolean;
}

export function EntityFormDialog({
  open,
  onOpenChange,
  clusterId,
  entity,
  onSubmit,
  isSubmitting,
}: EntityFormDialogProps) {
  const [typeChosen, setTypeChosen] = useState(false);
  const [form, setForm] = useState<EntityFormState>(() => emptyEntityForm('sole_proprietor'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (entity) {
        setForm(formFromEntity(entity));
        setTypeChosen(true);
      } else {
        setForm(emptyEntityForm('sole_proprietor'));
        setTypeChosen(false);
      }
    }
  }, [open, entity]);

  const patch = (changes: Partial<EntityFormState>) => setForm((prev) => ({ ...prev, ...changes }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateEntityForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSubmit(buildEntityPayload(form));
  };

  const selectType = (entityType: RefundEntityType) => {
    setForm(emptyEntityForm(entityType));
    setTypeChosen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entity
              ? `Edit ${ENTITY_TYPE_LABELS[entity.entityType]}`
              : typeChosen
                ? `Add ${ENTITY_TYPE_LABELS[form.entityType]}`
                : 'Add Entity'}
          </DialogTitle>
          <DialogDescription>
            {typeChosen
              ? 'Capture the details for this entity. Sensitive values are encrypted at rest.'
              : 'Choose the entity type to show the correct form.'}
          </DialogDescription>
        </DialogHeader>

        {!typeChosen ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <button
              type="button"
              onClick={() => selectType('sole_proprietor')}
              className="border rounded-lg p-6 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <User className="h-8 w-8 text-primary" />
              <span className="font-medium">Sole Proprietor</span>
              <span className="text-xs text-muted-foreground text-center">
                An individual trading in their own name
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectType('company')}
              className="border rounded-lg p-6 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Building2 className="h-8 w-8 text-primary" />
              <span className="font-medium">Company</span>
              <span className="text-xs text-muted-foreground text-center">
                A registered company or close corporation
              </span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {form.entityType === 'sole_proprietor' ? (
              <PersonalDetailsSection form={form} patch={patch} />
            ) : (
              <BusinessDetailsSection form={form} patch={patch} />
            )}

            <Separator />
            <BankingSection
              title="Primary Banking Account"
              hint="The bank account associated with eFiling."
              account={form.primaryAccount}
              onChange={(primaryAccount) => patch({ primaryAccount })}
              idPrefix="primary"
            />
            <BankingSection
              title="Secondary Banking Account"
              hint="The bank account used for payments."
              account={form.secondaryAccount}
              onChange={(secondaryAccount) => patch({ secondaryAccount })}
              idPrefix="secondary"
            />

            <Separator />
            <TaxSection form={form} patch={patch} clusterId={clusterId} entity={entity ?? null} />

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : entity ? 'Save Changes' : 'Add Entity'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Sections
// ============================================================================

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

interface SectionProps {
  form: EntityFormState;
  patch: (changes: Partial<EntityFormState>) => void;
}

function PersonalDetailsSection({ form, patch }: SectionProps) {
  const update = (changes: Partial<EntityFormState['personalDetails']>) =>
    patch({ personalDetails: { ...form.personalDetails, ...changes } });

  return (
    <div className="space-y-4">
      <SectionHeading title="Personal Details" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="sp-name"
          label="Name"
          value={form.personalDetails.name}
          onChange={(name) => update({ name })}
        />
        <Field
          id="sp-surname"
          label="Surname"
          value={form.personalDetails.surname}
          onChange={(surname) => update({ surname })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sp-address">Physical Address</Label>
        <Textarea
          id="sp-address"
          value={form.personalDetails.physicalAddress}
          onChange={(e) => update({ physicalAddress: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

function BusinessDetailsSection({ form, patch }: SectionProps) {
  const update = (changes: Partial<EntityFormState['businessDetails']>) =>
    patch({ businessDetails: { ...form.businessDetails, ...changes } });

  return (
    <div className="space-y-4">
      <SectionHeading title="Business Details" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="co-name"
          label="Company Name"
          value={form.businessDetails.companyName}
          onChange={(companyName) => update({ companyName })}
        />
        <Field
          id="co-reg"
          label="Registration Number"
          value={form.businessDetails.registrationNumber}
          onChange={(registrationNumber) => update({ registrationNumber })}
        />
        <Field
          id="co-trading"
          label="Trading Name"
          value={form.businessDetails.tradingName}
          onChange={(tradingName) => update({ tradingName })}
        />
        <Field
          id="co-contact"
          label="Contact Person"
          value={form.businessDetails.contactPerson}
          onChange={(contactPerson) => update({ contactPerson })}
        />
        <Field
          id="co-contact-email"
          label="Contact Person Email"
          type="email"
          value={form.businessDetails.contactPersonEmail}
          onChange={(contactPersonEmail) => update({ contactPersonEmail })}
        />
        <Field
          id="co-contact-phone"
          label="Contact Person Phone Number"
          type="tel"
          value={form.businessDetails.contactPersonPhone}
          onChange={(contactPersonPhone) => update({ contactPersonPhone })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="co-registered-address">Registered Address</Label>
        <Textarea
          id="co-registered-address"
          value={form.businessDetails.registeredAddress}
          onChange={(e) => update({ registeredAddress: e.target.value })}
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="co-physical-address">Physical Business Address</Label>
        <Textarea
          id="co-physical-address"
          value={form.businessDetails.physicalBusinessAddress}
          onChange={(e) => update({ physicalBusinessAddress: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

function BankingSection({
  title,
  hint,
  account,
  onChange,
  idPrefix,
}: {
  title: string;
  hint: string;
  account: BankAccountDetails;
  onChange: (account: BankAccountDetails) => void;
  idPrefix: string;
}) {
  const update = (changes: Partial<BankAccountDetails>) => onChange({ ...account, ...changes });

  return (
    <div className="space-y-4">
      <SectionHeading title={title} hint={hint} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id={`${idPrefix}-bank-name`}
          label="Bank Name"
          value={account.bankName}
          onChange={(bankName) => update({ bankName })}
        />
        <Field
          id={`${idPrefix}-holder`}
          label="Account Holder"
          value={account.accountHolder}
          onChange={(accountHolder) => update({ accountHolder })}
        />
        <Field
          id={`${idPrefix}-number`}
          label="Account Number"
          value={account.accountNumber}
          onChange={(accountNumber) => update({ accountNumber })}
        />
        <Field
          id={`${idPrefix}-branch`}
          label="Branch Code"
          value={account.branchCode}
          onChange={(branchCode) => update({ branchCode })}
        />
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Account Type</Label>
          <Select
            value={account.accountType || undefined}
            onValueChange={(accountType) => update({ accountType })}
          >
            <SelectTrigger id={`${idPrefix}-type`}>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Proof of bank account can be uploaded under the entity&apos;s Documents once saved.
      </p>
    </div>
  );
}

function TaxSection({
  form,
  patch,
  clusterId,
  entity,
}: SectionProps & { clusterId: string; entity: RefundEntity | null }) {
  const [showPassword, setShowPassword] = useState(false);
  const reveal = useRevealEfilingPassword();
  const hasStoredPassword = Boolean(entity?.taxDetails?.hasEfilingPassword);

  const handleReveal = async () => {
    if (!entity) return;
    const password = await reveal.mutateAsync({ clusterId, entityId: entity.id });
    patch({ efilingPassword: password });
    setShowPassword(true);
  };

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Tax Details"
        hint="The eFiling password is encrypted at rest and never shown unless explicitly revealed (revealing is audit-logged)."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="tax-efiling-username"
          label="eFiling Username"
          value={form.efilingUsername}
          onChange={(efilingUsername) => patch({ efilingUsername })}
        />
        <div className="space-y-1.5">
          <Label htmlFor="tax-efiling-password">eFiling Password</Label>
          <div className="flex gap-2">
            <Input
              id="tax-efiling-password"
              type={showPassword ? 'text' : 'password'}
              value={form.efilingPassword}
              onChange={(e) => patch({ efilingPassword: e.target.value })}
              placeholder={hasStoredPassword ? '•••••••• (stored securely)' : 'Enter password'}
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => {
                if (!showPassword && !form.efilingPassword && hasStoredPassword) {
                  void handleReveal();
                } else {
                  setShowPassword((v) => !v);
                }
              }}
              disabled={reveal.isPending}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {hasStoredPassword && !form.efilingPassword && (
            <p className="text-xs text-muted-foreground">
              A password is stored. Leave blank to keep it, or type a new one to replace it.
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          The VAT category is set on the cluster (shared by all entities). The live VAT figure is
          computed from the entity&apos;s Transactions ledger; the fields below are optional manual
          accounting-record notes.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="tax-current-vat"
          label="Current Period Accounting VAT (note)"
          value={form.currentPeriodVat}
          onChange={(currentPeriodVat) => patch({ currentPeriodVat })}
          placeholder="e.g. R 125 000.00"
        />
        <Field
          id="tax-previous-vat"
          label="Previous Period Accounting VAT (note)"
          value={form.previousPeriodVat}
          onChange={(previousPeriodVat) => patch({ previousPeriodVat })}
          placeholder="e.g. R 98 500.00"
        />
      </div>
    </div>
  );
}
