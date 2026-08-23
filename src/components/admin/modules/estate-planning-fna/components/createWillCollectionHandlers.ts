/**
 * Collection editors of the admin will-drafting wizard: personal details,
 * healthcare agents, executors, beneficiaries, guardians, and specific
 * bequests. Plain state updaters over the wizard's two data states —
 * split out of WillDraftingWizard.tsx following the handler-factory pattern.
 */
import type { Dispatch, SetStateAction } from 'react';
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

// ── Extracted modules ──────────────────────────────────────────────
import type {
  PersonalDetails,
  Beneficiary,
  Guardian,
  Executor,
  SpecificBequest,
  WillData,
  LivingWillData,
} from './WillDraftingTypes';
// Constants are now consumed by the extracted step components in ./will-steps/

// Re-export types for consumers that import from the main file

interface Deps {
  isLivingWill: boolean;
  setWillData: Dispatch<SetStateAction<WillData>>;
  setLivingWillData: Dispatch<SetStateAction<LivingWillData>>;
}

export function createWillCollectionHandlers({
  isLivingWill,
  setWillData,
  setLivingWillData,
}: Deps) {
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
        a.id === id ? { ...a, [field]: value } : a,
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
        exec.id === id ? { ...exec, [field]: value } : exec,
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
        ben.id === id ? { ...ben, [field]: value } : ben,
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
        guard.id === id ? { ...guard, [field]: value } : guard,
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
        beq.id === id ? { ...beq, [field]: value } : beq,
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

  return {
    updatePersonalDetails,
    addHealthcareAgent,
    updateHealthcareAgent,
    removeHealthcareAgent,
    addExecutor,
    updateExecutor,
    removeExecutor,
    addBeneficiary,
    updateBeneficiary,
    removeBeneficiary,
    addGuardian,
    updateGuardian,
    removeGuardian,
    addBequest,
    updateBequest,
    removeBequest,
  };
}
