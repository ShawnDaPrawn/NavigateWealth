/**
 * Medical FNA Wizard
 * South African Medical Aid Financial Needs Analysis - 4 Step Process
 * 
 * Overall Tool Flow (MANDATORY):
 * 1. Information Gathering
 * 2. System Auto-Calculation (formula-driven, no edits)
 * 3. Adviser Manual Adjustment (overrides only)
 * 4. Finalise & Publish
 * 
 * Users may not skip steps.
 * All prior data flows forward and is preserved for audit.
 */

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Card } from '../../../../ui/card';
import { Step1InputForm } from './Step1InputForm';
import { Step2SystemCalculation } from './Step2SystemCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';
import { 
  MedicalFNAInputs, 
  MedicalFNAResults, 
  MedicalFNAAdjustments, 
  MedicalFNAFinalNeeds,
  MedicalFNAWizardState,
} from '../types';
import { WIZARD_STEPS } from '../constants';
import { calculateMedicalNeeds } from '../utils/calculations';
import { MedicalFNAApiService } from '../api';

interface MedicalFNAWizardProps {
  clientId?: string;
  clientName?: string;
  onComplete?: () => void;
  onFNAComplete?: () => void; // Compatible with fna-config interface
  open?: boolean;
  onClose?: () => void;
}

export function MedicalFNAWizard({
  clientId,
  clientName,
  onComplete,
  onFNAComplete,
  open,
  onClose
}: MedicalFNAWizardProps) {
  const [state, setState] = useState<MedicalFNAWizardState>({
    currentStep: 1,
    clientId,
    clientName,
    inputs: {},
    calculations: null,
    adjustments: { notes: '' },
    isPublishing: false,
  });

  // Handle completion callback
  const handleComplete = () => {
    if (onFNAComplete) onFNAComplete();
    if (onComplete) onComplete();
    if (onClose) onClose();
  };

  // Step 1: Submit -> Calculate -> Go to Step 2
  const handleStep1Submit = (inputs: MedicalFNAInputs) => {
    const calculations = calculateMedicalNeeds(inputs);
    
    setState(prev => ({
      ...prev,
      inputs,
      calculations,
      currentStep: 2
    }));
  };

  // Step 2: Next -> Go to Step 3
  const handleStep2Next = () => {
    setState(prev => ({ ...prev, currentStep: 3 }));
  };
  const handleStep2Back = () => {
    setState(prev => ({ ...prev, currentStep: 1 }));
  };

  // Step 3: Submit Adjustments -> Go to Step 4
  const handleStep3Submit = (adjustments: MedicalFNAAdjustments) => {
    setState(prev => ({
      ...prev,
      adjustments,
      currentStep: 4
    }));
  };
  const handleStep3Back = () => {
    setState(prev => ({ ...prev, currentStep: 2 }));
  };

  // Step 4: Final Publish
  const handlePublish = async (finalNeeds: MedicalFNAFinalNeeds) => {
    setState(prev => ({ ...prev, isPublishing: true }));
    
    try {
      if (!clientId) {
        throw new Error("Client ID is required to publish FNA");
      }

      // 1. Create new FNA Session
      const session = await MedicalFNAApiService.createMedicalFNA(clientId);
      
      // 2. Save Inputs (including existing policy details)
      // Note: We cast inputs because partial might miss required fields, but validation ensured they exist
      await MedicalFNAApiService.updateMedicalFNAInputs(session.id, state.inputs as MedicalFNAInputs);

      // 3. Save Results & Adjustments (from client-side calculation)
      await MedicalFNAApiService.updateMedicalFNAResults(
        session.id, 
        state.calculations, 
        state.adjustments
      );

      // 4. Publish
      await MedicalFNAApiService.publishMedicalFNA(session.id);
      
      console.log('Publishing Medical FNA:', {
        id: session.id,
        clientId,
        inputs: state.inputs,
        calculations: state.calculations,
        adjustments: state.adjustments,
        finalNeeds
      });
      
      toast.success("Medical Needs Analysis published successfully");
      
      handleComplete();
      
    } catch (error) {
      console.error('Failed to publish FNA:', error);
      toast.error("Failed to publish analysis");
      setState(prev => ({ ...prev, isPublishing: false }));
    }
  };
  const handleStep4Back = () => {
    setState(prev => ({ ...prev, currentStep: 3 }));
  };

  // Render Step Content
  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <Step1InputForm 
            clientId={clientId}
            initialData={state.inputs as Partial<MedicalFNAInputs>}
            onNext={handleStep1Submit}
          />
        );
      case 2:
        if (!state.calculations) return null;
        return (
          <Step2SystemCalculation
            inputs={state.inputs}
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
            inputs={state.inputs as MedicalFNAInputs}
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
            Medical Aid FNA {clientName && `- ${clientName}`}
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
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="min-h-[500px]">
            {renderStep()}
          </div>
          
          {/* Publishing State Overlay */}
          {state.isPublishing && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <Card className="p-6 max-w-sm">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                  <p className="font-medium text-base">Publishing FNA...</p>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we save your Medical Aid Needs Analysis
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
