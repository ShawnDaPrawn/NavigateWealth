/**
 * useProfileManager — Custom hook for all Profile page state and handlers.
 *
 * Extracts state management, data loading, save logic, and all entity CRUD
 * handlers from ProfilePage.tsx into a single hook, per Guidelines §6 / §4.1.
 *
 * Phase 4 refactor: entity CRUD boilerplate (7 types × ~7 handlers ≈ 600 lines)
 * replaced by useEntityCrud, a generic hook driven by per-entity configs in
 * entityConfigs.ts. The public API surface is unchanged — ProfilePage.tsx and
 * all section components require zero modifications.
 *
 * Bug fix: save handlers now properly gate edit-mode removal on validation
 * success. Previously, validation error toasts fired but the item still
 * exited edit mode.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ProfileData,
  BankAccount,
  FamilyMember,
  Asset,
  Liability,
  IdentityDocument,
  ChronicCondition,
  Employer,
  IdentityDocumentType,
  HandleInputChange,
} from '../types';
import { getInitialProfileData } from '../profileDefaults';
import {
  createBankAccount,
  createFamilyMember,
  createAsset,
  createLiability,
  createChronicCondition,
  createEmployer,
  createIdentityDocument,
  calculateRiskAssessment,
  calculateTotals,
} from '../profileHandlers';
import { useEntityCrud } from './useEntityCrud';
import {
  validateBankAccount,
  isBankAccountEmpty,
  validateFamilyMember,
  isFamilyMemberEmpty,
  validateAsset,
  isAssetEmpty,
  validateLiability,
  isLiabilityEmpty,
  validateChronicCondition,
  isChronicConditionEmpty,
  validateEmployer,
  isEmployerEmpty,
} from './entityConfigs';
import { formatCurrency } from '../../../../utils/currencyFormatter';
import { deepSanitize } from '../../../../utils/sanitization';
import { getSession } from '../../../../utils/auth/authService';
import { api } from '../../../../utils/api/client';
import { toast } from 'sonner@2.0.3';
import { getUserErrorMessage, isAbortError } from '../../../../utils/errorUtils';
import { projectId } from '../../../../utils/supabase/info';

// ============================================================================
// Hook Input
// ============================================================================

interface UseProfileManagerInput {
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  /** Callback to update the auth context user details after save */
  updateUser: (updates: { firstName: string; lastName: string; email: string }) => void;
}

// ============================================================================
// Hook Return Type
// ============================================================================

export interface ProfileManagerState {
  // Core data
  profileData: ProfileData;
  setProfileData: React.Dispatch<React.SetStateAction<ProfileData>>;
  handleInputChange: HandleInputChange;
  isLoading: boolean;
  initialLoading: boolean;
  saveSuccess: boolean;
  setSaveSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  handleSave: () => Promise<void>;
  /** True when profileData has diverged from the last saved/loaded state */
  isDirty: boolean;

  // Income display states
  grossIncomeDisplay: string | null;
  setGrossIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  netIncomeDisplay: string | null;
  setNetIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  grossAnnualIncomeDisplay: string | null;
  setGrossAnnualIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  netAnnualIncomeDisplay: string | null;
  setNetAnnualIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  incomeValidationError: string;
  setIncomeValidationError: React.Dispatch<React.SetStateAction<string>>;

  // Risk Assessment
  assessmentStarted: boolean;
  setAssessmentStarted: React.Dispatch<React.SetStateAction<boolean>>;
  updateRiskQuestion: (questionNumber: number, score: number) => void;
  resetRiskAssessment: () => void;
  allQuestionsAnswered: () => boolean;

  // Bank Account CRUD
  bankAccountsInEditMode: Set<string>;
  bankAccountToDelete: string | null;
  setBankAccountToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  proofOfBankToDelete: string | null;
  setProofOfBankToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  addBankAccount: () => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  saveBankAccount: (id: string) => void;
  editBankAccount: (id: string) => void;
  cancelEditBankAccount: (id: string) => void;
  confirmDeleteBankAccount: (id: string) => void;
  removeBankAccount: (id: string) => void;
  handleProofOfBankUpload: (id: string, file: File) => Promise<void>;
  confirmDeleteProofOfBank: (id: string) => void;
  removeProofOfBank: (id: string) => void;

