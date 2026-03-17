import { 
  ProfileData, 
  BankAccount, 
  FamilyMember, 
  Asset, 
  Liability, 
  ChronicCondition, 
  Employer, 
  IdentityDocument 
} from './types';

// Bank Account Handlers
export const createBankAccount = (): BankAccount => ({
  id: Date.now().toString(),
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  accountType: 'checking',
  branchCode: '',
  isPrimary: false,
});

// Family Member Handlers
export const createFamilyMember = (): FamilyMember => ({
  id: Date.now().toString(),
  fullName: '',
  relationship: '',
  dateOfBirth: '',
  gender: '',
  idPassportNumber: '',
  isFinanciallyDependent: false,
  isIncludedInEstatePlanning: false,
  shareProfileInformation: false,
  shareEmail: '',
  notes: ''
});

// Asset Handlers
export const createAsset = (): Asset => ({
  id: Date.now().toString(),
  type: '',
  name: '',
  description: '',
  value: 0,
  ownershipType: '',
  provider: '',
});

// Liability Handlers
export const createLiability = (): Liability => ({
  id: Date.now().toString(),
  type: '',
  name: '',
  description: '',
  provider: '',
  outstandingBalance: 0,
  monthlyPayment: 0,
  interestRate: 0,
});

// Chronic Condition Handlers
export const createChronicCondition = (): ChronicCondition => ({
  id: Date.now().toString(),
  conditionName: '',
  monthDiagnosed: '',
  yearDiagnosed: '',
  onTreatment: false,
  treatingDoctor: ''
});

// Employer Handlers
export const createEmployer = (): Employer => ({
  id: Date.now().toString(),
  jobTitle: '',
  employerName: '',
  industry: ''
});

// Identity Document Handlers
export const createIdentityDocument = (
  type: 'national-id' | 'passport' | 'drivers-license',
  fileName?: string,
  fileSize?: number
): IdentityDocument => ({
  id: Date.now().toString(),
  type,
  number: '',
  countryOfIssue: 'South Africa',
  expiryDate: '',
  fileName,
  fileSize,
  uploadDate: fileName ? new Date().toISOString() : undefined,
  isVerified: false
});

// Risk Assessment Calculation
export const calculateRiskAssessment = (answers: number[]) => {
  const totalScore = answers.reduce((sum, score) => sum + score, 0);
  const allAnswered = answers.length === 10 && answers.every(a => a > 0);

  let riskCategory = '';
  if (allAnswered) {
    if (totalScore >= 10 && totalScore <= 15) {
      riskCategory = 'Conservative';
    } else if (totalScore >= 16 && totalScore <= 22) {
      riskCategory = 'Moderate';
    } else if (totalScore >= 23 && totalScore <= 30) {
      riskCategory = 'Aggressive';
    }
  }

  return {
    totalScore,
    riskCategory,
    dateCompleted: allAnswered ? new Date().toISOString() : '',
    canRetake: allAnswered,
  };
};

// Calculate totals
export const calculateTotals = (profileData: ProfileData) => {
  const totalAssets = profileData.assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
  const totalLiabilities = profileData.liabilities.reduce((sum, liability) => sum + (liability.outstandingBalance || 0), 0);
  const netWorth = totalAssets - totalLiabilities;
  
  return { totalAssets, totalLiabilities, netWorth };
};

// Validate file upload
export const validateFileUpload = (file: File): { valid: boolean; error?: string } => {
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }

  // Validate file type
  const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Please upload a PDF, JPG, or PNG file' };
  }

  return { valid: true };
};