/**
 * Will Drafting Wizard
 * Multi-step wizard for drafting Last Will & Testament and Living Will for clients.
 * Admin tool that creates draft wills that can be finalized when original signed will is collected.
 *
 * Decomposed per Guidelines S4.1 — types, constants, UI primitives, and step renderers
 * are extracted into sibling files for discoverability and maintainability.
 *
 * UI/UX improvements v2:
 *  - Numbered horizontal stepper with connecting progress track
 *  - 2-column form grid for paired fields
 *  - Accent-bordered item cards with numbered badges
 *  - Richer empty states with guidance text
 *  - Better living-will treatment preference layout
 *  - Review step with sectioned summary cards
 *  - Step counter in footer
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  User,
  Users,
  Home,
  Briefcase,
  Heart,
  CheckCircle2,
  FileText,
  AlertCircle,
  Scroll,
  Shield,
  Activity,
  HandHeart,
  Stethoscope,
  Check,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

// ── Extracted modules ──────────────────────────────────────────────
import type {
  PersonalDetails,
  Beneficiary,
  Guardian,
  Executor,
  SpecificBequest,
  HealthcareAgent,
  WillData,
  LivingWillData,
  WizardStep,
  WillDraftingWizardProps,
} from './WillDraftingTypes';
import { createDefaultWillData, createDefaultLivingWillData } from './WillDraftingTypes';
// Constants are now consumed by the extracted step components in ./will-steps/
import {
  StepPersonalDetails,
  StepExecutors,
  StepBeneficiaries,
  StepGuardians,
  StepBequests,
  StepFuneralWishes,
  StepHealthcareAgents,
  StepLifeSustaining,
  StepPainManagement,
  StepOrganDonation,
  StepLivingWillWishes,
  StepReviewLastWill,
  StepReviewLivingWill,
} from './will-steps';

// Re-export types for consumers that import from the main file
export type { WillDraftingWizardProps } from './WillDraftingTypes';

// ═══════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════

export function WillDraftingWizard({
  open,
  onClose,
  clientId,
  clientName,
  onComplete,
  willType = 'last_will',
  existingWillId,
}: WillDraftingWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('personal-details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isLivingWill = willType === 'living_will';

  const [willData, setWillData] = useState<WillData>(createDefaultWillData());
  const [livingWillData, setLivingWillData] = useState<LivingWillData>(createDefaultLivingWillData());

  // ── Reset state when wizard opens for a NEW draft ────────────────
  useEffect(() => {
    if (open && !existingWillId) {
      setCurrentStep('personal-details');
      setValidationErrors([]);
      if (isLivingWill) {
        setLivingWillData(createDefaultLivingWillData());
      } else {
        setWillData(createDefaultWillData());
      }
    }
    if (open && existingWillId) {
      setCurrentStep('personal-details');
      setValidationErrors([]);
    }
  }, [open]);

  // ── Resume Draft: load existing will data ────────────────────────
  useEffect(() => {
    if (!open || !existingWillId) return;
    const loadExistingDraft = async () => {
      setIsLoadingDraft(true);
      try {
        const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
        const resp = await fetch(`${API_BASE}/estate-planning-fna/wills/${existingWillId}`, {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!resp.ok) throw new Error(`Failed to load draft: ${resp.status}`);
        const result = await resp.json();
        if (!result.success || !result.data) throw new Error(result.error || 'Draft not found');

        const existing = result.data;
        if (existing.type === 'living_will') {
          setLivingWillData(existing.data as LivingWillData);
        } else {
          setWillData(existing.data as WillData);
        }
        toast.success('Draft loaded', { description: 'You can continue editing where you left off.' });
      } catch (err) {
        console.error('Error loading existing will draft:', err);
        toast.error('Failed to load existing draft. Starting fresh.');
      } finally {
        setIsLoadingDraft(false);
      }
    };
    loadExistingDraft();
  }, [open, existingWillId]);

  // ── Fetch and pre-fill client profile on mount ──────────────────
  useEffect(() => {
    if (!open || !clientId || existingWillId) return; // Skip pre-fill if resuming a draft

    const fetchClientProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
        const response = await fetch(`${API_BASE}/estate-planning-fna/wills/client/${clientId}/profile-prefill`, {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch client profile for will pre-fill:', response.status);
          return;
        }

        const result = await response.json();
        const profile = result.profile;
        // Universal Key Manager: client_keys KV entry (flat map of keyId -> value)
        const ckRaw = result.clientKeys as Record<string, unknown> | null;

        if (!profile && !ckRaw) {
          console.error('Profile pre-fill: both profile and clientKeys are null/undefined', result);
          return;
        }

        // The KV profile may store personal data under a nested `personalInformation`
        // key, or directly at the top level. Check both paths (nested first, then flat).
        const pi = profile?.personalInformation || profile || {};
        console.log('Profile pre-fill: raw profile keys', profile ? Object.keys(profile) : '(null)');
        console.log('Profile pre-fill: pi keys', Object.keys(pi));
        console.log('Profile pre-fill: clientKeys IDs', ckRaw ? Object.keys(ckRaw) : '(null)');

        // Universal Key Manager key -> profile field name mapping
        // These IDs come from keyManagerConstants.ts PROFILE_PERSONAL_KEYS
        const KEY_MANAGER_MAP: Record<string, string> = {
          profile_title: 'title',
          profile_first_name: 'firstName',
          profile_middle_name: 'middleName',
          profile_last_name: 'lastName',
          profile_date_of_birth: 'dateOfBirth',
          profile_id_number: 'idNumber',
          profile_marital_status: 'maritalStatus',
          profile_marital_regime: 'maritalRegime',
          profile_gender: 'gender',
          profile_nationality: 'nationality',
        };

        // Build a flat lookup from client_keys using the mapping
        const ck: Record<string, string | undefined> = {};
        if (ckRaw) {
          for (const [keyId, value] of Object.entries(ckRaw)) {
            const fieldName = KEY_MANAGER_MAP[keyId];
            if (fieldName && value != null && value !== '') {
              ck[fieldName] = String(value);
            }
          }
        }
        console.log('Profile pre-fill: mapped client keys ->', ck);

        // Helper: resolve a field from nested profile -> flat profile -> client keys -> undefined
        // Priority: personal_info data first (most detailed), then Universal Key Manager fallback
        const field = (name: string): string | undefined =>
          pi?.[name] ?? profile?.[name] ?? ck?.[name] ?? undefined;

        console.log('Profile pre-fill: resolved fields ->', {
          idNumber: field('idNumber'),
          dateOfBirth: field('dateOfBirth'),
          maritalStatus: field('maritalStatus') || field('maritalRegime'),
          firstName: field('firstName'),
          lastName: field('lastName'),
          title: field('title'),
        });

        // ── Map marital status ──────────────────────────────
        const mapMaritalStatus = (status?: string): PersonalDetails['maritalStatus'] => {
          if (!status) return 'single';
          const lower = status.toLowerCase();
          if (lower.includes('community')) return 'married_cop';
          if (lower.includes('anc') || lower.includes('accrual') || lower.includes('out of community')) return 'married_anc';
          if (lower.includes('customary')) return 'married_customary';
          if (lower.includes('divorced')) return 'divorced';
          if (lower.includes('widowed')) return 'widowed';
          if (lower.includes('married') || lower.includes('civil union')) return 'married_cop';
          return 'single';
        };

        // ── Build residential address string ────────────────
        const addressParts = [
          field('residentialAddressLine1'),
          field('residentialAddressLine2'),
          field('residentialSuburb'),
          field('residentialCity'),
          field('residentialProvince'),
          field('residentialPostalCode'),
          field('residentialCountry'),
        ].filter(Boolean);
        const addressStr = addressParts.join(', ');

        // ── Pre-fill personal details ──────────────────────
        const fullName = [field('title'), field('firstName'), field('middleName'), field('lastName')]
          .filter(Boolean)
          .join(' ');

        const preFillPersonalDetails: PersonalDetails = {
          fullName: fullName || clientName || '',
          idNumber: field('idNumber') || field('idPassportNumber') || '',
          dateOfBirth: field('dateOfBirth') || '',
          maritalStatus: mapMaritalStatus(field('maritalStatus') || field('maritalRegime')),
          spouseName: field('spouseName') || '',
          spouseIdNumber: field('spouseIdNumber') || '',
          physicalAddress: addressStr || '',
        };

        console.log('Profile pre-fill: final preFillPersonalDetails', preFillPersonalDetails);

        if (isLivingWill) {
          setLivingWillData((prev) => ({
            ...prev,
            personalDetails: preFillPersonalDetails,
          }));
        } else {
          setWillData((prev) => ({
            ...prev,
            personalDetails: preFillPersonalDetails,
          }));

          // ── Pre-fill family members as potential beneficiaries (last will only) ──
          const familyMembers = pi.familyMembers || profile.familyMembers || [];
          if (familyMembers.length > 0) {
            const preFillBeneficiaries: Beneficiary[] = familyMembers.map((fm: { fullName?: string; idPassportNumber?: string; relationship?: string }) => ({
              id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 6),
              name: fm.fullName || '',
              idNumber: fm.idPassportNumber || '',
              relationship: fm.relationship || '',
              percentage: 0,
            }));
            setWillData((prev) => ({
              ...prev,
              beneficiaries: preFillBeneficiaries,
            }));
          }
        }

        toast.success('Client profile loaded', {
          description: 'Personal details have been pre-filled from the client record.',
        });
      } catch (err) {
        console.error('Error fetching client profile for will pre-fill:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchClientProfile();
  }, [open, clientId]);

  // ── Steps configuration ──────────────────────────────────────────
  const steps: { id: WizardStep; label: string; icon: React.ElementType; description: string }[] = isLivingWill
    ? [
        { id: 'personal-details', label: 'Personal Details', icon: User, description: 'Testator identification and address' },
        { id: 'healthcare-agents', label: 'Healthcare Agents', icon: Shield, description: 'Appoint healthcare decision-makers' },
        { id: 'life-sustaining', label: 'Treatment', icon: Activity, description: 'Life-sustaining treatment preferences' },
        { id: 'pain-management', label: 'Pain Management', icon: Stethoscope, description: 'Comfort care and pain relief' },
        { id: 'organ-donation', label: 'Organ Donation', icon: HandHeart, description: 'Organ and tissue donation wishes' },
        { id: 'living-will-wishes', label: 'Final Wishes', icon: Heart, description: 'Funeral and end-of-life directives' },
        { id: 'review', label: 'Review', icon: CheckCircle2, description: 'Review and save the draft' },
      ]
    : [
        { id: 'personal-details', label: 'Personal Details', icon: User, description: 'Testator identification and address' },
        { id: 'executors', label: 'Executors', icon: Briefcase, description: 'Appoint estate administrators' },
        { id: 'beneficiaries', label: 'Beneficiaries', icon: Users, description: 'Designate heirs and their shares' },
        { id: 'guardians', label: 'Guardians', icon: Shield, description: 'Guardians for minor children' },
        { id: 'bequests', label: 'Bequests', icon: Home, description: 'Specific items to specific people' },
        { id: 'funeral-wishes', label: 'Final Wishes', icon: FileText, description: 'Funeral wishes and additional clauses' },
        { id: 'review', label: 'Review', icon: CheckCircle2, description: 'Review and save the draft' },
      ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // ── Step Validation ──────────────────────────────────────────────
  const validateCurrentStep = (): string[] => {
    const errors: string[] = [];
    const pd = isLivingWill ? livingWillData.personalDetails : willData.personalDetails;

    switch (currentStep) {
      case 'personal-details':
        if (!pd.fullName.trim()) errors.push('Full name is required');
        if (!pd.idNumber.trim()) errors.push('ID number is required');
        if (!pd.dateOfBirth) errors.push('Date of birth is required');
        if (!pd.physicalAddress.trim()) errors.push('Physical address is required');
        break;

      case 'healthcare-agents':
        if (livingWillData.healthcareAgents.length === 0) {
          errors.push('At least one healthcare agent is required');
        } else {
          const hasPrimary = livingWillData.healthcareAgents.some((a) => a.isPrimary);
          if (!hasPrimary) errors.push('At least one agent must be designated as primary');
          livingWillData.healthcareAgents.forEach((agent, idx) => {
            if (!agent.name.trim()) errors.push(`Agent ${idx + 1}: Name is required`);
          });
        }
        break;

      case 'life-sustaining': {
        const t = livingWillData.lifeSustainingTreatment;
        const treatments = ['ventilator', 'cpr', 'artificialNutrition', 'dialysis', 'antibiotics'] as const;
        treatments.forEach((key) => {
          if (!t[key]) errors.push(`Treatment preference for ${key} is required`);
        });
        break;
      }

      case 'executors':
        if (willData.executors.length === 0) {
          errors.push('At least one executor is recommended');
        } else {
          willData.executors.forEach((exec, idx) => {
            if (!exec.name.trim()) errors.push(`Executor ${idx + 1}: Name is required`);
          });
        }
        break;

      case 'beneficiaries':
        if (willData.beneficiaries.length === 0) {
          errors.push('At least one beneficiary is recommended');
        } else {
          const total = willData.beneficiaries.reduce((s, b) => s + b.percentage, 0);
          if (total > 0 && total !== 100) {
            errors.push(`Beneficiary percentages total ${total}% — should equal 100%`);
          }
          willData.beneficiaries.forEach((b, idx) => {
            if (!b.name.trim()) errors.push(`Beneficiary ${idx + 1}: Name is required`);
          });
        }
        break;

      // pain-management, organ-donation, living-will-wishes, guardians, bequests, funeral-wishes:
      // These steps have no hard validation requirements
      default:
        break;
    }

    return errors;
  };

  const handleNext = () => {
    const errors = validateCurrentStep();
    if (errors.length > 0) {
      setValidationErrors(errors);
      // Show only if there are blocking errors (not warnings)
      const isBlocking = currentStep === 'personal-details' ||
        currentStep === 'healthcare-agents' ||
        currentStep === 'life-sustaining';
      if (isBlocking) {
        toast.error('Please fix the required fields before proceeding', {
          description: errors[0],
        });
        return;
      }
      // For non-blocking steps, warn but allow proceeding
      toast.info('Some fields are incomplete', { description: errors[0] });
    }
    setValidationErrors([]);
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    setValidationErrors([]);
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  // ── Submit-time validation (checks all critical fields) ──────────
  const validateForSubmit = (): string[] => {
    const errors: string[] = [];
    const pd = isLivingWill ? livingWillData.personalDetails : willData.personalDetails;

    // Personal details are always required
    if (!pd.fullName.trim()) errors.push('Full name is required');
    if (!pd.idNumber.trim()) errors.push('ID number is required');

    if (isLivingWill) {
      if (livingWillData.healthcareAgents.length === 0) {
        errors.push('At least one healthcare agent is required');
      } else {
        const hasPrimary = livingWillData.healthcareAgents.some((a) => a.isPrimary);
        if (!hasPrimary) errors.push('A primary healthcare agent must be designated');
        const unnamed = livingWillData.healthcareAgents.filter((a) => !a.name.trim());
        if (unnamed.length > 0) errors.push(`${unnamed.length} healthcare agent(s) have no name`);
      }
    }

    return errors;
  };

  const handleSubmit = async () => {
    // Run submit-level validation
    const submitErrors = validateForSubmit();
    if (submitErrors.length > 0) {
      setValidationErrors(submitErrors);
      toast.error('Cannot save — please fix required fields', {
        description: submitErrors[0],
      });
      return;
    }

    setIsSubmitting(true);
    const isUpdate = !!existingWillId;
    const toastId = toast.loading(isUpdate ? 'Updating will draft...' : 'Saving will draft...');

    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
      const dataPayload = isLivingWill ? livingWillData : willData;

      const url = isUpdate
        ? `${API_BASE}/estate-planning-fna/wills/${existingWillId}`
        : `${API_BASE}/estate-planning-fna/wills/create`;

      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          isUpdate
            ? { data: dataPayload }
            : { clientId, type: willType, data: dataPayload }
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to ${isUpdate ? 'update' : 'save'} will draft: ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || `Failed to ${isUpdate ? 'update' : 'save'} will draft`);
      }

      toast.success(`Will draft ${isUpdate ? 'updated' : 'saved'} successfully`, { id: toastId });
      onComplete();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to save will draft: ${errorMessage}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePersonalDetails = (field: keyof PersonalDetails, value: string) => {
    if (isLivingWill) {
      setLivingWillData((prev) => ({
        ...prev,
        personalDetails: { ...prev.personalDetails, [field]: value },
      }));
    } else {
      setWillData((prev) => ({
        ...prev,
        personalDetails: { ...prev.personalDetails, [field]: value },
      }));
    }
  };

  // ── Living Will Helpers ──────────────────────────────────────────
  const addHealthcareAgent = () => {
    setLivingWillData((prev) => ({
      ...prev,
      healthcareAgents: [
        ...prev.healthcareAgents,
        {
          id: Date.now().toString(),
          name: '',
          idNumber: '',
          relationship: '',
          contactDetails: '',
          isPrimary: prev.healthcareAgents.length === 0,
        },
      ],
    }));
  };

  const updateHealthcareAgent = (id: string, field: string, value: string | boolean) => {
    setLivingWillData((prev) => ({
      ...prev,
      healthcareAgents: prev.healthcareAgents.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    }));
  };

  const removeHealthcareAgent = (id: string) => {
    setLivingWillData((prev) => ({
      ...prev,
      healthcareAgents: prev.healthcareAgents.filter((a) => a.id !== id),
    }));
  };

  const addExecutor = () => {
    const newExecutor: Executor = {
      id: Date.now().toString(),
      type: 'individual',
      name: '',
      contactDetails: '',
    };
    setWillData((prev) => ({
      ...prev,
      executors: [...prev.executors, newExecutor],
    }));
  };

  const updateExecutor = (id: string, field: keyof Executor, value: string) => {
    setWillData((prev) => ({
      ...prev,
      executors: prev.executors.map((exec) =>
        exec.id === id ? { ...exec, [field]: value } : exec
      ),
    }));
  };

  const removeExecutor = (id: string) => {
    setWillData((prev) => ({
      ...prev,
      executors: prev.executors.filter((exec) => exec.id !== id),
    }));
  };

  const addBeneficiary = () => {
    const newBeneficiary: Beneficiary = {
      id: Date.now().toString(),
      name: '',
      idNumber: '',
      relationship: '',
      percentage: 0,
    };
    setWillData((prev) => ({
      ...prev,
      beneficiaries: [...prev.beneficiaries, newBeneficiary],
    }));
  };

  const updateBeneficiary = (id: string, field: keyof Beneficiary, value: string | number) => {
    setWillData((prev) => ({
      ...prev,
      beneficiaries: prev.beneficiaries.map((ben) =>
        ben.id === id ? { ...ben, [field]: value } : ben
      ),
    }));
  };

  const removeBeneficiary = (id: string) => {
    setWillData((prev) => ({
      ...prev,
      beneficiaries: prev.beneficiaries.filter((ben) => ben.id !== id),
    }));
  };

  const addGuardian = () => {
    const newGuardian: Guardian = {
      id: Date.now().toString(),
      name: '',
      idNumber: '',
      relationship: '',
      address: '',
    };
    setWillData((prev) => ({
      ...prev,
      guardians: [...prev.guardians, newGuardian],
    }));
  };

  const updateGuardian = (id: string, field: keyof Guardian, value: string) => {
    setWillData((prev) => ({
      ...prev,
      guardians: prev.guardians.map((guard) =>
        guard.id === id ? { ...guard, [field]: value } : guard
      ),
    }));
  };

  const removeGuardian = (id: string) => {
    setWillData((prev) => ({
      ...prev,
      guardians: prev.guardians.filter((guard) => guard.id !== id),
    }));
  };

  const addBequest = () => {
    const newBequest: SpecificBequest = {
      id: Date.now().toString(),
      itemDescription: '',
      beneficiaryName: '',
      beneficiaryIdNumber: '',
    };
    setWillData((prev) => ({
      ...prev,
      specificBequests: [...prev.specificBequests, newBequest],
    }));
  };

  const updateBequest = (id: string, field: keyof SpecificBequest, value: string) => {
    setWillData((prev) => ({
      ...prev,
      specificBequests: prev.specificBequests.map((beq) =>
        beq.id === id ? { ...beq, [field]: value } : beq
      ),
    }));
  };

  const removeBequest = (id: string) => {
    setWillData((prev) => ({
      ...prev,
      specificBequests: prev.specificBequests.filter((beq) => beq.id !== id),
    }));
  };

  // ── Derived helpers ──────────────────────────────────────────────
  const beneficiaryTotal = useMemo(
    () => willData.beneficiaries.reduce((s, b) => s + b.percentage, 0),
    [willData.beneficiaries]
  );

  // ═══════════════════════════════════════════════════════
  // Step Content Renderer — thin dispatcher to extracted step components
  // (Step components live in ./will-steps/ for maintainability per Guidelines §4.1)
  // ═══════════════════════════════════════════════════════

  const renderStepContent = () => {
    const pd = isLivingWill ? livingWillData.personalDetails : willData.personalDetails;

    switch (currentStep) {
      case 'personal-details':
        return <StepPersonalDetails personalDetails={pd} onUpdate={updatePersonalDetails} />;

      case 'executors':
        return (
          <StepExecutors
            executors={willData.executors}
            onAdd={addExecutor}
            onUpdate={updateExecutor}
            onRemove={removeExecutor}
          />
        );

      case 'beneficiaries':
        return (
          <StepBeneficiaries
            beneficiaries={willData.beneficiaries}
            beneficiaryTotal={beneficiaryTotal}
            onAdd={addBeneficiary}
            onUpdate={updateBeneficiary}
            onRemove={removeBeneficiary}
          />
        );

      case 'guardians':
        return (
          <StepGuardians
            guardians={willData.guardians}
            onAdd={addGuardian}
            onUpdate={updateGuardian}
            onRemove={removeGuardian}
          />
        );

      case 'bequests':
        return (
          <StepBequests
            bequests={willData.specificBequests}
            onAdd={addBequest}
            onUpdate={updateBequest}
            onRemove={removeBequest}
          />
        );

      case 'funeral-wishes':
        return (
          <StepFuneralWishes
            funeralWishes={willData.funeralWishes}
            additionalClauses={willData.additionalClauses}
            onUpdate={(field, value) => setWillData((prev) => ({ ...prev, [field]: value }))}
          />
        );

      case 'healthcare-agents':
        return (
          <StepHealthcareAgents
            agents={livingWillData.healthcareAgents}
            onAdd={addHealthcareAgent}
            onUpdate={updateHealthcareAgent}
            onRemove={removeHealthcareAgent}
          />
        );

      case 'life-sustaining':
        return (
          <StepLifeSustaining
            treatment={livingWillData.lifeSustainingTreatment}
            onTreatmentChange={(treatment, option) =>
              setLivingWillData((prev) => ({
                ...prev,
                lifeSustainingTreatment: { ...prev.lifeSustainingTreatment, [treatment]: option },
              }))
            }
            onInstructionsChange={(instructions) =>
              setLivingWillData((prev) => ({
                ...prev,
                lifeSustainingTreatment: { ...prev.lifeSustainingTreatment, additionalInstructions: instructions },
              }))
            }
          />
        );

      case 'pain-management':
        return (
          <StepPainManagement
            painManagement={livingWillData.painManagement}
            onToggle={(field, value) =>
              setLivingWillData((prev) => ({
                ...prev,
                painManagement: { ...prev.painManagement, [field]: value },
              }))
            }
            onInstructionsChange={(instructions) =>
              setLivingWillData((prev) => ({
                ...prev,
                painManagement: { ...prev.painManagement, additionalInstructions: instructions },
              }))
            }
          />
        );

      case 'organ-donation':
        return (
          <StepOrganDonation
            organDonation={livingWillData.organDonation}
            onDonorChange={(isDonor) =>
              setLivingWillData((prev) => ({
                ...prev,
                organDonation: { ...prev.organDonation, isDonor, donationType: isDonor ? 'all' : 'none' },
              }))
            }
            onTypeChange={(type) =>
              setLivingWillData((prev) => ({
                ...prev,
                organDonation: { ...prev.organDonation, donationType: type },
              }))
            }
            onSpecificOrgansChange={(organs) =>
              setLivingWillData((prev) => ({
                ...prev,
                organDonation: { ...prev.organDonation, specificOrgans: organs },
              }))
            }
            onInstructionsChange={(instructions) =>
              setLivingWillData((prev) => ({
                ...prev,
                organDonation: { ...prev.organDonation, additionalInstructions: instructions },
              }))
            }
          />
        );

      case 'living-will-wishes':
        return (
          <StepLivingWillWishes
            funeralWishes={livingWillData.funeralWishes}
            additionalDirectives={livingWillData.additionalDirectives}
            onUpdate={(field, value) => setLivingWillData((prev) => ({ ...prev, [field]: value }))}
          />
        );

      case 'review':
        return isLivingWill ? (
          <StepReviewLivingWill personalDetails={pd} livingWillData={livingWillData} />
        ) : (
          <StepReviewLastWill
            personalDetails={pd}
            executors={willData.executors}
            beneficiaries={willData.beneficiaries}
            beneficiaryTotal={beneficiaryTotal}
            guardians={willData.guardians}
            specificBequests={willData.specificBequests}
            funeralWishes={willData.funeralWishes}
            additionalClauses={willData.additionalClauses}
          />
        );

      default:
        return null;
    }
  };

  // ════════════════════════════════════════��══════════════
  // Main Render
  // ═══════════════════════════════════════════════════════

  const HeaderIcon = isLivingWill ? Heart : Scroll;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        hideCloseButton
        className="!max-w-5xl w-[95vw] max-h-[90vh] !p-0 !gap-0 overflow-hidden"
        style={{ display: 'flex', flexDirection: 'column' }}
      >

        {/* ── Header ───────────────────────────────────────── */}
        <div className="shrink-0 border-b border-gray-100">
          {/* Accent bar */}
          <div className={`h-1 w-full ${isLivingWill ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-[#6d28d9] to-[#7c3aed]'}`} />
          <DialogHeader className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                isLivingWill ? 'bg-blue-50' : 'bg-purple-50'
              }`}>
                <HeaderIcon className={`h-5 w-5 ${isLivingWill ? 'text-blue-600' : 'text-[#6d28d9]'}`} />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  {existingWillId ? 'Resume' : 'Draft'} {isLivingWill ? 'Living Will' : 'Last Will & Testament'}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {clientName}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Progress Stepper ────────────────────────────── */}
        <div className="shrink-0 px-6 py-4 bg-gray-50/60 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;
              const isLast = index === steps.length - 1;
              const StepIcon = step.icon;

              return (
                <div className="contents" key={step.id}>
                  <div className="flex flex-col items-center relative" style={{ minWidth: 0 }}>
                    {/* Step circle */}
                    <div
                      className={`relative h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? `ring-4 ${isLivingWill ? 'bg-blue-600 ring-blue-100' : 'bg-[#6d28d9] ring-purple-100'} text-white`
                          : isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-white border-2 border-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    {/* Step label */}
                    <span className={`text-[10px] mt-1.5 text-center leading-tight font-medium whitespace-nowrap ${
                      isActive
                        ? isLivingWill ? 'text-blue-700' : 'text-[#6d28d9]'
                        : isCompleted
                        ? 'text-green-700'
                        : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div className="flex-1 mx-1 h-0.5 rounded-full relative mt-[-14px]">
                      <div className="absolute inset-0 bg-gray-200 rounded-full" />
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                          isCompleted ? 'bg-green-500 w-full' : 'bg-transparent w-0'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Validation Errors ────────────────────────────── */}
        {validationErrors.length > 0 && (
          <div className="shrink-0 mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                {validationErrors.map((err, idx) => (
                  <p key={idx} className="text-sm text-red-700">{err}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step Content ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {(isLoadingProfile || isLoadingDraft) ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className={`h-10 w-10 animate-spin mb-4 ${isLivingWill ? 'text-blue-600' : 'text-[#6d28d9]'}`} />
              <p className="text-sm font-medium text-gray-700">
                {isLoadingDraft ? 'Loading existing draft...' : 'Loading client profile...'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
            </div>
          ) : (
            renderStepContent()
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-gray-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="text-sm">
                Cancel
              </Button>
              {currentStepIndex > 0 && (
                <Button variant="outline" onClick={handleBack} className="text-sm gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Step counter */}
              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                Step {currentStepIndex + 1} of {steps.length}
              </span>

              {currentStepIndex < steps.length - 1 ? (
                <Button onClick={handleNext} className={`text-sm gap-2 ${isLivingWill ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`text-sm gap-2 ${isLivingWill ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                >
                  {isSubmitting ? (
                    <div className="contents">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    <div className="contents">
                      <CheckCircle2 className="h-4 w-4" />
                      {existingWillId ? 'Update Draft' : 'Save Draft'}
                    </div>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}