  // Family Member CRUD
  familyMembersInEditMode: Set<string>;
  familyMemberToDelete: string | null;
  setFamilyMemberToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  addFamilyMember: () => void;
  updateFamilyMember: (id: string, updates: Partial<FamilyMember>) => void;
  saveFamilyMember: (id: string) => void;
  editFamilyMember: (id: string) => void;
  cancelEditFamilyMember: (id: string) => void;
  confirmDeleteFamilyMember: (id: string) => void;
  removeFamilyMember: (id: string) => void;

  // Asset CRUD
  assetsInEditMode: Set<string>;
  assetToDelete: string | null;
  setAssetToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  assetDisplayValues: { [id: string]: string };
  setAssetDisplayValues: React.Dispatch<React.SetStateAction<{ [id: string]: string }>>;
  addAsset: () => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  saveAsset: (id: string) => void;
  editAsset: (id: string) => void;
  cancelEditAsset: (id: string) => void;
  confirmDeleteAsset: (id: string) => void;
  removeAsset: (id: string) => void;

  // Liability CRUD
  liabilitiesInEditMode: Set<string>;
  liabilityToDelete: string | null;
  setLiabilityToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  liabilityDisplayValues: { [id: string]: { amount?: string; monthlyPayment?: string } };
  setLiabilityDisplayValues: React.Dispatch<React.SetStateAction<{ [id: string]: { amount?: string; monthlyPayment?: string } }>>;
  addLiability: () => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  saveLiability: (id: string) => void;
  editLiability: (id: string) => void;
  cancelEditLiability: (id: string) => void;
  confirmDeleteLiability: (id: string) => void;
  removeLiability: (id: string) => void;

  // Chronic Condition CRUD
  chronicConditionsInEditMode: Set<string>;
  chronicConditionToDelete: string | null;
  setChronicConditionToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  addChronicCondition: () => void;
  updateChronicCondition: (id: string, updates: Partial<ChronicCondition>) => void;
  saveChronicCondition: (id: string) => void;
  editChronicCondition: (id: string) => void;
  cancelEditChronicCondition: (id: string) => void;
  confirmDeleteChronicCondition: (id: string) => void;
  removeChronicCondition: (id: string) => void;

  // Employer CRUD
  employersInEditMode: Set<string>;
  employerToDelete: string | null;
  setEmployerToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  selfEmployedInEditMode: boolean;
  addEmployer: () => void;
  updateEmployer: (id: string, updates: Partial<Employer>) => void;
  saveEmployer: (id: string) => void;
  editEmployer: (id: string) => void;
  cancelEditEmployer: (id: string) => void;
  confirmDeleteEmployer: (id: string) => void;
  removeEmployer: (id: string) => void;
  editSelfEmployed: () => void;
  saveSelfEmployed: () => void;
  cancelEditSelfEmployed: () => void;

