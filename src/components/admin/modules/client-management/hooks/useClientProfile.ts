import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clientApi, getClientProfileQueryOptions } from '../api';
import { clientKeys } from './queryKeys';
import { Client, ProfileData } from '../types';
import { createIdentityDocumentHandlers } from './clientProfile/identityDocumentHandlers';
import { createProofOfResidenceHandlers } from './clientProfile/proofOfResidenceHandlers';
import { createEmployerHandlers } from './clientProfile/employerHandlers';
import { createChronicConditionHandlers } from './clientProfile/chronicConditionHandlers';
import { createFamilyMemberHandlers } from './clientProfile/familyMemberHandlers';
import { createBankAccountHandlers } from './clientProfile/bankAccountHandlers';
import { createRiskAssessmentHandlers } from './clientProfile/riskAssessmentHandlers';
import { createAssetHandlers } from './clientProfile/assetHandlers';
import { createLiabilityHandlers } from './clientProfile/liabilityHandlers';

/**
 * Create a stable, comparable snapshot of profile data for dirty detection.
 * Sorts object keys recursively to ensure consistent serialisation regardless
 * of property insertion order. Excludes transient/UI-only fields.
 *
 * §7.1 — Pure utility for derived state.
 */
function createProfileSnapshot(data: ProfileData): string {
  return JSON.stringify(data, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Sort keys for deterministic serialisation
      return Object.keys(value)
        .sort()
        .reduce((sorted: Record<string, unknown>, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {});
    }
    return value;
  });
}

