/**
 * Tax Planning FNA Wizard
 *
 * Runs the shared four-step FNA flow (see fna/wizard/fnaWizardFlow.ts) inside
 * the shared FNAWizardShell. This file owns only what is specific to tax: the
 * baseline / scenario calculation and the call that persists the record.
 */

import { useState } from 'react';
import { FNAWizardShell, resolveInitialFNAStep, useFNAPublish } from '../../fna';
import type { FNAWizardProps } from '../../fna';
import { Step1InputForm } from './Step1InputForm';
import { Step2SystemCalculation } from './Step2SystemCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';
import type {
  TaxPlanningInputs,
  TaxCalculationResults,
  AdjustmentLog,
  TaxRecommendation,
  WizardStep,
} from '../types';
import { WIZARD_STEPS } from '../constants';
import { TaxPlanningCalculationService } from '../services/taxPlanningCalculationService';
import { TaxPlanningFnaAPI } from '../api';

export function TaxPlanningFNAWizard({
  clientId,
  clientName,
  open,
  onClose,
  onFNAComplete,
  startAtStep,
  intakePrefill,
}: FNAWizardProps) {
  const initialStep = resolveInitialFNAStep(startAtStep, intakePrefill);
  const intakeInputs =
    intakePrefill && Object.keys(intakePrefill).length > 0
      ? (intakePrefill as unknown as TaxPlanningInputs)
      : null;

  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);

  // Baseline: the inputs confirmed in Step 1 and their calculation.
  const [baselineInputs, setBaselineInputs] = useState<TaxPlanningInputs | null>(intakeInputs);
  const [baselineResults, setBaselineResults] = useState<TaxCalculationResults | null>(() =>
    initialStep === 2 && intakeInputs
      ? TaxPlanningCalculationService.calculate(intakeInputs)
      : null,
  );

  // Scenario: the adviser's adjusted inputs from Step 3.
  const [adjustedInputs, setAdjustedInputs] = useState<TaxPlanningInputs | null>(intakeInputs);
  const [adjustments, setAdjustments] = useState<AdjustmentLog[]>([]);

  const { isPublishing, publish } = useFNAPublish({ fnaType: 'tax', onFNAComplete, onClose });

  const handleStep1Submit = (inputs: TaxPlanningInputs) => {
    setBaselineInputs(inputs);
    setBaselineResults(TaxPlanningCalculationService.calculate(inputs));
    // Baseline = adjusted until the adviser models a scenario.
    setAdjustedInputs(inputs);
    setAdjustments([]);
    setCurrentStep(2);
  };

  const handleStep3Submit = (
    newAdjustedInputs: TaxPlanningInputs,
    newAdjustments: AdjustmentLog[],
  ) => {
    setAdjustedInputs(newAdjustedInputs);
    setAdjustments(newAdjustments);
    setCurrentStep(4);
  };

  const handlePublish = (recommendations: TaxRecommendation[], adviserNotes: string) => {
    if (!adjustedInputs) return;

    void publish(async () => {
      const session = await TaxPlanningFnaAPI.saveSession(clientId, {
        inputs: adjustedInputs,
        // Recalculated so the stored results always match the stored inputs.
        finalResults: TaxPlanningCalculationService.calculate(adjustedInputs),
        adjustments,
        recommendations,
        adviserNotes,
        status: 'published',
      });
      return session.id;
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1InputForm
            clientId={clientId}
            initialData={baselineInputs || {}}
            onNext={handleStep1Submit}
          />
        );
      case 2:
        if (!baselineInputs || !baselineResults) return null;
        return (
          <Step2SystemCalculation
            inputs={baselineInputs}
            calculations={baselineResults}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        );
      case 3:
        if (!baselineInputs || !baselineResults || !adjustedInputs) return null;
        return (
          <Step3ManualAdjustment
            baselineInputs={baselineInputs}
            baselineResults={baselineResults}
            onCalculate={(inputs) => TaxPlanningCalculationService.calculate(inputs)}
            onNext={handleStep3Submit}
            onBack={() => setCurrentStep(2)}
          />
        );
      case 4:
        if (!adjustedInputs) return null;
        return (
          <Step4Finalise
            finalInputs={adjustedInputs}
            finalResults={TaxPlanningCalculationService.calculate(adjustedInputs)}
            adjustments={adjustments}
            onPublish={handlePublish}
            onBack={() => setCurrentStep(3)}
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
      fnaType="tax"
      clientName={clientName}
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      isPublishing={isPublishing}
    >
      {renderStep()}
    </FNAWizardShell>
  );
}
