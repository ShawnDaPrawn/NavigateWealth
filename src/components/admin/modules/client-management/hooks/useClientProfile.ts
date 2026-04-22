import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { clientApi, getClientProfileQueryOptions } from '../api';
import { 
  Client, 
  ProfileData, 
  Asset, 
  Liability, 
  FamilyMember, 
  BankAccount, 
  Employer, 
  ChronicCondition, 
  IdentityDocument 
} from '../types';
import { IdCard, FileText, CreditCard } from 'lucide-react';

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
      return Object.keys(value).sort().reduce((sorted: Record<string, unknown>, key) => {
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
  // This is set AFTER profileData is updated from the server, so the comparison
  // is against the normalised/merged state, not the raw server response.
  const [loadedProfileSnapshot, setLoadedProfileSnapshot] = useState<string | null>(null);
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
    grossMonthlyIncome: initialPersonalInfo?.grossMonthlyIncome || initialPersonalInfo?.grossIncome || 0,
    netMonthlyIncome: initialPersonalInfo?.netMonthlyIncome || initialPersonalInfo?.netIncome || 0,
    grossAnnualIncome: initialPersonalInfo?.grossAnnualIncome || (initialPersonalInfo?.grossMonthlyIncome || initialPersonalInfo?.grossIncome || 0) * 12,
    netAnnualIncome: initialPersonalInfo?.netAnnualIncome || (initialPersonalInfo?.netMonthlyIncome || initialPersonalInfo?.netIncome || 0) * 12,
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
      question1: 0, question2: 0, question3: 0, question4: 0, question5: 0,
      question6: 0, question7: 0, question8: 0, question9: 0, question10: 0,
      totalScore: 0, riskCategory: '', dateCompleted: '', canRetake: true
    },
    assets: initialPersonalInfo?.assets || [],
    liabilities: initialPersonalInfo?.liabilities || []
  });

  // Edit mode tracking states
  const [assetsInEditMode, setAssetsInEditMode] = useState<Set<string>>(new Set());
  const [liabilitiesInEditMode, setLiabilitiesInEditMode] = useState<Set<string>>(new Set());
  const [familyMembersInEditMode, setFamilyMembersInEditMode] = useState<Set<string>>(new Set());
  const [bankAccountsInEditMode, setBankAccountsInEditMode] = useState<Set<string>>(new Set());
  const [employersInEditMode, setEmployersInEditMode] = useState<Set<string>>(new Set());
  const [chronicConditionsInEditMode, setChronicConditionsInEditMode] = useState<Set<string>>(new Set());
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
  const [assetDisplayValues, setAssetDisplayValues] = useState<{[id: string]: string}>({});
  const [liabilityDisplayValues, setLiabilityDisplayValues] = useState<{[id: string]: {amount?: string, monthlyPayment?: string}}>({});

  // Validation state for income fields
  const [incomeValidationError, setIncomeValidationError] = useState('');

  // Check if all 10 questions have been answered
  const allQuestionsAnswered = () => {
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
  };

  // Check if assessment has been completed (all questions answered)
  useEffect(() => {
    if (allQuestionsAnswered()) {
      setAssessmentStarted(true);
    }
  }, [profileData.riskAssessment]);

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
          const grossAnnual = profile.grossAnnualIncome ?? ((profile.grossMonthlyIncome || profile.grossIncome || 0) * 12);
          const netAnnual = profile.netAnnualIncome ?? ((profile.netMonthlyIncome || profile.netIncome || 0) * 12);
          
          setProfileData(prev => ({
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
        setProfileData(prev => ({
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
  }, [clientData.id, queryClient]);

  // Capture snapshot of merged profileData after server data has been applied.
  // Runs once after load, and again after save. The snapshot represents the
  // "last known clean" state for dirty detection.
  useEffect(() => {
    if (snapshotPending) {
      setLoadedProfileSnapshot(createProfileSnapshot(profileData));
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

  const handleInputChange = (field: keyof ProfileData, value: string | number | boolean | unknown[]) => {
    let updates: Partial<ProfileData> = { [field]: value };
    
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
    
    setProfileData(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const userId = clientData.id;
      if (!userId) {
        toast.error('Client user ID not found');
        return;
      }

      await clientApi.updateClientProfile(userId, profileData);
      queryClient.setQueryData(getClientProfileQueryOptions(userId).queryKey, profileData);

      toast.success('Profile updated successfully');
      // Update the snapshot to the current state so hasChanges resets correctly.
      // This makes the just-saved state the new "clean" baseline.
      setLoadedProfileSnapshot(createProfileSnapshot(profileData));
      setHasChanges(false);
      if (onSave) onSave(profileData);
    } catch (error) {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Identity Document Management Functions
  const hasDocumentType = (type: 'national-id' | 'passport' | 'drivers-license') => {
    return profileData.identityDocuments.some(doc => doc.type === type);
  };

  const addIdentityDocument = (type: 'national-id' | 'passport' | 'drivers-license') => {
    if (hasDocumentType(type)) {
      const typeNames = {
        'national-id': 'National ID',
        'passport': 'Passport',
        'drivers-license': 'Driver\'s License'
      };
      toast.error(`Client already has a ${typeNames[type]}. Only one document of each type is allowed.`);
      return;
    }

    const newDoc: IdentityDocument = {
      id: Date.now().toString(),
      type,
      number: '',
      countryOfIssue: 'South Africa',
      expiryDate: '',
      isVerified: false
    };
    setProfileData(prev => ({
      ...prev,
      identityDocuments: [...prev.identityDocuments, newDoc]
    }));
    setIdentityDocsInEditMode(prev => new Set([...prev, newDoc.id]));
    setHasChanges(true);
  };

  const handleDocumentUpload = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF, JPG, or PNG file');
      return;
    }

    const fileUrl = URL.createObjectURL(file);

    setProfileData(prev => ({
      ...prev,
      identityDocuments: prev.identityDocuments.map(doc =>
        doc.id === id
          ? {
              ...doc,
              fileName: file.name,
              fileUrl: fileUrl,
              fileSize: file.size,
              uploadDate: new Date().toISOString(),
              isVerified: false
            }
          : doc
      )
    }));
    setHasChanges(true);
    toast.success(`Document "${file.name}" uploaded successfully`);
  };

  const updateIdentityDocument = (id: string, updates: Partial<IdentityDocument>) => {
    setProfileData(prev => ({
      ...prev,
      identityDocuments: prev.identityDocuments.map(doc =>
        doc.id === id ? { ...doc, ...updates } : doc
      )
    }));
    setHasChanges(true);
  };

  const confirmDeleteIdentityDocument = (id: string) => {
    setIdentityDocToDelete(id);
  };

  const removeIdentityDocument = (id: string) => {
    setProfileData(prev => ({
      ...prev,
      identityDocuments: prev.identityDocuments.filter(doc => doc.id !== id)
    }));
    setIdentityDocsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setIdentityDocToDelete(null);
    setHasChanges(true);
  };

  const saveIdentityDocument = (id: string) => {
    const doc = profileData.identityDocuments.find(d => d.id === id);
    
    if (doc?.type === 'national-id') {
      if (!doc.number || !doc.fileName) {
        toast.error('Please fill in the ID number and upload the document before saving');
        return;
      }
    }
    
    setIdentityDocsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const cancelEditIdentityDocument = (id: string) => {
    const doc = profileData.identityDocuments.find(d => d.id === id);
    
    if (doc && !doc.number && !doc.fileName) {
      removeIdentityDocument(id);
      return;
    }
    
    setIdentityDocsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editIdentityDocument = (id: string) => {
    setIdentityDocsInEditMode(prev => new Set([...prev, id]));
  };

  const getDocumentTypeLabel = (type: 'national-id' | 'passport' | 'drivers-license') => {
    switch (type) {
      case 'national-id':
        return 'National ID Card';
      case 'passport':
        return 'Passport';
      case 'drivers-license':
        return 'Driver\'s License';
      default:
        return type;
    }
  };

  const getDocumentTypeIcon = (type: 'national-id' | 'passport' | 'drivers-license') => {
    switch (type) {
      case 'national-id':
        return { icon: IdCard, color: 'purple' };
      case 'passport':
        return { icon: FileText, color: 'blue' };
      case 'drivers-license':
        return { icon: CreditCard, color: 'amber' };
      default:
        return { icon: FileText, color: 'gray' };
    }
  };

  // Proof of Residence handlers
  const handleProofOfResidenceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, JPG, or PNG file');
      return;
    }

    setProfileData(prev => ({
      ...prev,
      proofOfResidenceUploaded: true,
      proofOfResidenceFileName: file.name
    }));
    setProofOfResidenceInEditMode(false);
    setHasChanges(true);
  };

  const editProofOfResidence = () => {
    setProofOfResidenceInEditMode(true);
  };

  const saveProofOfResidence = () => {
    setProofOfResidenceInEditMode(false);
  };

  const confirmDeleteProofOfResidence = () => {
    setProofOfResidenceToDelete(true);
  };

  const removeProofOfResidence = () => {
    setProfileData(prev => ({
      ...prev,
      proofOfResidenceUploaded: false,
      proofOfResidenceFileName: undefined
    }));
    setProofOfResidenceToDelete(false);
    setProofOfResidenceInEditMode(false);
    setHasChanges(true);
  };

  // Employer Management Functions
  const addEmployer = () => {
    const newEmployer: Employer = {
      id: Date.now().toString(),
      jobTitle: '',
      employerName: '',
      industry: ''
    };
    setProfileData(prev => ({
      ...prev,
      employers: [...prev.employers, newEmployer]
    }));
    setEmployersInEditMode(prev => new Set([...prev, newEmployer.id]));
    setHasChanges(true);
  };

  const confirmDeleteEmployer = (id: string) => {
    setEmployerToDelete(id);
  };

  const removeEmployer = () => {
    if (!employerToDelete) return;
    setProfileData(prev => ({
      ...prev,
      employers: prev.employers.filter(employer => employer.id !== employerToDelete)
    }));
    setEmployersInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(employerToDelete);
      return newSet;
    });
    setEmployerToDelete(null);
    setHasChanges(true);
  };

  const updateEmployer = (id: string, updates: Partial<Employer>) => {
    setProfileData(prev => ({
      ...prev,
      employers: prev.employers.map(employer =>
        employer.id === id ? { ...employer, ...updates } : employer
      )
    }));
    setHasChanges(true);
  };

  const saveEmployer = (id: string) => {
    const employer = profileData.employers.find(e => e.id === id);
    
    if (!employer?.employerName || !employer?.jobTitle || !employer?.industry) {
      toast.error('Please fill in all required fields (Employer Name, Job Title, and Industry) before saving');
      return;
    }
    
    setEmployersInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editEmployer = (id: string) => {
    setEmployersInEditMode(prev => new Set([...prev, id]));
  };

  const cancelEditEmployer = (id: string) => {
    const employer = profileData.employers.find(e => e.id === id);
    
    if (employer && !employer.employerName && !employer.jobTitle && !employer.industry) {
      setProfileData(prev => ({
        ...prev,
        employers: prev.employers.filter(e => e.id !== id)
      }));
      setEmployersInEditMode(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }
    
    setEmployersInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const saveSelfEmployed = () => {
    if (!profileData.selfEmployedIndustry || !profileData.selfEmployedDescription) {
      toast.error('Please fill in all required fields (Industry and Business Description) before saving');
      return;
    }
    setSelfEmployedInEditMode(false);
  };

  const cancelEditSelfEmployed = () => {
    setSelfEmployedInEditMode(false);
  };

  const editSelfEmployed = () => {
    setSelfEmployedInEditMode(true);
  };

  // Chronic Condition Management Functions
  const addChronicCondition = () => {
    const newCondition: ChronicCondition = {
      id: Date.now().toString(),
      conditionName: '',
      monthDiagnosed: '',
      yearDiagnosed: '',
      onTreatment: false,
      treatingDoctor: ''
    };
    setProfileData(prev => ({
      ...prev,
      chronicConditions: [...prev.chronicConditions, newCondition]
    }));
    setChronicConditionsInEditMode(prev => new Set([...prev, newCondition.id]));
    setHasChanges(true);
  };

  const confirmDeleteChronicCondition = (id: string) => {
    setChronicConditionToDelete(id);
  };

  const removeChronicCondition = () => {
    if (!chronicConditionToDelete) return;
    setProfileData(prev => ({
      ...prev,
      chronicConditions: prev.chronicConditions.filter(condition => condition.id !== chronicConditionToDelete)
    }));
    setChronicConditionsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(chronicConditionToDelete);
      return newSet;
    });
    setChronicConditionToDelete(null);
    setHasChanges(true);
  };

  const updateChronicCondition = (id: string, updates: Partial<ChronicCondition>) => {
    setProfileData(prev => ({
      ...prev,
      chronicConditions: prev.chronicConditions.map(condition =>
        condition.id === id ? { ...condition, ...updates } : condition
      )
    }));
    setHasChanges(true);
  };

  const saveChronicCondition = (id: string) => {
    const condition = profileData.chronicConditions.find(c => c.id === id);
    
    if (!condition?.conditionName) {
      toast.error('Please enter the name of the condition before saving');
      return;
    }
    
    setChronicConditionsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editChronicCondition = (id: string) => {
    setChronicConditionsInEditMode(prev => new Set([...prev, id]));
  };

  const cancelEditChronicCondition = (id: string) => {
    const condition = profileData.chronicConditions.find(c => c.id === id);
    
    if (condition && !condition.conditionName) {
      setProfileData(prev => ({
        ...prev,
        chronicConditions: prev.chronicConditions.filter(c => c.id !== id)
      }));
      setChronicConditionsInEditMode(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }
    
    setChronicConditionsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  // Family Member Management Functions
  const addFamilyMember = () => {
    const newMember: FamilyMember = {
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
    };
    setProfileData(prev => ({
      ...prev,
      familyMembers: [...prev.familyMembers, newMember]
    }));
    setFamilyMembersInEditMode(prev => new Set([...prev, newMember.id]));
    setHasChanges(true);
  };

  const confirmDeleteFamilyMember = (id: string) => {
    setFamilyMemberToDelete(id);
  };

  const removeFamilyMember = () => {
    if (!familyMemberToDelete) return;
    setProfileData(prev => ({
      ...prev,
      familyMembers: prev.familyMembers.filter(member => member.id !== familyMemberToDelete)
    }));
    setFamilyMembersInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(familyMemberToDelete);
      return newSet;
    });
    setFamilyMemberToDelete(null);
    setHasChanges(true);
  };

  const updateFamilyMember = (id: string, updates: Partial<FamilyMember>) => {
    setProfileData(prev => ({
      ...prev,
      familyMembers: prev.familyMembers.map(member =>
        member.id === id ? { ...member, ...updates } : member
      )
    }));
    setHasChanges(true);
  };

  const saveFamilyMember = (id: string) => {
    const member = profileData.familyMembers.find(m => m.id === id);
    
    if (!member?.fullName || !member?.relationship) {
      toast.error('Please fill in all required fields (Full Name and Relationship) before saving');
      return;
    }
    
    setFamilyMembersInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editFamilyMember = (id: string) => {
    setFamilyMembersInEditMode(prev => new Set([...prev, id]));
  };

  const cancelEditFamilyMember = (id: string) => {
    const member = profileData.familyMembers.find(m => m.id === id);
    
    if (member && !member.fullName && !member.relationship) {
      setProfileData(prev => ({
        ...prev,
        familyMembers: prev.familyMembers.filter(m => m.id !== id)
      }));
      setFamilyMembersInEditMode(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }
    
    setFamilyMembersInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  // Bank Account Management Functions
  const addBankAccount = () => {
    const newAccount: BankAccount = {
      id: Date.now().toString(),
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      accountType: 'checking',
      branchCode: '',
      isPrimary: false
    };
    setProfileData(prev => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, newAccount]
    }));
    setBankAccountsInEditMode(prev => new Set([...prev, newAccount.id]));
    setHasChanges(true);
  };

  const confirmDeleteBankAccount = (id: string) => {
    setBankAccountToDelete(id);
  };

  const removeBankAccount = () => {
    if (!bankAccountToDelete) return;
    setProfileData(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter(account => account.id !== bankAccountToDelete)
    }));
    setBankAccountsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(bankAccountToDelete);
      return newSet;
    });
    setBankAccountToDelete(null);
    setHasChanges(true);
  };

  const updateBankAccount = (id: string, updates: Partial<BankAccount>) => {
    setProfileData(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map(account =>
        account.id === id ? { ...account, ...updates } : account
      )
    }));
    setHasChanges(true);
  };

  const saveBankAccount = (id: string) => {
    const account = profileData.bankAccounts.find(a => a.id === id);
    
    if (!account?.accountHolderName || !account?.bankName || !account?.accountNumber || !account?.accountType) {
      toast.error('Please fill in all required fields (Account Holder Name, Bank Name, Account Number, and Account Type) before saving');
      return;
    }
    
    if (account.bankName === 'Other') {
      if (!account.customBankName || !account.customBranchCode) {
        toast.error('For "Other" banks, please provide the Custom Bank Name and Custom Branch Code');
        return;
      }
    } else {
      if (!account.branchCode) {
        toast.error('Please provide the Branch Code before saving');
        return;
      }
    }
    
    setBankAccountsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editBankAccount = (id: string) => {
    setBankAccountsInEditMode(prev => new Set([...prev, id]));
  };

  const cancelEditBankAccount = (id: string) => {
    const account = profileData.bankAccounts.find(a => a.id === id);
    
    if (account && !account.accountHolderName && !account.bankName && !account.accountNumber && !account.accountType) {
      setProfileData(prev => ({
        ...prev,
        bankAccounts: prev.bankAccounts.filter(a => a.id !== id)
      }));
      setBankAccountsInEditMode(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }
    
    setBankAccountsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleProofOfBankUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      updateBankAccount(id, {
        proofOfBankDocument: reader.result as string,
        proofOfBankFileName: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const confirmDeleteProofOfBank = (id: string) => {
    setProofOfBankToDelete(id);
  };

  const removeProofOfBank = () => {
    if (!proofOfBankToDelete) return;
    updateBankAccount(proofOfBankToDelete, {
      proofOfBankDocument: undefined,
      proofOfBankFileName: undefined
    });
    setProofOfBankToDelete(null);
  };

  // Risk Assessment Management Functions
  const updateRiskQuestion = (questionNumber: number, score: number) => {
    setProfileData(prev => {
      const updatedAssessment = {
        ...prev.riskAssessment,
        [`question${questionNumber}`]: score
      };
      
      // Calculate total score
      const totalScore = (
        updatedAssessment.question1 +
        updatedAssessment.question2 +
        updatedAssessment.question3 +
        updatedAssessment.question4 +
        updatedAssessment.question5 +
        updatedAssessment.question6 +
        updatedAssessment.question7 +
        updatedAssessment.question8 +
        updatedAssessment.question9 +
        updatedAssessment.question10
      );
      
      // Check if all questions are answered
      const allAnswered = (
        updatedAssessment.question1 > 0 &&
        updatedAssessment.question2 > 0 &&
        updatedAssessment.question3 > 0 &&
        updatedAssessment.question4 > 0 &&
        updatedAssessment.question5 > 0 &&
        updatedAssessment.question6 > 0 &&
        updatedAssessment.question7 > 0 &&
        updatedAssessment.question8 > 0 &&
        updatedAssessment.question9 > 0 &&
        updatedAssessment.question10 > 0
      );

      // Determine risk category (only if all questions answered)
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
        ...prev,
        riskAssessment: {
          ...updatedAssessment,
          totalScore,
          riskCategory,
          dateCompleted: allAnswered ? new Date().toISOString() : '',
          canRetake: allAnswered
        }
      };
    });
    setHasChanges(true);
  };

  const resetRiskAssessment = () => {
    setProfileData(prev => ({
      ...prev,
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
        canRetake: true
      }
    }));
    setAssessmentStarted(false);
    setHasChanges(true);
  };

  // Asset Management Functions
  const addAsset = () => {
    const newAsset: Asset = {
      id: Date.now().toString(),
      type: '',
      name: '',
      description: '',
      value: 0,
      ownershipType: '',
      provider: ''
    };
    setProfileData(prev => ({
      ...prev,
      assets: [...prev.assets, newAsset]
    }));
    setAssetsInEditMode(prev => new Set([...prev, newAsset.id]));
    setHasChanges(true);
  };

  const confirmDeleteAsset = (id: string) => {
    setAssetToDelete(id);
  };

  const removeAsset = () => {
    if (!assetToDelete) return;
    setProfileData(prev => ({
      ...prev,
      assets: prev.assets.filter(asset => asset.id !== assetToDelete)
    }));
    setAssetsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(assetToDelete);
      return newSet;
    });
    setAssetDisplayValues(prev => {
      const newState = { ...prev };
      delete newState[assetToDelete];
      return newState;
    });
    setAssetToDelete(null);
    setHasChanges(true);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setProfileData(prev => ({
      ...prev,
      assets: prev.assets.map(asset =>
        asset.id === id ? { ...asset, ...updates } : asset
      )
    }));
    setHasChanges(true);
  };

  const saveAsset = (id: string) => {
    const asset = profileData.assets.find(a => a.id === id);
    
    if (!asset?.type || !asset?.name || !asset?.ownershipType) {
      toast.error('Please fill in all required fields (Asset Type, Asset Name, and Ownership Type) before saving');
      return;
    }
    
    if (asset.type === 'Other' && !asset.customType) {
      toast.error('For "Other" asset types, please specify the custom asset type');
      return;
    }
    
    setAssetsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setAssetDisplayValues(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const editAsset = (id: string) => {
    setAssetsInEditMode(prev => new Set([...prev, id]));
  };

  const cancelEditAsset = (id: string) => {
    const asset = profileData.assets.find(a => a.id === id);
    
    if (asset && !asset.type && !asset.name && !asset.ownershipType) {
      setProfileData(prev => ({
        ...prev,
        assets: prev.assets.filter(a => a.id !== id)
      }));
      setAssetsInEditMode(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setAssetDisplayValues(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      return;
    }
    
    setAssetsInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    setAssetDisplayValues(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  // Liability Management Functions
  const addLiability = () => {
    const newLiability: Liability = {
      id: Date.now().toString(),
      type: '',
      name: '',
      description: '',
      provider: '',
      outstandingBalance: 0,
      monthlyPayment: 0,
      interestRate: 0
    };
    setProfileData(prev => ({
      ...prev,
      liabilities: [...prev.liabilities, newLiability]
    }));
    setLiabilitiesInEditMode(prev => new Set([...prev, newLiability.id]));
    setHasChanges(true);
  };

  const confirmDeleteLiability = (id: string) => {
    setLiabilityToDelete(id);
  };

  const removeLiability = () => {
    if (!liabilityToDelete) return;
    setProfileData(prev => ({
      ...prev,
      liabilities: prev.liabilities.filter(liability => liability.id !== liabilityToDelete)
    }));
    setLiabilitiesInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(liabilityToDelete);
      return newSet;
    });
    setLiabilityDisplayValues(prev => {
      const newState = { ...prev };
      delete newState[liabilityToDelete];
      return newState;
    });
    setLiabilityToDelete(null);
    setHasChanges(true);
  };

  const updateLiability = (id: string, updates: Partial<Liability>) => {
    setProfileData(prev => ({
      ...prev,
      liabilities: prev.liabilities.map(liability =>
        liability.id === id ? { ...liability, ...updates } : liability
      )
    }));
    setHasChanges(true);
  };

  const saveLiability = (id: string) => {
    const liability = profileData.liabilities.find(l => l.id === id);
    
    if (!liability?.type || !liability?.name || !liability?.provider) {
      toast.error('Please fill in all required fields (Liability Type, Liability Name, and Provider) before saving');
      return;
    }
    
    if (liability.type === 'Other' && !liability.customType) {
      toast.error('For "Other" liability types, please specify the custom liability type');
      return;
    }
    
    setLiabilitiesInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setLiabilityDisplayValues(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const editLiability = (id: string) => {
    setLiabilitiesInEditMode(prev => new Set([...prev, id]));
  };

  const cancelEditLiability = (id: string) => {
    const liability = profileData.liabilities.find(l => l.id === id);
    
    if (liability && !liability.type && !liability.name && !liability.provider) {
      setProfileData(prev => ({
        ...prev,
        liabilities: prev.liabilities.filter(l => l.id !== id)
      }));
      setLiabilitiesInEditMode(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setLiabilityDisplayValues(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      return;
    }
    
    setLiabilitiesInEditMode(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    setLiabilityDisplayValues(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

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
      incomeValidationError
    },
    actions: {
      setProfileData,
      setHasChanges,
      handleInputChange,
      handleSave,
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
      setProofOfResidenceToDelete
    }
  };
}
