import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isValidSAIdNumber,
  isValidPassport,
  isValidPastDate,
  validateContactDetails,
  validateIdentity,
  validateAddress,
  validateEmployment,
  validateHealth,
  validateFamily,
  validateBanking,
  validateAssetsLiabilities,
  validateRiskProfile,
  isProfileComplete,
  getValidationStatus,
} from '../validationHelpers';
import type { ProfileData } from '../types';

/**
 * Builds a fully-valid ProfileData so every section validator returns true.
 * Each test clones this and breaks exactly one rule.
 */
function valid(): ProfileData {
  return {
    // Contact
    email: 'john@example.com',
    phoneNumber: '0821234567',
    preferredContactMethod: 'email',
    secondaryEmail: '',
    alternativePhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    emergencyContactRelationship: '',
    // Identity
    identityDocuments: [
      { type: 'national-id', number: '9001015800087', fileName: 'id.pdf', expiryDate: '' },
    ],
    // Address
    residentialAddressLine1: '1 Main Rd',
    residentialSuburb: 'Gardens',
    residentialCity: 'Cape Town',
    residentialProvince: 'Western Cape',
    residentialPostalCode: '8001',
    residentialCountry: 'South Africa',
    proofOfResidenceUploaded: true,
    workAddressLine1: '',
    workSuburb: '',
    workCity: '',
    workCountry: '',
    // Employment
    employmentStatus: 'employed',
    employers: [{ employerName: 'Acme', jobTitle: 'Engineer', industry: 'Technology' }],
    selfEmployedIndustry: '',
    selfEmployedDescription: '',
    // Health
    height: 180,
    weight: 80,
    bloodType: 'O+',
    // Family
    familyMembers: [],
    // Banking
    bankAccounts: [
      {
        isPrimary: true,
        accountHolderName: 'John Doe',
        bankName: 'FNB',
        accountNumber: '12345678',
        accountType: 'cheque',
        customBankName: '',
        branchCode: '250655',
        customBranchCode: '',
        proofOfBankDocument: 'bank.pdf',
      },
    ],
    // Assets & liabilities
    assets: [],
    liabilities: [],
    // Risk
    riskAssessment: {
      question1: 3,
      question2: 3,
      question3: 3,
      question4: 3,
      question5: 3,
      question6: 3,
      question7: 3,
      question8: 3,
      question9: 3,
      question10: 3,
    },
  } as unknown as ProfileData;
}

describe('isValidEmail', () => {
  it('treats empty as valid (required-check owns emptiness)', () => {
    expect(isValidEmail('')).toBe(true);
  });
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('john.doe@example.com')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts SA mobile formats and strips spaces', () => {
    expect(isValidPhone('0821234567')).toBe(true);
    expect(isValidPhone('+27821234567')).toBe(true);
    expect(isValidPhone('082 123 4567')).toBe(true);
  });
  it('treats empty as valid', () => {
    expect(isValidPhone('')).toBe(true);
  });
  it('rejects wrong length or non-numeric', () => {
    expect(isValidPhone('082123456')).toBe(false);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('+27abc123456')).toBe(false);
  });
});

describe('isValidSAIdNumber', () => {
  it('accepts exactly 13 digits and treats empty as valid', () => {
    expect(isValidSAIdNumber('9001015800087')).toBe(true);
    expect(isValidSAIdNumber('')).toBe(true);
  });
  it('rejects wrong length or non-digits', () => {
    expect(isValidSAIdNumber('900101580008')).toBe(false);
    expect(isValidSAIdNumber('90010158000ab')).toBe(false);
  });
});

describe('isValidPassport', () => {
  it('accepts 6-12 characters and treats empty as valid', () => {
    expect(isValidPassport('A123456')).toBe(true);
    expect(isValidPassport('')).toBe(true);
  });
  it('rejects too-short or too-long values', () => {
    expect(isValidPassport('A234')).toBe(false);
    expect(isValidPassport('A2345678901234')).toBe(false);
  });
});

describe('isValidPastDate', () => {
  it('accepts past dates and empty, rejects future dates', () => {
    expect(isValidPastDate('2000-01-01')).toBe(true);
    expect(isValidPastDate('')).toBe(true);
    expect(isValidPastDate('2999-12-31')).toBe(false);
  });
});

