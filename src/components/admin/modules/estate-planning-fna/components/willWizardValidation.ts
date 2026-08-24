/**
 * Validation for the admin will-drafting wizard: per-step gate checks and
 * the pre-submit sweep. Pure functions — split out of WillDraftingWizard.tsx.
 */
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
import type { WillData, LivingWillData, WizardStep } from './WillDraftingTypes';
// Constants are now consumed by the extracted step components in ./will-steps/

// Re-export types for consumers that import from the main file

export function validateWizardStep(
  currentStep: WizardStep,
  isLivingWill: boolean,
  willData: WillData,
  livingWillData: LivingWillData,
): string[] {
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
      const treatments = [
        'ventilator',
        'cpr',
        'artificialNutrition',
        'dialysis',
        'antibiotics',
      ] as const;
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
}

export function validateWillForSubmit(
  isLivingWill: boolean,
  willData: WillData,
  livingWillData: LivingWillData,
): string[] {
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
}
