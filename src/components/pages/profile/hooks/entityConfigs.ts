/**
 * Entity CRUD Configurations
 *
 * Per-entity validation, isEmpty, and factory configs used by useEntityCrud.
 * Extracted from the inline logic previously scattered across useProfileManager
 * to provide a single source of truth for each entity's CRUD behaviour.
 *
 * Guidelines: §5.3 (centralised constants), §7.1 (derived state as pure utility).
 */

import type {
  BankAccount,
  FamilyMember,
  Asset,
  Liability,
  ChronicCondition,
  Employer,
} from '../types';

// ============================================================================
// Bank Account
// ============================================================================

export const validateBankAccount = (account: BankAccount): string | null => {
  if (
    !account.accountHolderName ||
    !account.bankName ||
    !account.accountNumber ||
    !account.accountType
  ) {
    return 'Please fill in all required fields (Account Holder Name, Bank Name, Account Number, and Account Type) before saving';
  }
  if (account.bankName === 'Other') {
    if (!account.customBankName || !account.customBranchCode) {
      return 'For "Other" banks, please provide the Custom Bank Name and Custom Branch Code';
    }
  } else {
    if (!account.branchCode) {
      return 'Please provide the Branch Code before saving';
    }
  }
  return null;
};

export const isBankAccountEmpty = (account: BankAccount): boolean =>
  !account.accountHolderName &&
  !account.bankName &&
  !account.accountNumber &&
  !account.accountType;

// ============================================================================
// Family Member
// ============================================================================

export const validateFamilyMember = (member: FamilyMember): string | null => {
  if (!member.fullName || !member.relationship) {
    return 'Please fill in all required fields (Full Name and Relationship) before saving';
  }
  return null;
};

export const isFamilyMemberEmpty = (member: FamilyMember): boolean =>
  !member.fullName && !member.relationship;

// ============================================================================
// Asset
// ============================================================================

export const validateAsset = (asset: Asset): string | null => {
  if (!asset.type || !asset.name || !asset.ownershipType) {
    return 'Please fill in all required fields (Asset Type, Asset Name, and Ownership Type) before saving';
  }
  if (asset.type === 'Other' && !asset.customType) {
    return 'For "Other" asset types, please specify the custom asset type';
  }
  return null;
};

export const isAssetEmpty = (asset: Asset): boolean =>
  !asset.type && !asset.name && !asset.ownershipType;

// ============================================================================
// Liability
// ============================================================================

export const validateLiability = (liability: Liability): string | null => {
  if (!liability.type || !liability.name || !liability.provider) {
    return 'Please fill in all required fields (Liability Type, Liability Name, and Provider) before saving';
  }
  if (liability.type === 'Other' && !liability.customType) {
    return 'For "Other" liability types, please specify the custom liability type';
  }
  return null;
};

export const isLiabilityEmpty = (liability: Liability): boolean =>
  !liability.type && !liability.name && !liability.provider;

// ============================================================================
// Chronic Condition
// ============================================================================

export const validateChronicCondition = (condition: ChronicCondition): string | null => {
  if (!condition.conditionName) {
    return 'Please enter the name of the condition before saving';
  }
  return null;
};

export const isChronicConditionEmpty = (condition: ChronicCondition): boolean =>
  !condition.conditionName;

// ============================================================================
// Employer
// ============================================================================

export const validateEmployer = (employer: Employer): string | null => {
  if (!employer.employerName || !employer.jobTitle || !employer.industry) {
    return 'Please fill in all required fields (Employer Name, Job Title, and Industry) before saving';
  }
  return null;
};

export const isEmployerEmpty = (employer: Employer): boolean =>
  !employer.employerName && !employer.jobTitle && !employer.industry;