describe('validateContactDetails', () => {
  it('passes the valid fixture', () => {
    expect(validateContactDetails(valid())).toBe(true);
  });
  it('fails when a required field is missing', () => {
    const d = valid();
    d.email = '';
    expect(validateContactDetails(d)).toBe(false);
  });
  it('fails on a malformed email', () => {
    const d = valid();
    d.email = 'not-an-email';
    expect(validateContactDetails(d)).toBe(false);
  });
  it('requires all emergency fields once any one is filled', () => {
    const d = valid();
    d.emergencyContactName = 'Jane';
    expect(validateContactDetails(d)).toBe(false);
    d.emergencyContactPhone = '0827654321';
    d.emergencyContactRelationship = 'Sister';
    expect(validateContactDetails(d)).toBe(true);
  });
});

describe('validateIdentity', () => {
  it('passes a valid national-id document', () => {
    expect(validateIdentity(valid())).toBe(true);
  });
  it('fails with no documents', () => {
    const d = valid();
    d.identityDocuments = [];
    expect(validateIdentity(d)).toBe(false);
  });
  it('fails a national-id with an invalid number', () => {
    const d = valid();
    d.identityDocuments = [
      { type: 'national-id', number: '123', fileName: 'id.pdf', expiryDate: '' },
    ] as unknown as ProfileData['identityDocuments'];
    expect(validateIdentity(d)).toBe(false);
  });
  it('requires an expiry date for passports', () => {
    const d = valid();
    d.identityDocuments = [
      { type: 'passport', number: 'A123456', fileName: 'p.pdf', expiryDate: '' },
    ] as unknown as ProfileData['identityDocuments'];
    expect(validateIdentity(d)).toBe(false);
    d.identityDocuments = [
      { type: 'passport', number: 'A123456', fileName: 'p.pdf', expiryDate: '2030-01-01' },
    ] as unknown as ProfileData['identityDocuments'];
    expect(validateIdentity(d)).toBe(true);
  });
});

describe('validateAddress', () => {
  it('passes with full residential address and proof of residence', () => {
    expect(validateAddress(valid())).toBe(true);
  });
  it('fails when a residential field is missing', () => {
    const d = valid();
    d.residentialCity = '';
    expect(validateAddress(d)).toBe(false);
  });
  it('fails when proof of residence is not uploaded', () => {
    const d = valid();
    d.proofOfResidenceUploaded = false;
    expect(validateAddress(d)).toBe(false);
  });
  it('requires key work-address fields once a work address is started', () => {
    const d = valid();
    d.workAddressLine1 = '10 Office Park';
    expect(validateAddress(d)).toBe(false);
    d.workCity = 'Cape Town';
    d.workCountry = 'South Africa';
    expect(validateAddress(d)).toBe(true);
  });
});

describe('validateEmployment', () => {
  it('passes for an employed person with employer details', () => {
    expect(validateEmployment(valid())).toBe(true);
  });
  it('fails when employment status is missing', () => {
    const d = valid();
    d.employmentStatus = '' as unknown as ProfileData['employmentStatus'];
    expect(validateEmployment(d)).toBe(false);
  });
  it('fails an employed person with no employers', () => {
    const d = valid();
    d.employers = [];
    expect(validateEmployment(d)).toBe(false);
  });
  it('requires industry and description when self-employed', () => {
    const d = valid();
    d.employmentStatus = 'self-employed' as unknown as ProfileData['employmentStatus'];
    d.employers = [];
    expect(validateEmployment(d)).toBe(false);
    d.selfEmployedIndustry = 'Consulting';
    d.selfEmployedDescription = 'Independent advisory work';
    expect(validateEmployment(d)).toBe(true);
  });
});

describe('validateHealth', () => {
  it('passes with reasonable height and weight', () => {
    expect(validateHealth(valid())).toBe(true);
  });
  it('fails when a required field is missing', () => {
    const d = valid();
    d.bloodType = '';
    expect(validateHealth(d)).toBe(false);
  });
  it('rejects out-of-range height and weight', () => {
    const tall = valid();
    tall.height = 300;
    expect(validateHealth(tall)).toBe(false);
    const heavy = valid();
    heavy.weight = 5;
    expect(validateHealth(heavy)).toBe(false);
  });
});

