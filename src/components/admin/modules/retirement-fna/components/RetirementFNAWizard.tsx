/**
 * Retirement FNA Wizard
 *
 * Runs the shared four-step FNA flow (see fna/wizard/fnaWizardFlow.ts) inside
 * the shared FNAWizardShell. This file owns only what is specific to
 * retirement: the projection and the calls that persist the analysis.
 */

import { useState } from 'react';
import { FNAWizardShell, resolveInitialFNAStep, useFNAPublish } from '../../fna';
import type { FNAWizardProps, FNAWizardStepNumber } from '../../fna';
import { Step1InputForm } from './Step1InputForm';
import { Step2SystemCalculation } from './Step2SystemCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';
import type {
  RetirementFNAInputs,
  RetirementFNAAdjustments,
  RetirementFNAWizardState,
} from '../types';
import { WIZARD_STEPS } from '../constants';
import { calculateRetirementFNA } from '../utils/calculation-engine';
import { RetirementFnaAPI } from '../api';

function buildInitialRetirementState({
  clientId,
  clientName,
  startAtStep,
  intakePrefill,
}: FNAWizardProps): RetirementFNAWizardState {
  const currentStep = resolveInitialFNAStep(startAtStep, intakePrefill);
  // The client intake stores the assumptions beside the inputs.
  const { assumptions, ...inputFields } = intakePrefill ?? {};
  const inputs = inputFields as Partial<RetirementFNAInputs>;
  const adjustments = { ...((assumptions as RetirementFNAAdjustments | undefined) ?? {}) };

  return {
    currentStep,
    clientId,
    clientName,
    inputs,
    adjustments,
    calculations:
      currentStep === 2 ? calculateRetirementFNA(inputs as RetirementFNAInputs, adjustments) : null,
  };
}

export function RetirementFNAWizard(props: FNAWizardProps) {
  const { clientId, clientName, open, onClose, onFNAComplete } = props;
  const [state, setState] = useState<RetirementFNAWizardState>(() =>
    buildInitialRetirementState(props),
  );
  const { isPublishing, publish } = useFNAPublish({
    fnaType: 'retirement',
    onFNAComplete,
    onClose,
  });

  const goTo = (currentStep: FNAWizardStepNumber) => setState((prev) => ({ ...prev, currentStep }));

  const handleStep1Submit = (
    inputs: RetirementFNAInputs,
    initialAssumptions: RetirementFNAAdjustments,
  ) => {
    const adjustments = { ...state.adjustments, ...initialAssumptions };
    const calculations = calculateRetirementFNA(inputs, adjustments);
    setState((prev) => ({ ...prev, inputs, adjustments, calculations, currentStep: 2 }));
  };

  const handleStep3Submit = (adjustments: RetirementFNAAdjustments) => {
    const calculations = calculateRetirementFNA(state.inputs as RetirementFNAInputs, adjustments);
    setState((prev) => ({ ...prev, adjustments, calculations, currentStep: 4 }));
  };

  const handlePublish = () => {
    void publish(async () => {
      const session = await RetirementFnaAPI.create(clientId);
      await RetirementFnaAPI.updateInputs(session.id, { ...state.inputs, ...state.adjustments });
      // The session is created with null results; the server calculates them
      // from the inputs just saved, so the published record is its own.
      await RetirementFnaAPI.calculate(session.id);
      await RetirementFnaAPI.publish(session.id);
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
            initialAssumptions={state.adjustments}
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
            inputs={state.inputs}
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
            inputs={state.inputs as RetirementFNAInputs}
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
      fnaType="retirement"
      clientName={clientName}
      steps={WIZARD_STEPS}
      currentStep={state.currentStep}
      isPublishing={isPublishing}
    >
      {renderStep()}
    </FNAWizardShell>
  );
}
