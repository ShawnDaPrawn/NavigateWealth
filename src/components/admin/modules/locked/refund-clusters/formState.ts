/**
 * Refund Clusters — Entity form state helpers
 *
 * Pure functions shared by the entity form dialog: building an empty form,
 * hydrating it from an existing entity, validating, and converting the form
 * back into the API payload. Kept free of React so they are unit-testable.
 */

import type {
  BankAccountDetails,
  BusinessDetails,
  PersonalDetails,
  RefundEntity,
  RefundEntityInput,
  RefundEntityType,
  VatPeriodCategory,
} from './types';

export interface EntityFormState {
  entityType: RefundEntityType;
  personalDetails: PersonalDetails;
  businessDetails: BusinessDetails;
  primaryAccount: BankAccountDetails;
  secondaryAccount: BankAccountDetails;
  efilingUsername: string;
  /** Plaintext only while typing; sent once, never stored client-side. */
  efilingPassword: string;
  vatPeriod: VatPeriodCategory | '';
  currentPeriodVat: string;
  previousPeriodVat: string;
}

const emptyBankAccount = (): BankAccountDetails => ({
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  branchCode: '',
  accountType: '',
});

export function emptyEntityForm(entityType: RefundEntityType): EntityFormState {
  return {
    entityType,
    personalDetails: { name: '', surname: '', physicalAddress: '' },
    businessDetails: {
      companyName: '',
      registrationNumber: '',
      tradingName: '',
      registeredAddress: '',
      physicalBusinessAddress: '',
      contactPerson: '',
      contactPersonEmail: '',
      contactPersonPhone: '',
    },
    primaryAccount: emptyBankAccount(),
    secondaryAccount: emptyBankAccount(),
    efilingUsername: '',
    efilingPassword: '',
    vatPeriod: '',
    currentPeriodVat: '',
    previousPeriodVat: '',
  };
}

export function formFromEntity(entity: RefundEntity): EntityFormState {
  const base = emptyEntityForm(entity.entityType);
  return {
    ...base,
    personalDetails: { ...base.personalDetails, ...entity.personalDetails },
    businessDetails: { ...base.businessDetails, ...entity.businessDetails },
    primaryAccount: { ...base.primaryAccount, ...entity.bankingDetails?.primary },
    secondaryAccount: { ...base.secondaryAccount, ...entity.bankingDetails?.secondary },
    efilingUsername: entity.taxDetails?.efilingUsername ?? '',
    efilingPassword: '',
    vatPeriod: entity.taxDetails?.vatPeriod ?? '',
    currentPeriodVat: entity.taxDetails?.currentPeriodVat ?? '',
    previousPeriodVat: entity.taxDetails?.previousPeriodVat ?? '',
  };
}

/** Returns an error message, or null when the form can be submitted. */
export function validateEntityForm(form: EntityFormState): string | null {
  if (form.entityType === 'sole_proprietor') {
    if (!form.personalDetails.name.trim()) return 'Name is required';
    if (!form.personalDetails.surname.trim()) return 'Surname is required';
  } else {
    if (!form.businessDetails.companyName.trim()) return 'Company name is required';
    if (!form.businessDetails.registrationNumber.trim()) return 'Registration number is required';
    const email = form.businessDetails.contactPersonEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Contact person email is invalid';
    }
  }
  return null;
}

export function buildEntityPayload(form: EntityFormState): RefundEntityInput {
  const payload: RefundEntityInput = {
    entityType: form.entityType,
    bankingDetails: {
      primary: { ...form.primaryAccount },
      secondary: { ...form.secondaryAccount },
    },
    taxDetails: {
      efilingUsername: form.efilingUsername.trim(),
      vatPeriod: form.vatPeriod,
      currentPeriodVat: form.currentPeriodVat.trim(),
      previousPeriodVat: form.previousPeriodVat.trim(),
    },
  };
  // Only send the password when one was typed — an empty field on edit
  // must not clear the stored secret.
  if (form.efilingPassword) {
    payload.taxDetails!.efilingPassword = form.efilingPassword;
  }
  if (form.entityType === 'sole_proprietor') {
    payload.personalDetails = { ...form.personalDetails };
  } else {
    payload.businessDetails = { ...form.businessDetails };
  }
  return payload;
}

/** Display name for an entity in lists and dialogs. */
export function entityDisplayName(entity: RefundEntity): string {
  if (entity.entityType === 'company') {
    return entity.businessDetails?.companyName || 'Unnamed company';
  }
  const full = [entity.personalDetails?.name, entity.personalDetails?.surname]
    .filter(Boolean)
    .join(' ');
  return full || 'Unnamed sole proprietor';
}

/** Search across name, surname, company name and registration number. */
export function entityMatchesSearch(entity: RefundEntity, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    entity.personalDetails?.name,
    entity.personalDetails?.surname,
    entity.businessDetails?.companyName,
    entity.businessDetails?.tradingName,
    entity.businessDetails?.registrationNumber,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}