describe('validateFamily', () => {
  it('treats no family members as valid', () => {
    expect(validateFamily(valid())).toBe(true);
  });
  it('validates a complete member with a past date of birth', () => {
    const d = valid();
    d.familyMembers = [
      {
        fullName: 'Sam Doe',
        relationship: 'Child',
        dateOfBirth: '2010-05-05',
        gender: 'male',
        shareProfileInformation: false,
        shareEmail: '',
      },
    ] as unknown as ProfileData['familyMembers'];
    expect(validateFamily(d)).toBe(true);
  });
  it('fails a member missing required fields', () => {
    const d = valid();
    d.familyMembers = [
      { fullName: '', relationship: 'Child', dateOfBirth: '2010-05-05', gender: 'male' },
    ] as unknown as ProfileData['familyMembers'];
    expect(validateFamily(d)).toBe(false);
  });
  it('requires a share email when sharing profile information', () => {
    const d = valid();
    d.familyMembers = [
      {
        fullName: 'Sam Doe',
        relationship: 'Child',
        dateOfBirth: '2010-05-05',
        gender: 'male',
        shareProfileInformation: true,
        shareEmail: '',
      },
    ] as unknown as ProfileData['familyMembers'];
    expect(validateFamily(d)).toBe(false);
  });
});

describe('validateBanking', () => {
  it('passes one valid primary account', () => {
    expect(validateBanking(valid())).toBe(true);
  });
  it('fails with no accounts', () => {
    const d = valid();
    d.bankAccounts = [];
    expect(validateBanking(d)).toBe(false);
  });
  it('requires exactly one primary account', () => {
    const d = valid();
    d.bankAccounts = [
      { ...d.bankAccounts[0], isPrimary: true },
      { ...d.bankAccounts[0], isPrimary: true, accountNumber: '87654321' },
    ];
    expect(validateBanking(d)).toBe(false);
  });
  it('rejects an account number outside 6-12 digits', () => {
    const d = valid();
    d.bankAccounts[0].accountNumber = '123';
    expect(validateBanking(d)).toBe(false);
  });
  it('requires proof-of-bank document', () => {
    const d = valid();
    d.bankAccounts[0].proofOfBankDocument = '';
    expect(validateBanking(d)).toBe(false);
  });
});

describe('validateAssetsLiabilities', () => {
  it('treats empty assets and liabilities as valid', () => {
    expect(validateAssetsLiabilities(valid())).toBe(true);
  });
  it('validates well-formed assets and liabilities', () => {
    const d = valid();
    d.assets = [
      { type: 'property', name: 'Home', value: 1000000, ownershipType: 'sole' },
    ] as unknown as ProfileData['assets'];
    d.liabilities = [
      {
        type: 'bond',
        name: 'Home Loan',
        outstandingBalance: 500000,
        monthlyPayment: 6000,
        interestRate: 11,
      },
    ] as unknown as ProfileData['liabilities'];
    expect(validateAssetsLiabilities(d)).toBe(true);
  });
  it('rejects a non-positive asset value', () => {
    const d = valid();
    d.assets = [
      { type: 'property', name: 'Home', value: 0, ownershipType: 'sole' },
    ] as unknown as ProfileData['assets'];
    expect(validateAssetsLiabilities(d)).toBe(false);
  });
  it('rejects an out-of-range interest rate', () => {
    const d = valid();
    d.liabilities = [
      {
        type: 'bond',
        name: 'Home Loan',
        outstandingBalance: 500000,
        monthlyPayment: 6000,
        interestRate: 250,
      },
    ] as unknown as ProfileData['liabilities'];
    expect(validateAssetsLiabilities(d)).toBe(false);
  });
});

describe('validateRiskProfile', () => {
  it('passes when all ten questions are answered', () => {
    expect(validateRiskProfile(valid())).toBe(true);
  });
  it('fails when any question is unanswered', () => {
    const d = valid();
    d.riskAssessment.question7 = 0;
    expect(validateRiskProfile(d)).toBe(false);
  });
});

describe('isProfileComplete / getValidationStatus', () => {
  it('reports a fully-valid profile as complete', () => {
    expect(isProfileComplete(valid())).toBe(true);
  });
  it('reports incomplete when one section fails', () => {
    const d = valid();
    d.bankAccounts = [];
    expect(isProfileComplete(d)).toBe(false);
  });
  it('returns a per-tab status map', () => {
    const status = getValidationStatus(valid());
    expect(status).toEqual({
      contact: true,
      identity: true,
      address: true,
      employment: true,
      health: true,
      family: true,
      banking: true,
      assetsLiabilities: true,
      riskProfile: true,
    });
  });
  it('flags only the failing tab', () => {
    const d = valid();
    d.height = 0;
    const status = getValidationStatus(d);
    expect(status.health).toBe(false);
    expect(status.contact).toBe(true);
  });
});