  // Identity Document CRUD
  identityDocsInEditMode: Set<string>;
  identityDocToDelete: string | null;
  setIdentityDocToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  hasDocumentType: (type: IdentityDocumentType) => boolean;
  addIdentityDocument: (type: IdentityDocumentType) => void;
  updateIdentityDocument: (id: string, updates: Partial<IdentityDocument>) => void;
  saveIdentityDocument: (id: string) => void;
  editIdentityDocument: (id: string) => void;
  cancelEditIdentityDocument: (id: string) => void;
  confirmDeleteIdentityDocument: (id: string) => void;
  removeIdentityDocument: (id: string) => void;
  handleDocumentUpload: (id: string, event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  getDocumentTypeLabel: (type: IdentityDocumentType) => string;
  getDocumentTypeIcon: (type: IdentityDocumentType) => { icon: React.ElementType; color: string };

  // Proof of Residence
  proofOfResidenceInEditMode: boolean;
  proofOfResidenceToDelete: boolean;
  setProofOfResidenceToDelete: React.Dispatch<React.SetStateAction<boolean>>;
  handleProofOfResidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  editProofOfResidence: () => void;
  saveProofOfResidence: () => void;
  confirmDeleteProofOfResidence: () => void;
  removeProofOfResidence: () => void;

  // Calculated values
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

// ============================================================================
// Icon imports (only used by getDocumentTypeIcon)
// ============================================================================

import { IdCard, FileText, CreditCard } from 'lucide-react';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useProfileManager({
  userEmail,
  userFirstName,
  userLastName,
  updateUser,
}: UseProfileManagerInput): ProfileManagerState {
  // ── Core state ──────────────────────────────────────────────────
  const [profileData, setProfileData] = useState<ProfileData>(
    getInitialProfileData(userEmail, userFirstName, userLastName)
  );
  const [originalData, setOriginalData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);

  // ── Display states for currency inputs ──────────────────────────
  const [grossIncomeDisplay, setGrossIncomeDisplay] = useState<string | null>(null);
  const [netIncomeDisplay, setNetIncomeDisplay] = useState<string | null>(null);
  const [grossAnnualIncomeDisplay, setGrossAnnualIncomeDisplay] = useState<string | null>(null);
  const [netAnnualIncomeDisplay, setNetAnnualIncomeDisplay] = useState<string | null>(null);

  // ── Display states for asset and liability currency inputs ──────
  const [assetDisplayValues, setAssetDisplayValues] = useState<{ [id: string]: string }>({});
  const [liabilityDisplayValues, setLiabilityDisplayValues] = useState<{ [id: string]: { amount?: string; monthlyPayment?: string } }>({});

  // ── Self-employed and proof-of-residence edit mode ──────────────
  const [selfEmployedInEditMode, setSelfEmployedInEditMode] = useState(false);
  const [proofOfResidenceInEditMode, setProofOfResidenceInEditMode] = useState(false);

  // ── Delete confirmation for proof-of-bank & proof-of-residence ─
  const [proofOfBankToDelete, setProofOfBankToDelete] = useState<string | null>(null);
  const [proofOfResidenceToDelete, setProofOfResidenceToDelete] = useState(false);

  // ── Validation state ────────────────────────────────────────────
  const [incomeValidationError, setIncomeValidationError] = useState('');

  // ── handleInputChange ───────────────────────────────────────────
  const handleInputChange: HandleInputChange = useCallback((field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // Entity CRUD via generic useEntityCrud hook (Phase 4)
  //
  // Each call replaces ~70 lines of hand-written add / update / save /
  // edit / cancelEdit / confirmDelete / remove handlers + state.
  // ══════════════════════════════════════════════════════════════════

  const bankAccountCrud = useEntityCrud<BankAccount>(
    profileData.bankAccounts,
    setProfileData,
    {
      arrayKey: 'bankAccounts',
      createItem: createBankAccount,
      validateItem: validateBankAccount,
      isItemEmpty: isBankAccountEmpty,
    },
  );

  const familyMemberCrud = useEntityCrud<FamilyMember>(
    profileData.familyMembers,
    setProfileData,
    {
      arrayKey: 'familyMembers',
      createItem: createFamilyMember,
      validateItem: validateFamilyMember,
      isItemEmpty: isFamilyMemberEmpty,
    },
  );

  const assetCrud = useEntityCrud<Asset>(
    profileData.assets,
    setProfileData,
    {
      arrayKey: 'assets',
      createItem: createAsset,
      validateItem: validateAsset,
      isItemEmpty: isAssetEmpty,
      onCleanup: (id) => {
        setAssetDisplayValues(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      },
    },
  );

  const liabilityCrud = useEntityCrud<Liability>(
    profileData.liabilities,
    setProfileData,
    {
      arrayKey: 'liabilities',
      createItem: createLiability,
      validateItem: validateLiability,
      isItemEmpty: isLiabilityEmpty,
      onCleanup: (id) => {
        setLiabilityDisplayValues(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      },
    },
  );

  const chronicConditionCrud = useEntityCrud<ChronicCondition>(
    profileData.chronicConditions,
    setProfileData,
    {
      arrayKey: 'chronicConditions',
      createItem: createChronicCondition,
      validateItem: validateChronicCondition,
      isItemEmpty: isChronicConditionEmpty,
    },
  );

  const employerCrud = useEntityCrud<Employer>(
    profileData.employers,
    setProfileData,
    {
      arrayKey: 'employers',
      createItem: createEmployer,
      validateItem: validateEmployer,
      isItemEmpty: isEmployerEmpty,
    },
  );

  // ══════════════════════════════════════════════════════════════════
  // Data Loading
  // ══════════════════════════════════════════════════════════════════

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadProfileData = async () => {
      try {
        const session = await getSession();
        if (signal.aborted) return;

        if (!session?.access_token || !session?.user?.id) {
          if (!signal.aborted) setInitialLoading(false);
          return;
        }

        const userId = session.user.id;
        const profileKey = `user_profile:${userId}:personal_info`;

        const result = await api.get<{ success: boolean; data: ProfileData }>(
          `/profile/personal-info?key=${encodeURIComponent(profileKey)}`
        );

        if (!signal.aborted) {
          if (result.success && result.data) {
            const grossAnnual = result.data.grossAnnualIncome ?? ((result.data.grossIncome || 0) * 12);
            const netAnnual = result.data.netAnnualIncome ?? ((result.data.netIncome || 0) * 12);

            const mergedData: ProfileData = {
              ...profileData,
              ...result.data,
              grossAnnualIncome: grossAnnual,
              netAnnualIncome: netAnnual,
              identityDocuments: result.data.identityDocuments || [],
              employers: result.data.employers || [],
              chronicConditions: result.data.chronicConditions || [],
              familyMembers: result.data.familyMembers || [],
              bankAccounts: result.data.bankAccounts || [],
              assets: result.data.assets || [],
              liabilities: result.data.liabilities || [],
              idCountry: result.data.idCountry || 'South Africa',
              idNumber: result.data.idNumber || '',
              passportCountry: result.data.passportCountry || '',
              passportNumber: result.data.passportNumber || '',
              employmentCountry: result.data.employmentCountry || '',
              workPermitNumber: result.data.workPermitNumber || '',
            };

            setProfileData(mergedData);
            setOriginalData(mergedData);
          }
        }
      } catch (error: unknown) {
        if (isAbortError(error)) return;
        const isNotFound =
          error && typeof error === 'object' && 'statusCode' in error && (error as Record<string, unknown>).statusCode === 404;

        if (isNotFound) {
          // Profile not found, use defaults (silent)
        } else {
          console.error('Failed to load profile data:', error);
          toast.error(getUserErrorMessage(error));
        }
      } finally {
        if (!signal.aborted) {
          setInitialLoading(false);
        }
      }
    };

    loadProfileData();

    return () => {
      controller.abort();
    };
  }, []);

  // ── Assessment completion check ─────────────────────────────────
  useEffect(() => {
    if (allQuestionsAnswered()) {
      setAssessmentStarted(true);
    }
  }, [profileData.riskAssessment]);

  // ── Auto-enable self-employed edit mode if empty ────────────────
  useEffect(() => {
    if (
      profileData.employmentStatus === 'self-employed' &&
      !profileData.selfEmployedIndustry &&
      !profileData.selfEmployedDescription
    ) {
      setSelfEmployedInEditMode(true);
    }
  }, [profileData.employmentStatus, profileData.selfEmployedIndustry, profileData.selfEmployedDescription]);

  // ══════════════════════════════════════════════════════════════════
  // Save Handler
  // ══════════════════════════════════════════════════════════════════

  const handleSave = useCallback(async () => {
    if (profileData.netIncome > profileData.grossIncome && profileData.grossIncome > 0) {
      setIncomeValidationError(
        `Net income (${formatCurrency(profileData.netIncome)}) cannot exceed gross income (${formatCurrency(profileData.grossIncome)}). Please correct this before saving.`
      );
      return;
    }

    setIsLoading(true);
    try {
      const session = await getSession();
      if (!session?.access_token || !session?.user?.id) {
        toast.error('Not authenticated. Please log in again.');
        setIsLoading(false);
        return;
      }

      const userId = session.user.id;
      const profileKey = `user_profile:${userId}:personal_info`;

      let patchData: Partial<ProfileData> = {};

      if (originalData) {
        (Object.keys(profileData) as Array<keyof ProfileData>).forEach(key => {
          if (profileData[key] !== originalData[key]) {
            // @ts-ignore - Dynamic assignment is safe here as keys match
            patchData[key] = profileData[key];
          }
        });
      } else {
        patchData = { ...profileData };
      }

      if (originalData && Object.keys(patchData).length === 0) {
        console.log('No top-level changes detected.');
        toast.success('Profile saved successfully!');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setIsLoading(false);
        return;
      }

      const cleanPatchData = deepSanitize(patchData);

      const payloadString = JSON.stringify(cleanPatchData);
      const payloadSize = payloadString.length;
      console.log(`Payload size: ${payloadSize} bytes`);

      if (payloadSize > 200000) {
        console.warn('Large payload detected (>200KB). Proceeding with save, but this may impact performance.');
      }

      if (Object.keys(cleanPatchData).length === 0) {
        console.log('Patch data empty after sanitization.');
        toast.success('Profile saved successfully!');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setIsLoading(false);
        return;
      }

      await api.post('/profile/personal-info', { key: profileKey, data: cleanPatchData });

      updateUser({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
      });

      setOriginalData({ ...profileData });

      toast.success('Profile saved successfully!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: unknown) {
      toast.error(`Failed to save: ${getUserErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [profileData, originalData, updateUser]);

  // ══════════════════════════════════════════════════════════════════
  // Bank-account-specific handlers (proof of bank upload)
  // Not covered by useEntityCrud — unique to BankAccount.
  // ══════════════════════════════════════════════════════════════════

  const handleProofOfBankUpload = useCallback(async (id: string, file: File) => {
    try {
      const session = await getSession();
      if (!session) { toast.error('You must be logged in to upload files'); return; }
      toast.info('Uploading document...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', session.user.id);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/profile/upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }
      );
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setProfileData(prev => ({
        ...prev,
        bankAccounts: prev.bankAccounts.map(a =>
          a.id === id ? { ...a, proofOfBankDocument: result.path, proofOfBankFileName: file.name } : a
        ),
      }));
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    }
  }, []);

  const confirmDeleteProofOfBank = useCallback((id: string) => {
    setProofOfBankToDelete(id);
  }, []);

  const removeProofOfBank = useCallback((id: string) => {
    setProfileData(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map(a =>
        a.id === id ? { ...a, proofOfBankDocument: undefined, proofOfBankFileName: undefined } : a
      ),
    }));
    setProofOfBankToDelete(null);
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // Self-Employed Handlers
  // ══════════════════════════════════════════════════════════════════

  const saveSelfEmployed = useCallback(() => {
    if (!profileData.selfEmployedIndustry || !profileData.selfEmployedDescription) {
      toast.error('Please fill in all required fields (Industry and Business Description) before saving');
      return;
    }
    setSelfEmployedInEditMode(false);
  }, [profileData.selfEmployedIndustry, profileData.selfEmployedDescription]);

  const cancelEditSelfEmployed = useCallback(() => { setSelfEmployedInEditMode(false); }, []);
  const editSelfEmployed = useCallback(() => { setSelfEmployedInEditMode(true); }, []);

  // ══════════════════════════════════════════════════════════════════
  // Risk Assessment Management
  // ══════════════════════════════════════════════════════════════════

  const updateRiskQuestion = useCallback((questionNumber: number, score: number) => {
    setProfileData(prev => {
      const updatedAssessment = { ...prev.riskAssessment, [`question${questionNumber}`]: score };
      const answers = [
        updatedAssessment.question1, updatedAssessment.question2, updatedAssessment.question3,
        updatedAssessment.question4, updatedAssessment.question5, updatedAssessment.question6,
        updatedAssessment.question7, updatedAssessment.question8, updatedAssessment.question9,
        updatedAssessment.question10,
      ];
      const derived = calculateRiskAssessment(answers);
      return {
        ...prev,
        riskAssessment: {
          ...updatedAssessment,
          ...derived,
        },
      };
    });
  }, []);

  const resetRiskAssessment = useCallback(() => {
    setProfileData(prev => ({
      ...prev,
      riskAssessment: {
        question1: 0, question2: 0, question3: 0, question4: 0, question5: 0,
        question6: 0, question7: 0, question8: 0, question9: 0, question10: 0,
        totalScore: 0, riskCategory: '', dateCompleted: '', canRetake: true,
      },
    }));
    setAssessmentStarted(false);
  }, []);

  const allQuestionsAnswered = useCallback(() => {
    const a = profileData.riskAssessment;
    return (
      a.question1 > 0 && a.question2 > 0 && a.question3 > 0 && a.question4 > 0 && a.question5 > 0 &&
      a.question6 > 0 && a.question7 > 0 && a.question8 > 0 && a.question9 > 0 && a.question10 > 0
    );
  }, [profileData.riskAssessment]);

  // ══════════════════════════════════════════════════════════════════
  // Identity Document Management
  //
  // Kept as manual handlers because:
  //  - add() takes a `type` parameter (not a simple factory)
  //  - save() has type-dependent validation
  //  - handleDocumentUpload is a complex async operation
  // ══════════════════════════════════════════════════════════════════

  const [identityDocsInEditMode, setIdentityDocsInEditMode] = useState<Set<string>>(new Set());
  const [identityDocToDelete, setIdentityDocToDelete] = useState<string | null>(null);

  const hasDocumentType = useCallback(
    (type: IdentityDocumentType) => profileData.identityDocuments.some(doc => doc.type === type),
    [profileData.identityDocuments]
  );

  const addIdentityDocument = useCallback((type: IdentityDocumentType) => {
    if (profileData.identityDocuments.some(doc => doc.type === type)) {
      const typeNames = { 'national-id': 'National ID', passport: 'Passport', 'drivers-license': "Driver's License" };
      toast.error(`You have already added a ${typeNames[type]}. Only one document of each type is allowed.`);
      return;
    }
    const newDoc: IdentityDocument = createIdentityDocument(type);
    setProfileData(prev => ({ ...prev, identityDocuments: [...prev.identityDocuments, newDoc] }));
    setIdentityDocsInEditMode(prev => new Set([...prev, newDoc.id]));
  }, [profileData.identityDocuments]);

  const handleDocumentUpload = useCallback(async (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) { toast.error('Please upload a PDF, JPG, or PNG file'); return; }
    try {
      const session = await getSession();
      if (!session) { toast.error('You must be logged in to upload files'); return; }
      toast.info('Uploading document...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', session.user.id);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/profile/upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }
      );
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setProfileData(prev => ({
        ...prev,
        identityDocuments: prev.identityDocuments.map(doc =>
          doc.id === id
            ? { ...doc, fileName: file.name, fileSize: file.size, fileUrl: result.path, uploadDate: new Date().toISOString(), isVerified: false }
            : doc
        ),
      }));
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    }
  }, []);

  const updateIdentityDocument = useCallback((id: string, updates: Partial<IdentityDocument>) => {
    setProfileData(prev => ({
      ...prev,
      identityDocuments: prev.identityDocuments.map(doc => (doc.id === id ? { ...doc, ...updates } : doc)),
    }));
  }, []);

  const confirmDeleteIdentityDocument = useCallback((id: string) => { setIdentityDocToDelete(id); }, []);

  const removeIdentityDocument = useCallback((id: string) => {
    setProfileData(prev => ({ ...prev, identityDocuments: prev.identityDocuments.filter(doc => doc.id !== id) }));
    setIdentityDocsInEditMode(prev => { const s = new Set(prev); s.delete(id); return s; });
    setIdentityDocToDelete(null);
  }, []);

  const saveIdentityDocument = useCallback((id: string) => {
    const doc = profileData.identityDocuments.find(d => d.id === id);
    if (doc?.type === 'national-id') {
      if (!doc.number || !doc.fileName) {
        toast.error('Please fill in the ID number and upload the document before saving');
        return;
      }
    }
    setIdentityDocsInEditMode(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, [profileData.identityDocuments]);

  const cancelEditIdentityDocument = useCallback((id: string) => {
    setProfileData(prev => {
      const doc = prev.identityDocuments.find(d => d.id === id);
      if (doc && !doc.number && !doc.fileName) {
        return { ...prev, identityDocuments: prev.identityDocuments.filter(d => d.id !== id) };
      }
      return prev;
    });
    setIdentityDocsInEditMode(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const editIdentityDocument = useCallback((id: string) => {
    setIdentityDocsInEditMode(prev => new Set([...prev, id]));
  }, []);

  // ── Document type helpers ───────────────────────────────────────

  const getDocumentTypeLabel = useCallback((type: IdentityDocumentType): string => {
    switch (type) {
      case 'national-id': return 'National ID Card';
      case 'passport': return 'Passport';
      case 'drivers-license': return "Driver's License";
      default: return type;
    }
  }, []);

  const getDocumentTypeIcon = useCallback((type: IdentityDocumentType): { icon: React.ElementType; color: string } => {
    switch (type) {
      case 'national-id': return { icon: IdCard, color: 'purple' };
      case 'passport': return { icon: FileText, color: 'blue' };
      case 'drivers-license': return { icon: CreditCard, color: 'amber' };
      default: return { icon: FileText, color: 'gray' };
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // Proof of Residence Handlers
  // ══════════════════════════════════════════════════════════════════

  const handleProofOfResidenceUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) { toast.error('Please upload a PDF, JPG, or PNG file'); return; }
    setProfileData(prev => ({ ...prev, proofOfResidenceUploaded: true, proofOfResidenceFileName: file.name }));
    setProofOfResidenceInEditMode(false);
  }, []);

  const editProofOfResidence = useCallback(() => { setProofOfResidenceInEditMode(true); }, []);
  const saveProofOfResidence = useCallback(() => { setProofOfResidenceInEditMode(false); }, []);
  const confirmDeleteProofOfResidence = useCallback(() => { setProofOfResidenceToDelete(true); }, []);

  const removeProofOfResidence = useCallback(() => {
    setProfileData(prev => ({ ...prev, proofOfResidenceUploaded: false, proofOfResidenceFileName: undefined }));
    setProofOfResidenceToDelete(false);
    setProofOfResidenceInEditMode(false);
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // Calculated Values (delegated to profileHandlers — §5.4 DRY)
  // ══════════════════════════════════════════════════════════════════

  const { totalAssets, totalLiabilities, netWorth } = calculateTotals(profileData);

  // ── isDirty check ───────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!originalData) return false;
    return JSON.stringify(profileData) !== JSON.stringify(originalData);
  }, [profileData, originalData]);

  // ══════════════════════════════════════════════════════════════════
  // Return — public API unchanged from pre-refactor
  // ══════════════════════════════════════════════════════════════════

  return {
    // Core data
    profileData,
    setProfileData,
    handleInputChange,
    isLoading,
    initialLoading,
    saveSuccess,
    setSaveSuccess,
    handleSave,
    isDirty,

    // Income display states
    grossIncomeDisplay,
    setGrossIncomeDisplay,
    netIncomeDisplay,
    setNetIncomeDisplay,
    grossAnnualIncomeDisplay,
    setGrossAnnualIncomeDisplay,
    netAnnualIncomeDisplay,
    setNetAnnualIncomeDisplay,
    incomeValidationError,
    setIncomeValidationError,

    // Risk Assessment
    assessmentStarted,
    setAssessmentStarted,
    updateRiskQuestion,
    resetRiskAssessment,
    allQuestionsAnswered,

    // Bank Account CRUD (generic) + bank-specific handlers
    bankAccountsInEditMode: bankAccountCrud.inEditMode,
    bankAccountToDelete: bankAccountCrud.itemToDelete,
    setBankAccountToDelete: bankAccountCrud.setItemToDelete,
    proofOfBankToDelete,
    setProofOfBankToDelete,
    addBankAccount: bankAccountCrud.add,
    updateBankAccount: bankAccountCrud.update,
    saveBankAccount: bankAccountCrud.save,
    editBankAccount: bankAccountCrud.edit,
    cancelEditBankAccount: bankAccountCrud.cancelEdit,
    confirmDeleteBankAccount: bankAccountCrud.confirmDelete,
    removeBankAccount: bankAccountCrud.remove,
    handleProofOfBankUpload,
    confirmDeleteProofOfBank,
    removeProofOfBank,

    // Family Member CRUD (generic)
    familyMembersInEditMode: familyMemberCrud.inEditMode,
    familyMemberToDelete: familyMemberCrud.itemToDelete,
    setFamilyMemberToDelete: familyMemberCrud.setItemToDelete,
    addFamilyMember: familyMemberCrud.add,
    updateFamilyMember: familyMemberCrud.update,
    saveFamilyMember: familyMemberCrud.save,
    editFamilyMember: familyMemberCrud.edit,
    cancelEditFamilyMember: familyMemberCrud.cancelEdit,
    confirmDeleteFamilyMember: familyMemberCrud.confirmDelete,
    removeFamilyMember: familyMemberCrud.remove,

    // Asset CRUD (generic)
    assetsInEditMode: assetCrud.inEditMode,
    assetToDelete: assetCrud.itemToDelete,
    setAssetToDelete: assetCrud.setItemToDelete,
    assetDisplayValues,
    setAssetDisplayValues,
    addAsset: assetCrud.add,
    updateAsset: assetCrud.update,
    saveAsset: assetCrud.save,
    editAsset: assetCrud.edit,
    cancelEditAsset: assetCrud.cancelEdit,
    confirmDeleteAsset: assetCrud.confirmDelete,
    removeAsset: assetCrud.remove,

    // Liability CRUD (generic)
    liabilitiesInEditMode: liabilityCrud.inEditMode,
    liabilityToDelete: liabilityCrud.itemToDelete,
    setLiabilityToDelete: liabilityCrud.setItemToDelete,
    liabilityDisplayValues,
    setLiabilityDisplayValues,
    addLiability: liabilityCrud.add,
    updateLiability: liabilityCrud.update,
    saveLiability: liabilityCrud.save,
    editLiability: liabilityCrud.edit,
    cancelEditLiability: liabilityCrud.cancelEdit,
    confirmDeleteLiability: liabilityCrud.confirmDelete,
    removeLiability: liabilityCrud.remove,

    // Chronic Condition CRUD (generic)
    chronicConditionsInEditMode: chronicConditionCrud.inEditMode,
    chronicConditionToDelete: chronicConditionCrud.itemToDelete,
    setChronicConditionToDelete: chronicConditionCrud.setItemToDelete,
    addChronicCondition: chronicConditionCrud.add,
    updateChronicCondition: chronicConditionCrud.update,
    saveChronicCondition: chronicConditionCrud.save,
    editChronicCondition: chronicConditionCrud.edit,
    cancelEditChronicCondition: chronicConditionCrud.cancelEdit,
    confirmDeleteChronicCondition: chronicConditionCrud.confirmDelete,
    removeChronicCondition: chronicConditionCrud.remove,

    // Employer CRUD (generic) + self-employed handlers
    employersInEditMode: employerCrud.inEditMode,
    employerToDelete: employerCrud.itemToDelete,
    setEmployerToDelete: employerCrud.setItemToDelete,
    selfEmployedInEditMode,
    addEmployer: employerCrud.add,
    updateEmployer: employerCrud.update,
    saveEmployer: employerCrud.save,
    editEmployer: employerCrud.edit,
    cancelEditEmployer: employerCrud.cancelEdit,
    confirmDeleteEmployer: employerCrud.confirmDelete,
    removeEmployer: employerCrud.remove,
    editSelfEmployed,
    saveSelfEmployed,
    cancelEditSelfEmployed,

    // Identity Document CRUD (manual — type-dependent logic)
    identityDocsInEditMode,
    identityDocToDelete,
    setIdentityDocToDelete,
    hasDocumentType,
    addIdentityDocument,
    updateIdentityDocument,
    saveIdentityDocument,
    editIdentityDocument,
    cancelEditIdentityDocument,
    confirmDeleteIdentityDocument,
    removeIdentityDocument,
    handleDocumentUpload,
    getDocumentTypeLabel,
    getDocumentTypeIcon,

    // Proof of Residence
    proofOfResidenceInEditMode,
    proofOfResidenceToDelete,
    setProofOfResidenceToDelete,
    handleProofOfResidenceUpload,
    editProofOfResidence,
    saveProofOfResidence,
    confirmDeleteProofOfResidence,
    removeProofOfResidence,

    // Calculated values
    totalAssets,
    totalLiabilities,
    netWorth,
  };
}