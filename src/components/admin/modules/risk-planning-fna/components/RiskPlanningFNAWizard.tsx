/**
 * Risk Planning FNA Wizard
 * Main wizard component that orchestrates the 4-step FNA process
 *
 * Overall Tool Flow (MANDATORY):
 * 1. Information Gathering
 * 2. System Auto-Calculation (formula-driven, no edits)
 * 3. Adviser Manual Adjustment (Rand overrides only)
 * 4. Finalise & Publish
 *
 * Users may not skip steps.
 * All prior data flows forward and is preserved for audit.
 */

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '../../../../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { calculateRiskAnalysis } from '../utils';
import { WIZARD_STEPS } from '../constants';
import { useFNAMutations } from '../hooks';
import { RiskPlanningFnaAPI } from '../api';
import { Step1InformationGathering } from './Step1InformationGathering';
import { Step2AutoCalculation } from './Step2AutoCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';
import type { WizardState, InformationGatheringInput, Adjustments, FinalRiskNeed } from '../types';

interface RiskPlanningFNAWizardProps {
  clientId?: string;
  clientName?: string;
  onComplete?: () => void;
  onFNAComplete?: () => void; // Compatible with fna-config interface
  open?: boolean; // Compatible with Dialog interface
  onClose?: () => void; // Compatible with Dialog interface
  /** Open wizard at Step 2+ with client intake pre-fill (after queue accept) */
  startAtStep?: number;
  intakePrefill?: Record<string, unknown>;
}

function buildInitialRiskState(
  clientId: string | undefined,
  clientName: string | undefined,
  startAtStep: number | undefined,
  intakePrefill: Record<string, unknown> | undefined,
): WizardState {
  if (startAtStep === 2 && intakePrefill) {
    const inputData = intakePrefill as unknown as InformationGatheringInput;
    const calculations = calculateRiskAnalysis(inputData, 'Current User');
    return {
      currentStep: 2,
      clientId,
      clientName,
      inputData,
      calculations,
      adjustments: {},
      isPublishing: false,
    };
  }

  return {
    currentStep: (startAtStep && startAtStep >= 1 && startAtStep <= 4 ? startAtStep : 1) as
      | 1
      | 2
      | 3
      | 4,
    clientId,
    clientName,
    inputData: intakePrefill ? (intakePrefill as unknown as InformationGatheringInput) : null,
    calculations: null,
    adjustments: {},
    isPublishing: false,
  };
}

export function RiskPlanningFNAWizard({
  clientId,
  clientName,
  onComplete,
  onFNAComplete,
  open,
  onClose,
  startAtStep,
  intakePrefill,
}: RiskPlanningFNAWizardProps) {
  const [state, setState] = useState<WizardState>(() =>
    buildInitialRiskState(clientId, clientName, startAtStep, intakePrefill),
  );

  const { publishFNA } = useFNAMutations();

  // Handle completion callback
  const handleComplete = () => {
    if (onFNAComplete) onFNAComplete();
    if (onComplete) onComplete();
    if (onClose) onClose();
  };

  // Step 1: Submit information gathering data
  const handleStep1Submit = (inputData: InformationGatheringInput) => {
    // Perform calculation immediately
    const calculations = calculateRiskAnalysis(inputData, 'Current User'); // TODO: Get from auth context

    setState((prev) => ({
      ...prev,
      inputData,
      calculations,
      currentStep: 2,
    }));
  };

  // Step 2: Navigate back to Step 1
  const handleStep2Back = () => {
    setState((prev) => ({ ...prev, currentStep: 1 }));
  };

  // Step 2: Proceed to Step 3
  const handleStep2Next = () => {
    setState((prev) => ({ ...prev, currentStep: 3 }));
  };

  // Step 3: Navigate back to Step 2
  const handleStep3Back = () => {
    setState((prev) => ({ ...prev, currentStep: 2 }));
  };

  // Step 3: Submit adjustments and proceed to Step 4
  const handleStep3Submit = (adjustments: Adjustments) => {
    setState((prev) => ({
      ...prev,
      adjustments,
      currentStep: 4,
    }));
  };

  // Step 4: Navigate back to Step 3
  const handleStep4Back = () => {
    setState((prev) => ({ ...prev, currentStep: 3 }));
  };

  // Step 4: Publish FNA
  const handlePublish = async (finalNeeds: FinalRiskNeed[]) => {
    if (!state.inputData || !state.calculations || !clientId) {
      return;
    }

    setState((prev) => ({ ...prev, isPublishing: true }));

    try {
      // Step 1: Create FNA with all data
      const created = await RiskPlanningFnaAPI.create(clientId, {
        inputData: state.inputData,
        calculations: state.calculations,
        adjustments: state.adjustments,
        finalNeeds,
      } as unknown as Parameters<typeof RiskPlanningFnaAPI.create>[1]);

      const fnaId = created.id;

      // Step 2: Publish the FNA
      await publishFNA(fnaId);

      // Success - call onComplete callback if provided
      handleComplete();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isPublishing: false,
        publishError: 'Failed to publish FNA. Please try again.',
      }));
    }
  };

  // Render current step
  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <Step1InformationGathering
            clientId={state.clientId}
            initialData={state.inputData || undefined}
            onNext={handleStep1Submit}
          />
        );

      case 2:
        if (!state.calculations) return null;
        return (
          <Step2AutoCalculation
            calculations={state.calculations}
            onNext={handleStep2Next}
            onBack={handleStep2Back}
          />
        );

      case 3:
        if (!state.calculations) return null;
        return (
          <Step3ManualAdjustment
            calculations={state.calculations}
            initialAdjustments={state.adjustments}
            onNext={handleStep3Submit}
            onBack={handleStep3Back}
          />
        );

      case 4:
        if (!state.calculations) return null;
        return (
          <Step4Finalise
            calculations={state.calculations}
            adjustments={state.adjustments}
            onPublish={handlePublish}
            onBack={handleStep4Back}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[1600px] w-[95vw] max-h-[90vh] overflow-y-auto p-8">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold">
            Risk Planning FNA {clientName && `- ${clientName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stepper */}
          <div className="flex justify-between items-center relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10" />
            {WIZARD_STEPS.map((step) => {
              const isActive = state.currentStep === step.step;
              const isCompleted = state.currentStep > step.step;

              return (
                <div key={step.step} className="flex flex-col items-center bg-background px-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                      ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isCompleted
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground text-muted-foreground bg-background'
                      }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-medium text-sm">{step.step}</span>
                    )}
                  </div>
                  <div className="mt-2 text-center max-w-[180px]">
                    <p
                      className={`text-sm font-semibold ${
                        isActive ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="min-h-[500px]">{renderStep()}</div>

          {/* Publishing State Overlay */}
          {state.isPublishing && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <Card className="p-6 max-w-sm">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                  <p className="font-medium text-base">Publishing FNA...</p>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we save your Risk Planning Analysis
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
