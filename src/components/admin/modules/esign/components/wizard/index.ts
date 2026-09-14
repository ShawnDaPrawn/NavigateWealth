/**
 * Shared chrome for the send-for-signature flow. Both entry points — the
 * standalone module and the client drawer's E-Sign tab — build their steps
 * from these pieces so the flow is one flow wherever it starts.
 */
export { EsignWizardShell, type EsignWizardAction } from './EsignWizardShell';
export { EsignWizardStepper } from './EsignWizardStepper';
export { EsignWizardSection } from './EsignWizardSection';
export {
  ESIGN_WIZARD_STEPS,
  ESIGN_WIZARD_STEP_COUNT,
  esignWizardProgressPercent,
  esignWizardStepNumber,
  esignWizardStepState,
  type EsignWizardStep,
  type EsignWizardStepId,
  type EsignWizardStepState,
} from './esignWizardSteps';
