/**
 * New cardholder — a page of its own under Banking (design LK 7). A company
 * (or individual) Issuing cardholder must exist before a card can be issued
 * to it.
 */

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Tabs } from '../../../../../ui/tabs';
import { cn } from '../../../../../ui/utils';
import {
  FormErrorBanner,
  PageHeader,
  SegmentedList,
  SegmentedTrigger,
} from '../../../../layout/page';
import type { CardholderInput, CardholderType } from '../types';

const FORM_ID = 'locked-new-cardholder';

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

type FieldKey = keyof typeof EMPTY;
type Errors = Partial<Record<FieldKey, string>>;

/** The fields in the order they appear, for focusing the first error. */
const ORDER: FieldKey[] = ['name', 'email', 'line1', 'city', 'postalCode', 'country'];

function validateCardholder(type: CardholderType, form: typeof EMPTY): Errors {
  const errors: Errors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'Enter a name';
  // Company names must be at least two words (Stripe requirement).
  else if (type === 'company' && name.split(/\s+/).length < 2)
    errors.name = 'A company name must have at least two words';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = 'Enter a valid email address';
  if (!form.line1.trim()) errors.line1 = 'Enter the first address line';
  if (!form.city.trim()) errors.city = 'Enter a city';
  if (!form.postalCode.trim()) errors.postalCode = 'Enter a postal code';
  if (!/^[A-Za-z]{2}$/.test(form.country.trim()))
    errors.country = 'Enter a two-letter country code, e.g. US';
  return errors;
}

interface CreateCardholderPageProps {
  onClose: () => void;
  onSubmit: (input: CardholderInput) => void;
  isSubmitting: boolean;
}

export function CreateCardholderPage({
  onClose,
  onSubmit,
  isSubmitting,
}: CreateCardholderPageProps) {
  const [type, setType] = useState<CardholderType>('company');
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<Errors>({});

  const set = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const found = validateCardholder(type, form);
    setErrors(found);
    const first = ORDER.find((key) => found[key]);
    if (first) {
      document.getElementById(`ch-${first}`)?.focus();
      return;
    }
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

  const field = (key: FieldKey, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={`ch-${key}`}>{label}</Label>
      <Input
        id={`ch-${key}`}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `ch-${key}-error` : undefined}
        className={cn(errors[key] && 'border-red-400 focus-visible:ring-red-400')}
        {...props}
      />
      {errors[key] && (
        <p id={`ch-${key}-error`} className="text-xs text-red-600">
          {errors[key]}
        </p>
      )}
    </div>
  );

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to banking
      </button>
      <PageHeader
        title="New cardholder"
        description="Create the entity a virtual card will be issued to."
        actions={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create cardholder'}
            </Button>
          </>
        }
      />

      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit}
        className="max-w-[720px] space-y-5 rounded-xl border border-nw-line bg-white p-5 sm:p-6"
      >
        <FormErrorBanner count={errorCount} action="create the cardholder" />
        <Tabs value={type} onValueChange={(v) => setType(v as CardholderType)}>
          <SegmentedList aria-label="Cardholder type">
            <SegmentedTrigger value="company">Company</SegmentedTrigger>
            <SegmentedTrigger value="individual">Individual</SegmentedTrigger>
          </SegmentedList>
        </Tabs>
        {field('name', 'Name', {
          placeholder: type === 'company' ? 'e.g. Tokensoft Inc' : 'e.g. Jane Doe',
          autoFocus: true,
        })}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('email', 'Email (optional)', {
            type: 'email',
            placeholder: 'billing@tokensoft.io',
          })}
          {field('phoneNumber', 'Phone (optional)', { placeholder: '+1…' })}
        </div>
        {type === 'company' ? field('taxId', 'Tax ID (optional)', { placeholder: 'EIN' }) : null}

        <h2 className="pt-1 text-sm font-semibold text-nw-ink">Billing address</h2>
        {field('line1', 'Address line 1')}
        {field('line2', 'Address line 2 (optional)')}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('city', 'City')}
          {field('state', 'State / Province (optional)')}
          {field('postalCode', 'Postal code')}
          {field('country', 'Country (ISO-2)', { maxLength: 2, placeholder: 'US' })}
        </div>
      </form>
    </div>
  );
}
