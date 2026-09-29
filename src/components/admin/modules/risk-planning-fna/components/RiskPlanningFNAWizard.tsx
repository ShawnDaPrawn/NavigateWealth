/**
 * Risk Planning FNA Wizard
 *
 * Runs the shared four-step FNA flow (see fna/wizard/fnaWizardFlow.ts) inside
 * the shared FNAWizardShell. This file owns only what is specific to risk:
 * the calculation and the calls that persist the analysis.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FNAWizardShell, resolveInitialFNAStep, useFNAPublish } from '../../fna';
import type { FNAWizardProps, FNAWizardStepNumber } from '../../fna';
import { calculateRiskAnalysis } from '../utils';
import { WIZARD_STEPS } from '../constants';
import { RiskPlanningFnaAPI } from '../api';
import { riskFnaKeys } from '../hooks/queryKeys';
import { Step1InformationGathering } from './Step1InformationGathering';
import { Step2AutoCalculation } from './Step2AutoCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';
import type { WizardState, InformationGatheringInput, Adjustments, FinalRiskNeed } from '../types';

const CALCULATED_BY = 'Current User'; // TODO: take from the auth context

function buildInitialRiskState({
  clientId,
  clientName,
  startAtStep,
  intakePrefill,
}: FNAWizardProps): WizardState {
  const currentStep = resolveInitialFNAStep(startAtStep, intakePrefill);
  const inputData = intakePrefill ? (intakePrefill as unknown as InformationGatheringInput) : null;

  return {
    currentStep,
    clientId,
    clientName,
    inputData,
    calculations:
      currentStep === 2 && inputData ? calculateRiskAnalysis(inputData, CALCULATED_BY) : null,
    adjustments: {},
  };
}

export function RiskPlanningFNAWizard(props: FNAWizardProps) {
  const { clientId, clientName, open, onClose, onFNAComplete } = props;
  const [state, setState] = useState<WizardState>(() => buildInitialRiskState(props));
  const queryClient = useQueryClient();
  const { isPublishing, publish } = useFNAPublish({ fnaType: 'risk', onFNAComplete, onClose });

  const goTo = (currentStep: FNAWizardStepNumber) => setState((prev) => ({ ...prev, currentStep }));

  const handleStep1Submit = (inputData: InformationGatheringInput) => {
    const calculations = calculateRiskAnalysis(inputData, CALCULATED_BY);
    setState((prev) => ({ ...prev, inputData, calculations, currentStep: 2 }));
  };

  const handleStep3Submit = (adjustments: Adjustments) => {
    setState((prev) => ({ ...prev, adjustments, currentStep: 4 }));
  };

  const handlePublish = (finalNeeds: FinalRiskNeed[]) => {
    const { inputData, calculations, adjustments } = state;
    if (!inputData || !calculations) return;

    void publish(async () => {
      const created = await RiskPlanningFnaAPI.create(clientId, {
        inputData,
        calculations,
        adjustments,
        finalNeeds,
      });
      await RiskPlanningFnaAPI.publish(created.id);
      await queryClient.invalidateQueries({ queryKey: riskFnaKeys.all });
      return created.id;
    });
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <Step1InformationGathering
            clientId={clientId}
            initialData={state.inputData || undefined}
            onNext={handleStep1Submit}
          />
        );
      case 2:
        if (!state.calculations) return null;
        return (
          <Step2AutoCalculation
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
      fnaType="risk"
      clientName={clientName}
      steps={WIZARD_STEPS}
      currentStep={state.currentStep}
      isPublishing={isPublishing}
    >
      {renderStep()}
    </FNAWizardShell>
  );
}
