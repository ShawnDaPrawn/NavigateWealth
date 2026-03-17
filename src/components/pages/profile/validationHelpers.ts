/**
 * Profile Validation Helpers
 * Centralized validation logic for all profile sections
 */

import { ProfileData } from './types';

// Email validation
export const isValidEmail = (email: string): boolean => {
  if (!email) return true; // Empty is valid (will be checked by required validation)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone validation (South African format)
export const isValidPhone = (phone: string): boolean => {
  if (!phone) return true; // Empty is valid (will be checked by required validation)
  const phoneRegex = /^(\+27|0)[0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// ID Number validation (South African format - 13 digits)
export const isValidSAIdNumber = (idNumber: string): boolean => {
  if (!idNumber) return true;
  return /^[0-9]{13}$/.test(idNumber);
};

// Passport validation
export const isValidPassport = (passport: string): boolean => {
  if (!passport) return true;
  return passport.length >= 6 && passport.length <= 12;
};

// Date validation (not in future)
export const isValidPastDate = (date: string): boolean => {
  if (!date) return true;
  const selectedDate = new Date(date);
  const today = new Date();
  return selectedDate <= today;
};

// Contact Details Tab Validation
export const validateContactDetails = (data: ProfileData): boolean => {
  // Required fields
  if (!data.email || !data.phoneNumber || !data.preferredContactMethod) {
    return false;
  }

  // Email format validation
  if (!isValidEmail(data.email)) {
    return false;
  }

  // Secondary email validation (if provided)
  if (data.secondaryEmail && !isValidEmail(data.secondaryEmail)) {
    return false;
  }

  // Phone validation
  if (!isValidPhone(data.phoneNumber)) {
    return false;
  }

  // Alternative phone validation (if provided)
  if (data.alternativePhone && !isValidPhone(data.alternativePhone)) {
    return false;
  }

  // Emergency contact validation
  if (data.emergencyContactName || data.emergencyContactPhone || data.emergencyContactEmail) {
    // If any emergency contact field is filled, require all
    if (!data.emergencyContactName || !data.emergencyContactPhone || !data.emergencyContactRelationship) {
      return false;
    }
    if (data.emergencyContactEmail && !isValidEmail(data.emergencyContactEmail)) {
      return false;
    }
    if (!isValidPhone(data.emergencyContactPhone)) {
      return false;
    }
  }

  return true;
};

// Identity Tab Validation
export const validateIdentity = (data: ProfileData): boolean => {
  // At least one identity document must be uploaded and saved
  if (data.identityDocuments.length === 0) {
    return false;
  }

  // All documents must have required fields
  return data.identityDocuments.every(doc => {
    // Must have document number
    if (!doc.number) return false;

    // Must have uploaded file
    if (!doc.fileName) return false;

    // Type-specific validation
    if (doc.type === 'national-id') {
      return isValidSAIdNumber(doc.number);
    }

    if (doc.type === 'passport') {
      return isValidPassport(doc.number) && doc.expiryDate !== '';
    }

    if (doc.type === 'drivers-license') {
      return doc.number.length >= 8 && doc.expiryDate !== '';
    }

    return false;
  });
};

// Address Tab Validation
export const validateAddress = (data: ProfileData): boolean => {
  // Residential address is required
  if (!data.residentialAddressLine1 || 
      !data.residentialSuburb || 
      !data.residentialCity || 
      !data.residentialProvince || 
      !data.residentialPostalCode || 
      !data.residentialCountry) {
    return false;
  }

  // Proof of residence required
  if (!data.proofOfResidenceUploaded) {
    return false;
  }

  // Work address validation (if any field is filled, require key fields)
  const hasWorkAddress = data.workAddressLine1 || data.workSuburb || data.workCity;
  if (hasWorkAddress) {
    if (!data.workAddressLine1 || !data.workCity || !data.workCountry) {
      return false;
    }
  }

  return true;
};

// Employment Tab Validation
export const validateEmployment = (data: ProfileData): boolean => {
  // Employment status is required
  if (!data.employmentStatus) {
    return false;
  }

  // If employed, require employer details
  if (data.employmentStatus === 'employed') {
    if (data.employers.length === 0) {
      return false;
    }

    // Validate each employer — must have employerName, jobTitle, and industry
    return data.employers.every(employer => {
      return employer.employerName && 
             employer.jobTitle && 
             employer.industry;
    });
  }

  // If self-employed, require industry and description
  if (data.employmentStatus === 'self-employed') {
    return !!data.selfEmployedIndustry && !!data.selfEmployedDescription;
  }

  return true;
};

// Health Tab Validation
export const validateHealth = (data: ProfileData): boolean => {
  // Basic health info required
  if (!data.height || !data.weight || !data.bloodType) {
    return false;
  }

  // Height and weight must be reasonable
  if (data.height < 50 || data.height > 250) {
    return false;
  }

  if (data.weight < 20 || data.weight > 300) {
    return false;
  }

  return true;
};

// Family Tab Validation
export const validateFamily = (data: ProfileData): boolean => {
  // Family members are optional, but if added, must be valid
  if (data.familyMembers.length === 0) {
    return true; // No family members is valid
  }

  return data.familyMembers.every(member => {
    // Required fields
    if (!member.fullName || !member.relationship || !member.dateOfBirth || !member.gender) {
      return false;
    }

    // Date validation
    if (!isValidPastDate(member.dateOfBirth)) {
      return false;
    }

    // If sharing profile, email is required
    if (member.shareProfileInformation && !member.shareEmail) {
      return false;
    }

    // Email validation
    if (member.shareEmail && !isValidEmail(member.shareEmail)) {
      return false;
    }

    return true;
  });
};

// Banking Tab Validation
export const validateBanking = (data: ProfileData): boolean => {
  // At least one bank account required
  if (data.bankAccounts.length === 0) {
    return false;
  }

  // Exactly one primary account required
  const primaryAccounts = data.bankAccounts.filter(acc => acc.isPrimary);
  if (primaryAccounts.length !== 1) {
    return false;
  }

  // Validate each account
  return data.bankAccounts.every(account => {
    // Required fields
    if (!account.accountHolderName || 
        !account.bankName || 
        !account.accountNumber || 
        !account.accountType) {
      return false;
    }

    // If "Other Bank", custom name is required
    if (account.bankName === 'Other' && !account.customBankName) {
      return false;
    }

    // Branch code required for most account types
    if (account.accountType !== 'credit-card') {
      if (account.bankName === 'Other') {
        if (!account.customBranchCode) return false;
      } else {
        if (!account.branchCode) return false;
      }
    }

    // Account number validation (6-12 digits)
    if (account.accountNumber.length < 6 || account.accountNumber.length > 12) {
      return false;
    }

    // Proof of bank document required
    if (!account.proofOfBankDocument) {
      return false;
    }

    return true;
  });
};

// Assets & Liabilities Tab Validation
export const validateAssetsLiabilities = (data: ProfileData): boolean => {
  // Assets and liabilities are optional, but if added must be valid
  
  // Validate assets
  const assetsValid = data.assets.every(asset => {
    if (!asset.type || !asset.name || !asset.value || !asset.ownershipType) {
      return false;
    }

    // If custom type, require custom type name
    if (asset.type === 'other' && !asset.customType) {
      return false;
    }

    // Value must be positive
    if (asset.value <= 0) {
      return false;
    }

    return true;
  });

  // Validate liabilities
  const liabilitiesValid = data.liabilities.every(liability => {
    if (!liability.type || !liability.name || !liability.outstandingBalance || !liability.monthlyPayment) {
      return false;
    }

    // If custom type, require custom type name
    if (liability.type === 'other' && !liability.customType) {
      return false;
    }

    // Values must be positive
    if (liability.outstandingBalance <= 0 || liability.monthlyPayment <= 0) {
      return false;
    }

    // Interest rate must be reasonable
    if (liability.interestRate < 0 || liability.interestRate > 100) {
      return false;
    }

    return true;
  });

  return assetsValid && liabilitiesValid;
};

// Risk Profile Tab Validation
export const validateRiskProfile = (data: ProfileData): boolean => {
  const assessment = data.riskAssessment;
  
  // All 10 questions must be answered
  return (
    assessment.question1 > 0 &&
    assessment.question2 > 0 &&
    assessment.question3 > 0 &&
    assessment.question4 > 0 &&
    assessment.question5 > 0 &&
    assessment.question6 > 0 &&
    assessment.question7 > 0 &&
    assessment.question8 > 0 &&
    assessment.question9 > 0 &&
    assessment.question10 > 0
  );
};

// Master validation function - checks if entire profile is complete
export const isProfileComplete = (data: ProfileData): boolean => {
  return (
    validateContactDetails(data) &&
    validateIdentity(data) &&
    validateAddress(data) &&
    validateEmployment(data) &&
    validateHealth(data) &&
    validateFamily(data) &&
    validateBanking(data) &&
    validateAssetsLiabilities(data) &&
    validateRiskProfile(data)
  );
};

// Get validation status for each tab
export const getValidationStatus = (data: ProfileData) => {
  return {
    contact: validateContactDetails(data),
    identity: validateIdentity(data),
    address: validateAddress(data),
    employment: validateEmployment(data),
    health: validateHealth(data),
    family: validateFamily(data),
    banking: validateBanking(data),
    assetsLiabilities: validateAssetsLiabilities(data),
    riskProfile: validateRiskProfile(data),
  };
};