export function useClientProfile(clientData: Client, onSave?: (data: ProfileData) => void) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track a snapshot of loaded data to compare against for dirty detection.
  const [loadedProfileSnapshot, setLoadedProfileSnapshot] = useState<string | null>(null);
  const loadedProfileDataRef = useRef<ProfileData | null>(null);
  // Flag to trigger snapshot capture after profileData has been updated from the server
  const [snapshotPending, setSnapshotPending] = useState(false);

  const initialPersonalInfo = clientData.profile?.personalInformation;

  // Initialize profile data
  const [profileData, setProfileData] = useState<ProfileData>({
    title: initialPersonalInfo?.title || '',
    firstName: initialPersonalInfo?.firstName || clientData.firstName || '',
    middleName: initialPersonalInfo?.middleName || '',
    lastName: initialPersonalInfo?.lastName || clientData.lastName || '',
    dateOfBirth: initialPersonalInfo?.dateOfBirth || '',
    gender: initialPersonalInfo?.gender || '',
    nationality: initialPersonalInfo?.nationality || 'South Africa',
    taxNumber: initialPersonalInfo?.taxNumber || '',
    maritalStatus: initialPersonalInfo?.maritalStatus || 'single',
    maritalRegime: initialPersonalInfo?.maritalRegime || '',
    grossIncome: initialPersonalInfo?.grossIncome || 0,
    netIncome: initialPersonalInfo?.netIncome || 0,
    grossMonthlyIncome:
      initialPersonalInfo?.grossMonthlyIncome || initialPersonalInfo?.grossIncome || 0,
    netMonthlyIncome: initialPersonalInfo?.netMonthlyIncome || initialPersonalInfo?.netIncome || 0,
    grossAnnualIncome:
      initialPersonalInfo?.grossAnnualIncome ||
      (initialPersonalInfo?.grossMonthlyIncome || initialPersonalInfo?.grossIncome || 0) * 12,
    netAnnualIncome:
      initialPersonalInfo?.netAnnualIncome ||
      (initialPersonalInfo?.netMonthlyIncome || initialPersonalInfo?.netIncome || 0) * 12,
    email: initialPersonalInfo?.email || clientData.email || '',
    secondaryEmail: initialPersonalInfo?.secondaryEmail || '',
    phoneNumber: initialPersonalInfo?.phoneNumber || '',
    alternativePhone: initialPersonalInfo?.alternativePhone || '',
    preferredContactMethod: initialPersonalInfo?.preferredContactMethod || 'email',
    emergencyContactName: initialPersonalInfo?.emergencyContactName || '',
    emergencyContactRelationship: initialPersonalInfo?.emergencyContactRelationship || '',
    emergencyContactPhone: initialPersonalInfo?.emergencyContactPhone || '',
    emergencyContactEmail: initialPersonalInfo?.emergencyContactEmail || '',

    // Identity Fields - Initialize with defaults to avoid uncontrolled input warning
    idCountry: initialPersonalInfo?.idCountry || 'South Africa',
    idNumber: initialPersonalInfo?.idNumber || '',
    passportCountry: initialPersonalInfo?.passportCountry || '',
    passportNumber: initialPersonalInfo?.passportNumber || '',
    employmentCountry: initialPersonalInfo?.employmentCountry || '',
    workPermitNumber: initialPersonalInfo?.workPermitNumber || '',

    identityDocuments: initialPersonalInfo?.identityDocuments || [],
    residentialAddressLine1: initialPersonalInfo?.residentialAddressLine1 || '',
    residentialAddressLine2: initialPersonalInfo?.residentialAddressLine2 || '',
    residentialSuburb: initialPersonalInfo?.residentialSuburb || '',
    residentialCity: initialPersonalInfo?.residentialCity || '',
    residentialProvince: initialPersonalInfo?.residentialProvince || '',
    residentialPostalCode: initialPersonalInfo?.residentialPostalCode || '',
    residentialCountry: initialPersonalInfo?.residentialCountry || 'South Africa',
    proofOfResidenceUploaded: initialPersonalInfo?.proofOfResidenceUploaded || false,
    workAddressLine1: initialPersonalInfo?.workAddressLine1 || '',
    workAddressLine2: initialPersonalInfo?.workAddressLine2 || '',
    workSuburb: initialPersonalInfo?.workSuburb || '',
    workCity: initialPersonalInfo?.workCity || '',
    workProvince: initialPersonalInfo?.workProvince || '',
    workPostalCode: initialPersonalInfo?.workPostalCode || '',
    workCountry: initialPersonalInfo?.workCountry || 'South Africa',
    employmentStatus: initialPersonalInfo?.employmentStatus || 'employed',
    employers: initialPersonalInfo?.employers || [],
    selfEmployedCompanyName: initialPersonalInfo?.selfEmployedCompanyName || '',
    selfEmployedIndustry: initialPersonalInfo?.selfEmployedIndustry || '',
    selfEmployedDescription: initialPersonalInfo?.selfEmployedDescription || '',
    additionalIncomeSources: initialPersonalInfo?.additionalIncomeSources || [],
    height: initialPersonalInfo?.height || 0,
    heightUnit: initialPersonalInfo?.heightUnit || 'cm',
    weight: initialPersonalInfo?.weight || 0,
    weightUnit: initialPersonalInfo?.weightUnit || 'kg',
    bloodType: initialPersonalInfo?.bloodType || '',
    smokerStatus: initialPersonalInfo?.smokerStatus || false,
    hasChronicConditions: initialPersonalInfo?.hasChronicConditions || false,
    chronicConditions: initialPersonalInfo?.chronicConditions || [],
    familyMembers: initialPersonalInfo?.familyMembers || [],
    bankAccounts: initialPersonalInfo?.bankAccounts || [],
    riskAssessment: initialPersonalInfo?.riskAssessment || {
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
    assets: initialPersonalInfo?.assets || [],
    liabilities: initialPersonalInfo?.liabilities || [],
    budgetExpenses: initialPersonalInfo?.budgetExpenses || [],
  });

  // Edit mode tracking states
  const [assetsInEditMode, setAssetsInEditMode] = useState<Set<string>>(new Set());
  const [liabilitiesInEditMode, setLiabilitiesInEditMode] = useState<Set<string>>(new Set());
  const [familyMembersInEditMode, setFamilyMembersInEditMode] = useState<Set<string>>(new Set());
  const [bankAccountsInEditMode, setBankAccountsInEditMode] = useState<Set<string>>(new Set());
  const [employersInEditMode, setEmployersInEditMode] = useState<Set<string>>(new Set());
  const [chronicConditionsInEditMode, setChronicConditionsInEditMode] = useState<Set<string>>(
    new Set(),
  );
  const [identityDocsInEditMode, setIdentityDocsInEditMode] = useState<Set<string>>(new Set());
  const [selfEmployedInEditMode, setSelfEmployedInEditMode] = useState(false);

  // Delete confirmation states
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [liabilityToDelete, setLiabilityToDelete] = useState<string | null>(null);
  const [bankAccountToDelete, setBankAccountToDelete] = useState<string | null>(null);
  const [familyMemberToDelete, setFamilyMemberToDelete] = useState<string | null>(null);
  const [chronicConditionToDelete, setChronicConditionToDelete] = useState<string | null>(null);
  const [employerToDelete, setEmployerToDelete] = useState<string | null>(null);
  const [identityDocToDelete, setIdentityDocToDelete] = useState<string | null>(null);
  const [proofOfResidenceToDelete, setProofOfResidenceToDelete] = useState(false);
  const [proofOfResidenceInEditMode, setProofOfResidenceInEditMode] = useState(false);
  const [proofOfBankToDelete, setProofOfBankToDelete] = useState<string | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);

  // Display states for currency
  const [grossIncomeDisplay, setGrossIncomeDisplay] = useState<string | null>(null);
  const [netIncomeDisplay, setNetIncomeDisplay] = useState<string | null>(null);
  const [assetDisplayValues, setAssetDisplayValues] = useState<{ [id: string]: string }>({});
  const [liabilityDisplayValues, setLiabilityDisplayValues] = useState<{
    [id: string]: { amount?: string; monthlyPayment?: string };
  }>({});

  // Validation state for income fields
  const [incomeValidationError, setIncomeValidationError] = useState('');

  // Check if all 10 questions have been answered
  const allQuestionsAnswered = useCallback(() => {
    const assessment = profileData.riskAssessment;
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
  }, [profileData.riskAssessment]);

  // Check if assessment has been completed (all questions answered)
  useEffect(() => {
    if (allQuestionsAnswered()) {
      setAssessmentStarted(true);
    }
  }, [profileData.riskAssessment, allQuestionsAnswered]);

  // Load profile data from backend when client changes
  useEffect(() => {
    const loadClientProfile = async () => {
      if (!clientData) return;

      const userId = clientData.id;
      if (!userId) {
        console.error('No user ID found for client');
        return;
      }

      try {
        const profile = await queryClient.fetchQuery(getClientProfileQueryOptions(userId));
        if (profile) {
          const grossAnnual =
            profile.grossAnnualIncome ??
            (profile.grossMonthlyIncome || profile.grossIncome || 0) * 12;
          const netAnnual =
            profile.netAnnualIncome ?? (profile.netMonthlyIncome || profile.netIncome || 0) * 12;

          setProfileData((prev) => ({
            ...prev,
            ...profile,
            grossAnnualIncome: grossAnnual,
            netAnnualIncome: netAnnual,
            // Ensure arrays are properly initialized
            identityDocuments: profile.identityDocuments || [],
            employers: profile.employers || [],
            chronicConditions: profile.chronicConditions || [],
            familyMembers: profile.familyMembers || [],
            bankAccounts: profile.bankAccounts || [],
            assets: profile.assets || [],
            liabilities: profile.liabilities || [],
            budgetExpenses: profile.budgetExpenses || [],
            // Ensure identity fields are not undefined/null
            idCountry: profile.idCountry || 'South Africa',
            idNumber: profile.idNumber || '',
            passportCountry: profile.passportCountry || '',
            passportNumber: profile.passportNumber || '',
            employmentCountry: profile.employmentCountry || '',
            workPermitNumber: profile.workPermitNumber || '',
          }));
          setSnapshotPending(true);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        // Fallback to clientData
        const personalInfo = clientData.profile?.personalInformation;
        setProfileData((prev) => ({
          ...prev,
          ...(personalInfo || {}),
          firstName: personalInfo?.firstName || clientData.firstName || '',
          lastName: personalInfo?.lastName || clientData.lastName || '',
          email: personalInfo?.email || clientData.email || '',
          bankAccounts: personalInfo?.bankAccounts || [],
          familyMembers: personalInfo?.familyMembers || [],
          assets: personalInfo?.assets || [],
          liabilities: personalInfo?.liabilities || [],
          chronicConditions: personalInfo?.chronicConditions || [],
          employers: personalInfo?.employers || [],
          identityDocuments: personalInfo?.identityDocuments || [],

          // Identity defaults for fallback
          idCountry: personalInfo?.idCountry || 'South Africa',
          idNumber: personalInfo?.idNumber || '',
          passportCountry: personalInfo?.passportCountry || '',
          passportNumber: personalInfo?.passportNumber || '',
          employmentCountry: personalInfo?.employmentCountry || '',
          workPermitNumber: personalInfo?.workPermitNumber || '',
        }));
      } finally {
        setHasChanges(false);
        setLoading(false);
      }
    };

    loadClientProfile();
  }, [clientData, queryClient]);

  // Capture snapshot of merged profileData after server data has been applied.
  // Runs once after load, and again after save. The snapshot represents the
  // "last known clean" state for dirty detection.
  useEffect(() => {
    if (snapshotPending) {
      const snapshot = createProfileSnapshot(profileData);
      setLoadedProfileSnapshot(snapshot);
      loadedProfileDataRef.current = { ...profileData };
      setSnapshotPending(false);
      setHasChanges(false);
    }
  }, [snapshotPending, profileData]);

  /**
   * Snapshot-based dirty detection.
   *
   * Compares the current profileData against the last-loaded (or last-saved)
   * snapshot. This is the authoritative source for `hasChanges`:
   * - If the user edits a field then reverts it, `hasChanges` returns to `false`
   * - If the user adds an entity then removes it, `hasChanges` returns to `false`
   * - After save, the snapshot is updated so `hasChanges` resets correctly
   *
   * Individual mutation handlers still call `setHasChanges(true)` for immediate
   * feedback, but this effect reconciles the true state on the next render cycle.
   */
  useEffect(() => {
    // Skip during initial load or while a snapshot capture is pending
    if (!loadedProfileSnapshot || snapshotPending || loading) return;
    const currentSnapshot = createProfileSnapshot(profileData);
    const isDirty = currentSnapshot !== loadedProfileSnapshot;
    setHasChanges(isDirty);
  }, [profileData, loadedProfileSnapshot, snapshotPending, loading]);

  const handleInputChange = (
    field: keyof ProfileData,
    value: string | number | boolean | unknown[],
  ) => {
    const updates: Partial<ProfileData> = { [field]: value };

    // Auto-calculate annual income from monthly
    if (field === 'grossMonthlyIncome') {
      const monthly = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (!isNaN(monthly)) {
        updates.grossAnnualIncome = monthly * 12;
        updates.grossIncome = monthly; // Sync with legacy field
      }
    }
    if (field === 'netMonthlyIncome') {
      const monthly = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (!isNaN(monthly)) {
        updates.netAnnualIncome = monthly * 12;
        updates.netIncome = monthly; // Sync with legacy field
      }
    }

    setProfileData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async (): Promise<boolean> => {
    try {
      setSaving(true);
      const userId = clientData.id;
      if (!userId) {
        toast.error('Client user ID not found');
        return false;
      }

      // Legacy KV rows may embed `personalInformation` alongside flat fields; saving both
      // can leave stale nested first/last names in KV that override root edits elsewhere.
      const dirty = profileData as ProfileData & { personalInformation?: unknown };
      const { personalInformation: _legacyNestedRemoved, ...profilePayload } = dirty;

      await clientApi.updateClientProfile(userId, profilePayload as ProfileData);
      queryClient.setQueryData(
        getClientProfileQueryOptions(userId).queryKey,
        profilePayload as ProfileData,
      );
      setProfileData(profilePayload as ProfileData);
      await queryClient.invalidateQueries({ queryKey: clientKeys.lists() });

      toast.success('Profile updated successfully');
      setLoadedProfileSnapshot(createProfileSnapshot(profilePayload as ProfileData));
      loadedProfileDataRef.current = profilePayload as ProfileData;
      setHasChanges(false);
      if (onSave) onSave(profilePayload as ProfileData);
      return true;
    } catch (error) {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = useCallback(() => {
    const baseline = loadedProfileDataRef.current;
    if (!baseline) return;

    setProfileData({ ...baseline });
    setHasChanges(false);
    setIncomeValidationError('');
    setGrossIncomeDisplay(null);
    setNetIncomeDisplay(null);
    setAssetDisplayValues({});
    setLiabilityDisplayValues({});
    setAssetsInEditMode(new Set());
    setLiabilitiesInEditMode(new Set());
    setFamilyMembersInEditMode(new Set());
    setBankAccountsInEditMode(new Set());
    setEmployersInEditMode(new Set());
    setChronicConditionsInEditMode(new Set());
    setIdentityDocsInEditMode(new Set());
    setSelfEmployedInEditMode(false);
    setProofOfResidenceInEditMode(false);
    setAssetToDelete(null);
    setLiabilityToDelete(null);
    setBankAccountToDelete(null);
    setFamilyMemberToDelete(null);
    setChronicConditionToDelete(null);
    setEmployerToDelete(null);
    setIdentityDocToDelete(null);
    setProofOfResidenceToDelete(false);
    setProofOfBankToDelete(null);
  }, []);

  // ── Collection editors ─────────────────────────────────────────────
  // Each group is a plain factory over the state this hook owns; see
  // `clientProfile/` for why they are functions rather than hooks.
  const {
    hasDocumentType,
    addIdentityDocument,
    handleDocumentUpload,
    updateIdentityDocument,
    confirmDeleteIdentityDocument,
    removeIdentityDocument,
    saveIdentityDocument,
    cancelEditIdentityDocument,
    editIdentityDocument,
    getDocumentTypeLabel,
    getDocumentTypeIcon,
  } = createIdentityDocumentHandlers({
    profileData,
    setHasChanges,
    setIdentityDocToDelete,
    setIdentityDocsInEditMode,
    setProfileData,
  });

  const {
    handleProofOfResidenceUpload,
    editProofOfResidence,
    saveProofOfResidence,
    confirmDeleteProofOfResidence,
    removeProofOfResidence,
  } = createProofOfResidenceHandlers({
    setHasChanges,
    setProfileData,
    setProofOfResidenceInEditMode,
    setProofOfResidenceToDelete,
  });

  const {
    addEmployer,
    confirmDeleteEmployer,
    removeEmployer,
    updateEmployer,
    saveEmployer,
    editEmployer,
    cancelEditEmployer,
    saveSelfEmployed,
    cancelEditSelfEmployed,
    editSelfEmployed,
  } = createEmployerHandlers({
    employerToDelete,
    profileData,
    setEmployerToDelete,
    setEmployersInEditMode,
    setHasChanges,
    setProfileData,
    setSelfEmployedInEditMode,
  });

  const {
    addChronicCondition,
    confirmDeleteChronicCondition,
    removeChronicCondition,
    updateChronicCondition,
    saveChronicCondition,
    editChronicCondition,
    cancelEditChronicCondition,
  } = createChronicConditionHandlers({
    chronicConditionToDelete,
    profileData,
    setChronicConditionToDelete,
    setChronicConditionsInEditMode,
    setHasChanges,
    setProfileData,
  });

  const {
    addFamilyMember,
    confirmDeleteFamilyMember,
    removeFamilyMember,
    updateFamilyMember,
    saveFamilyMember,
    editFamilyMember,
    cancelEditFamilyMember,
  } = createFamilyMemberHandlers({
    familyMemberToDelete,
    profileData,
    setFamilyMemberToDelete,
    setFamilyMembersInEditMode,
    setHasChanges,
    setProfileData,
  });

  const {
    addBankAccount,
    confirmDeleteBankAccount,
    removeBankAccount,
    updateBankAccount,
    saveBankAccount,
    editBankAccount,
    cancelEditBankAccount,
    handleProofOfBankUpload,
    confirmDeleteProofOfBank,
    removeProofOfBank,
  } = createBankAccountHandlers({
    bankAccountToDelete,
    profileData,
    proofOfBankToDelete,
    setBankAccountToDelete,
    setBankAccountsInEditMode,
    setHasChanges,
    setProfileData,
    setProofOfBankToDelete,
  });

  const { updateRiskQuestion, resetRiskAssessment } = createRiskAssessmentHandlers({
    setAssessmentStarted,
    setHasChanges,
    setProfileData,
  });

  const {
    addAsset,
    confirmDeleteAsset,
    removeAsset,
    updateAsset,
    saveAsset,
    editAsset,
    cancelEditAsset,
  } = createAssetHandlers({
    assetToDelete,
    profileData,
    setAssetDisplayValues,
    setAssetToDelete,
    setAssetsInEditMode,
    setHasChanges,
    setProfileData,
  });

  const {
    addLiability,
    confirmDeleteLiability,
    removeLiability,
    updateLiability,
    saveLiability,
    editLiability,
    cancelEditLiability,
  } = createLiabilityHandlers({
    liabilityToDelete,
    profileData,
    setHasChanges,
    setLiabilitiesInEditMode,
    setLiabilityDisplayValues,
    setLiabilityToDelete,
    setProfileData,
  });

  return {
    state: {
      profileData,
      loading,
      error,
      saving,
      hasChanges,
      assetsInEditMode,
      liabilitiesInEditMode,
      familyMembersInEditMode,
      bankAccountsInEditMode,
      employersInEditMode,
      chronicConditionsInEditMode,
      identityDocsInEditMode,
      selfEmployedInEditMode,
      proofOfResidenceInEditMode,
      assetToDelete,
      liabilityToDelete,
      bankAccountToDelete,
      familyMemberToDelete,
      chronicConditionToDelete,
      employerToDelete,
      identityDocToDelete,
      proofOfResidenceToDelete,
      proofOfBankToDelete,
      assessmentStarted,
      grossIncomeDisplay,
      netIncomeDisplay,
      assetDisplayValues,
      liabilityDisplayValues,
      incomeValidationError,
    },
    actions: {
      setProfileData,
      setHasChanges,
      handleInputChange,
      handleSave,
      handleDiscard,
      addIdentityDocument,
      handleDocumentUpload,
      updateIdentityDocument,
      confirmDeleteIdentityDocument,
      removeIdentityDocument,
      saveIdentityDocument,
      cancelEditIdentityDocument,
      editIdentityDocument,
      getDocumentTypeLabel,
      getDocumentTypeIcon,
      hasDocumentType,
      handleProofOfResidenceUpload,
      editProofOfResidence,
      saveProofOfResidence,
      confirmDeleteProofOfResidence,
      removeProofOfResidence,
      addEmployer,
      confirmDeleteEmployer,
      removeEmployer,
      updateEmployer,
      saveEmployer,
      editEmployer,
      cancelEditEmployer,
      saveSelfEmployed,
      cancelEditSelfEmployed,
      editSelfEmployed,
      addChronicCondition,
      confirmDeleteChronicCondition,
      removeChronicCondition,
      updateChronicCondition,
      saveChronicCondition,
      editChronicCondition,
      cancelEditChronicCondition,
      addFamilyMember,
      confirmDeleteFamilyMember,
      removeFamilyMember,
      updateFamilyMember,
      saveFamilyMember,
      editFamilyMember,
      cancelEditFamilyMember,
      addBankAccount,
      confirmDeleteBankAccount,
      removeBankAccount,
      updateBankAccount,
      saveBankAccount,
      editBankAccount,
      cancelEditBankAccount,
      handleProofOfBankUpload,
      confirmDeleteProofOfBank,
      removeProofOfBank,
      setBankAccountToDelete,
      setProofOfBankToDelete,
      updateRiskQuestion,
      resetRiskAssessment,
      setAssessmentStarted,
      allQuestionsAnswered,
      addAsset,
      confirmDeleteAsset,
      removeAsset,
      updateAsset,
      saveAsset,
      editAsset,
      cancelEditAsset,
      addLiability,
      confirmDeleteLiability,
      removeLiability,
      updateLiability,
      saveLiability,
      editLiability,
      cancelEditLiability,
      setAssetToDelete,
      setLiabilityToDelete,
      setAssetDisplayValues,
      setLiabilityDisplayValues,
      setGrossIncomeDisplay,
      setNetIncomeDisplay,
      setIncomeValidationError,
      setFamilyMemberToDelete,
      setEmployerToDelete,
      setChronicConditionToDelete,
      setIdentityDocToDelete,
      setProofOfResidenceToDelete,
    },
  };
}
