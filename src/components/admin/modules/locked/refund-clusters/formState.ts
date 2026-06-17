/**
 * Refund Clusters — Entity form state helpers
 *
 * Pure functions shared by the entity form dialog: building an empty form,
 * hydrating it from an existing entity, validating, and converting the form
 * back into the API payload. Kept free of React so they are unit-testable.
 */

import type {
  BankAccountDetails,
  BankAccountInput,
  BusinessDetails,
  PersonalDetails,
  RefundEntity,
  RefundEntityInput,
  RefundEntityType,
} from './types';

/** Editable bank-account form fields plus write-only online-banking password. */
export interface BankAccountFormState {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  onlineUsername: string;
  /** Plaintext only while typing; sent once, never stored client-side. */
  onlinePassword: string;
  /** Server flag: an online-banking password is already stored. */
  hasOnlinePassword: boolean;
}

export interface EntityFormState {
  entityType: RefundEntityType;
  /** Assigned cluster manager id, or '' for unassigned. */
  managerId: string;
  personalDetails: PersonalDetails;
  businessDetails: BusinessDetails;
  primaryAccount: BankAccountFormState;
  secondaryAccount: BankAccountFormState;
  efilingUsername: string;
  /** Plaintext only while typing; sent once, never stored client-side. */
  efilingPassword: string;
  currentPeriodVat: string;
  previousPeriodVat: string;
}

const emptyBankAccount = (): BankAccountFormState => ({
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  branchCode: '',
  accountType: '',
  onlineUsername: '',
  onlinePassword: '',
  hasOnlinePassword: false,
});

function bankFormFromEntity(account?: BankAccountDetails): BankAccountFormState {
  return {
    ...emptyBankAccount(),
    bankName: account?.bankName ?? '',
    accountHolder: account?.accountHolder ?? '',
    accountNumber: account?.accountNumber ?? '',
    branchCode: account?.branchCode ?? '',
    accountType: account?.accountType ?? '',
    onlineUsername: account?.onlineUsername ?? '',
    hasOnlinePassword: account?.hasOnlinePassword ?? false,
  };
}

export function emptyEntityForm(entityType: RefundEntityType): EntityFormState {
  return {
    entityType,
    managerId: '',
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
    currentPeriodVat: '',
    previousPeriodVat: '',
  };
}

export function formFromEntity(entity: RefundEntity): EntityFormState {
  const base = emptyEntityForm(entity.entityType);
  return {
    ...base,
    managerId: entity.managerId ?? '',
    personalDetails: { ...base.personalDetails, ...entity.personalDetails },
    businessDetails: { ...base.businessDetails, ...entity.businessDetails },
    primaryAccount: bankFormFromEntity(entity.bankingDetails?.primary),
    secondaryAccount: bankFormFromEntity(entity.bankingDetails?.secondary),
    efilingUsername: entity.taxDetails?.efilingUsername ?? '',
    efilingPassword: '',
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

/** Convert a bank form section into the API payload (drops flags; password only if typed). */
function bankPayload(account: BankAccountFormState): BankAccountInput {
  const input: BankAccountInput = {
    bankName: account.bankName,
    accountHolder: account.accountHolder,
    accountNumber: account.accountNumber,
    branchCode: account.branchCode,
    accountType: account.accountType,
    onlineUsername: account.onlineUsername.trim(),
  };
  // Only send the password when one was typed — an empty field on edit
  // must not clear the stored secret.
  if (account.onlinePassword) {
    input.onlinePassword = account.onlinePassword;
  }
  return input;
}

export function buildEntityPayload(form: EntityFormState): RefundEntityInput {
  const payload: RefundEntityInput = {
    entityType: form.entityType,
    managerId: form.managerId || null,
    bankingDetails: {
      primary: bankPayload(form.primaryAccount),
      secondary: bankPayload(form.secondaryAccount),
    },
    taxDetails: {
      efilingUsername: form.efilingUsername.trim(),
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
