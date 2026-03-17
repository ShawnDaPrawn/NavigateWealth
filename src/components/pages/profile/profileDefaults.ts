import type { ProfileData } from './types';

export const getInitialProfileData = (
  userEmail?: string,
  userFirstName?: string,
  userLastName?: string,
): ProfileData => ({
  // Personal Information
  title: '',
  firstName: userFirstName || '',
  middleName: '',
  lastName: userLastName || '',
  dateOfBirth: '',
  gender: '',
  nationality: 'South Africa',
  taxNumber: '',
  maritalStatus: 'single',
  maritalRegime: '',
  grossIncome: 0,
  netIncome: 0,
  grossAnnualIncome: 0,
  netAnnualIncome: 0,

  // Contact Details
  email: userEmail || '',
  secondaryEmail: '',
  phoneNumber: '',
  alternativePhone: '',
  preferredContactMethod: 'email',

  // Emergency Contact
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
  emergencyContactEmail: '',

  // Identity
  idCountry: 'South Africa',
  idNumber: '',
  passportCountry: '',
  passportNumber: '',
  employmentCountry: '',
  workPermitNumber: '',
  identityDocuments: [],

  // Address
  residentialAddressLine1: '',
  residentialAddressLine2: '',
  residentialSuburb: '',
  residentialCity: '',
  residentialProvince: '',
  residentialPostalCode: '',
  residentialCountry: 'South Africa',
  proofOfResidenceUploaded: false,

  // Work Address
  workAddressLine1: '',
  workAddressLine2: '',
  workSuburb: '',
  workCity: '',
  workProvince: '',
  workPostalCode: '',
  workCountry: 'South Africa',

  // Employment
  employmentStatus: 'employed',
  employers: [],
  selfEmployedCompanyName: '',
  selfEmployedIndustry: '',
  selfEmployedDescription: '',
  additionalIncomeSources: [],

  // Health
  height: 0,
  heightUnit: 'cm',
  weight: 0,
  weightUnit: 'kg',
  bloodType: '',
  smokerStatus: false,
  hasChronicConditions: false,
  chronicConditions: [],

  // Family
  familyMembers: [],

  // Banking
  bankAccounts: [],

  // Risk Profile
  riskAssessment: {
    question1: 0,
    question2: 0,
    question3: 0,
    question4: 0,
    question5: 0,
    question6: 0,
    question7: 0,
    question8: 0,
    question9: 0,
    question10: 0,
    totalScore: 0,
    riskCategory: '',
    dateCompleted: '',
    canRetake: true,
  },

  // Assets & Liabilities
  assets: [],
  liabilities: [],
});
