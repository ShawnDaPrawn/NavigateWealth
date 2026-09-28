/**
 * Medical FNA Wizard
 *
 * Runs the shared four-step FNA flow (see fna/wizard/fnaWizardFlow.ts) inside
 * the shared FNAWizardShell. This file owns only what is specific to medical
 * aid: the calculation and the calls that persist the analysis.
 */

import { useState } from 'react';
import { FNAWizardShell, resolveInitialFNAStep, useFNAPublish } from '../../fna';
import type { FNAWizardProps, FNAWizardStepNumber } from '../../fna';
import { Step1InputForm } from './Step1InputForm';
import { Step2SystemCalculation } from './Step2SystemCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';
import type { MedicalFNAInputs, MedicalFNAAdjustments, MedicalFNAWizardState } from '../types';
import { WIZARD_STEPS } from '../constants';
import { calculateMedicalNeeds } from '../utils/calculations';
import { MedicalFNAApiService } from '../api';

function buildInitialMedicalState({
  clientId,
  clientName,
  startAtStep,
  intakePrefill,
}: FNAWizardProps): MedicalFNAWizardState {
  const currentStep = resolveInitialFNAStep(startAtStep, intakePrefill);
  const inputs = (intakePrefill as unknown as MedicalFNAInputs | undefined) ?? {};

  return {
    currentStep,
    clientId,
    clientName,
    inputs,
    calculations: currentStep === 2 ? calculateMedicalNeeds(inputs as MedicalFNAInputs) : null,
    adjustments: { notes: '' },
  };
}

export function MedicalFNAWizard(props: FNAWizardProps) {
  const { clientId, clientName, open, onClose, onFNAComplete } = props;
  const [state, setState] = useState<MedicalFNAWizardState>(() => buildInitialMedicalState(props));
  const { isPublishing, publish } = useFNAPublish({ fnaType: 'medical', onFNAComplete, onClose });

  const goTo = (currentStep: FNAWizardStepNumber) => setState((prev) => ({ ...prev, currentStep }));

  const handleStep1Submit = (inputs: MedicalFNAInputs) => {
    const calculations = calculateMedicalNeeds(inputs);
    setState((prev) => ({ ...prev, inputs, calculations, currentStep: 2 }));
  };

  const handleStep3Submit = (adjustments: MedicalFNAAdjustments) => {
    setState((prev) => ({ ...prev, adjustments, currentStep: 4 }));
  };

  const handlePublish = () => {
    const { inputs, calculations, adjustments } = state;
    if (!calculations) return;

    void publish(async () => {
      const session = await MedicalFNAApiService.createMedicalFNA(clientId);
      // Step 1 validation guarantees every required input is present.
      await MedicalFNAApiService.updateMedicalFNAInputs(session.id, inputs as MedicalFNAInputs);
      await MedicalFNAApiService.updateMedicalFNAResults(session.id, calculations, adjustments);
      await MedicalFNAApiService.publishMedicalFNA(session.id);
      return session.id;
    });
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <Step1InputForm
            clientId={clientId}
            initialData={state.inputs}
            onNext={handleStep1Submit}
          />
        );
      case 2:
        if (!state.calculations) return null;
        return (
          <Step2SystemCalculation
            inputs={state.inputs}
            calculations={state.calculations}
            onNext={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        );
      case 3:
        if (!state.calculations) return null;
        return (
          <Step3ManualAdjustment
            calculations={state.calculations}
            initialAdjustments={state.adjustments}
            onNext={handleStep3Submit}
            onBack={() => goTo(2)}
          />
        );
      case 4:
        if (!state.calculations) return null;
        return (
          <Step4Finalise
            inputs={state.inputs as MedicalFNAInputs}
            calculations={state.calculations}
            adjustments={state.adjustments}
            onPublish={handlePublish}
            onBack={() => goTo(3)}
            isPublishing={isPublishing}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FNAWizardShell
      open={open}
      onClose={onClose}
      fnaType="medical"
      clientName={clientName}
      steps={WIZARD_STEPS}
      currentStep={state.currentStep}
      isPublishing={isPublishing}
    >
      {renderStep()}
    </FNAWizardShell>
  );
}
