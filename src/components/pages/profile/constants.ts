/**
 * Profile Constants
 * Centralized data options and constants
 */

export const SOUTH_AFRICAN_BANKS = [
  { value: 'absa', label: 'ABSA Bank', code: '632005' },
  { value: 'fnb', label: 'First National Bank (FNB)', code: '250655' },
  { value: 'standard', label: 'Standard Bank', code: '051001' },
  { value: 'nedbank', label: 'Nedbank', code: '198765' },
  { value: 'capitec', label: 'Capitec Bank', code: '470010' },
  { value: 'african-bank', label: 'African Bank', code: '430000' },
  { value: 'investec', label: 'Investec Bank', code: '580105' },
  { value: 'discovery', label: 'Discovery Bank', code: '679000' },
  { value: 'tymebank', label: 'TymeBank', code: '678910' },
  { value: 'Other', label: 'Other Bank', code: '' },
];

export const ACCOUNT_TYPES = [
  { value: 'savings', label: 'Savings Account' },
  { value: 'cheque', label: 'Cheque/Current Account' },
  { value: 'transmission', label: 'Transmission Account' },
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
];

export const RELATIONSHIP_TYPES = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'other', label: 'Other' },
];

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
  { value: 'domestic-partnership', label: 'Domestic Partnership' },
];

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Employed' },
  { value: 'self-employed', label: 'Self-Employed' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'student', label: 'Student' },
  { value: 'retired', label: 'Retired' },
];

export const BLOOD_TYPE_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
  { value: 'unknown', label: 'Unknown' },
];

export const SMOKING_STATUS_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'former', label: 'Former Smoker' },
  { value: 'current', label: 'Current Smoker' },
];

export const ALCOHOL_CONSUMPTION_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'moderately', label: 'Moderately' },
  { value: 'frequently', label: 'Frequently' },
];

export const ASSET_TYPES = [
  { value: 'property', label: 'Property/Real Estate' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'investment', label: 'Investment Account' },
  { value: 'retirement', label: 'Retirement Fund' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'business', label: 'Business Ownership' },
  { value: 'other', label: 'Other Asset' },
];

export const LIABILITY_TYPES = [
  { value: 'home-loan', label: 'Home Loan/Mortgage' },
  { value: 'vehicle-loan', label: 'Vehicle Loan' },
  { value: 'personal-loan', label: 'Personal Loan' },
  { value: 'credit-card', label: 'Credit Card Debt' },
  { value: 'student-loan', label: 'Student Loan' },
  { value: 'business-loan', label: 'Business Loan' },
  { value: 'other', label: 'Other Liability' },
];

export const OWNERSHIP_TYPES = [
  { value: 'sole', label: 'Sole Ownership' },
  { value: 'joint', label: 'Joint Ownership' },
  { value: 'company', label: 'Company Owned' },
  { value: 'trust', label: 'Trust Owned' },
];

export const INDUSTRY_OPTIONS = [
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'construction', label: 'Construction' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
];

export const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export const SOUTH_AFRICAN_PROVINCES = [
  { value: 'Eastern Cape', label: 'Eastern Cape' },
  { value: 'Free State', label: 'Free State' },
  { value: 'Gauteng', label: 'Gauteng' },
  { value: 'KwaZulu-Natal', label: 'KwaZulu-Natal' },
  { value: 'Limpopo', label: 'Limpopo' },
  { value: 'Mpumalanga', label: 'Mpumalanga' },
  { value: 'Northern Cape', label: 'Northern Cape' },
  { value: 'North West', label: 'North West' },
  { value: 'Western Cape', label: 'Western Cape' },
];

export const FILE_UPLOAD_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB in bytes
  acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
  acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
};

export const VALIDATION_MESSAGES = {
  required: 'This field is required',
  invalidEmail: 'Please enter a valid email address',
  invalidPhone: 'Please enter a valid phone number',
  invalidIdNumber: 'Please enter a valid 13-digit ID number',
  invalidPassport: 'Please enter a valid passport number (6-12 characters)',
  invalidDate: 'Please select a valid date',
  fileTooLarge: (maxMB: number) => `File size must be less than ${maxMB}MB`,
  invalidFileType: 'Please upload a PDF, JPG, or PNG file',
  primaryAccountRequired: 'You must have exactly one primary account',
};
