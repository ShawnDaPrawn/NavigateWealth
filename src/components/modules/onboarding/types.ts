export interface ApplicationData {
  // Step 1: Personal Information
  title: string;
  firstName: string;
  middleName: string;
  preferredName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  idType: 'sa_id' | 'passport' | '';
  idNumber: string;
  taxNumber: string;
  isSATaxResident: boolean | null;
  maritalStatus: string;
  maritalRegime: string;
  numberOfDependants: string;

  // Spouse Details (conditional on married/life partner)
  spouseFirstName: string;
  spouseLastName: string;
  spouseDateOfBirth: string;
  spouseEmployed: string;

  // Step 2: Contact Details
  emailAddress: string;
  alternativeEmail: string;
  cellphoneNumber: string;
  alternativeCellphone: string;
  whatsappNumber: string;
  preferredContactMethod: string;
  bestTimeToContact: string;
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  residentialSuburb: string;
  residentialCity: string;
  residentialProvince: string;
  residentialPostalCode: string;
  residentialCountry: string;

  // Step 3: Employment Information
  employmentStatus: string;
  jobTitle: string;
  employerName: string;
  industry: string;
  industryOther: string;
  selfEmployedCompanyName: string;
  selfEmployedIndustry: string;
  selfEmployedIndustryOther: string;
  selfEmployedDescription: string;
  grossMonthlyIncome: string;
  monthlyExpensesEstimate: string;

  // Step 4: Services & Interests
  accountReasons: string[];
  otherReason: string;
  financialGoals: string;
  urgency: string;
  existingProducts: string[];
  existingProductProviders: Record<string, string>;
  // referralSource and referralName removed — no longer collected
  referralSource: string;
  referralName: string;

  // Step 5: Terms & Conditions
  termsAccepted: boolean;
  popiaConsent: boolean;
  disclosureAcknowledged: boolean;
  faisAcknowledged: boolean;
  electronicCommunicationConsent: boolean;
  communicationConsent: boolean;
  signatureFullName: string;

  // Meta
  currentStep?: number;
}

export interface StepProps {
  data: ApplicationData;
  updateData: (field: keyof ApplicationData, value: ApplicationData[keyof ApplicationData]) => void;
  errors: string[];
}