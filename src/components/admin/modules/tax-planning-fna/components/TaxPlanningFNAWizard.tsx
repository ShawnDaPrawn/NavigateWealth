import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Card } from '../../../../ui/card';

// Components
import { Step1InputForm } from './Step1InputForm';
import { Step2SystemCalculation } from './Step2SystemCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';

// Logic
import { 
  TaxPlanningInputs, 
  TaxCalculationResults,
  AdjustmentLog,
  TaxRecommendation,
  WizardStep,
} from '../types';
import { WIZARD_STEPS } from '../constants';
import { TaxPlanningCalculationService } from '../services/taxPlanningCalculationService';
import { TaxPlanningFnaAPI } from '../api';

interface TaxPlanningFNAWizardProps {
  clientId?: string;
  clientName?: string;
  open?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  onFNAComplete?: () => void;
}

export function TaxPlanningFNAWizard({
  clientId,
  clientName,
  open,
  onClose,
  onComplete,
  onFNAComplete
}: TaxPlanningFNAWizardProps) {
  
  // ================= STATE =================
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isPublishing, setIsPublishing] = useState(false);

  // Data Store
  const [baselineInputs, setBaselineInputs] = useState<TaxPlanningInputs | null>(null);
  const [baselineResults, setBaselineResults] = useState<TaxCalculationResults | null>(null);
  
  // Scenario Store
  const [adjustedInputs, setAdjustedInputs] = useState<TaxPlanningInputs | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentLog[]>([]);

  // ================= ACTIONS =================

  // STEP 1 -> 2
  const handleStep1Submit = (inputs: TaxPlanningInputs) => {
    // 1. Lock Baseline Inputs
    setBaselineInputs(inputs);
    
    // 2. Run Deterministic Engine
    const results = TaxPlanningCalculationService.calculate(inputs);
    setBaselineResults(results);

    // 3. Initialize Adjusted State (Baseline = Adjusted initially)
    setAdjustedInputs(inputs);
    setAdjustments([]); // Clear any old adjustments if we went back

    setCurrentStep(2);
  };

  // STEP 2 -> 3
  const handleStep2Next = () => {
    setCurrentStep(3);
  };

  // STEP 3 -> 4
  const handleStep3Submit = (newAdjustedInputs: TaxPlanningInputs, newAdjustments: AdjustmentLog[]) => {
    setAdjustedInputs(newAdjustedInputs);
    setAdjustments(newAdjustments);
    setCurrentStep(4);
  };

  // SERVICE WRAPPER FOR STEP 3
  const handleCalculateScenario = (inputs: TaxPlanningInputs) => {
    return TaxPlanningCalculationService.calculate(inputs);
  };

  // STEP 4 PUBLISH
  const handlePublish = async (recommendations: TaxRecommendation[], adviserNotes: string) => {
    if (!clientId || !baselineInputs || !adjustedInputs) {
      toast.error("Missing required data to publish");
      return;
    }

    setIsPublishing(true);
    
    try {
      // Recalculate final results to ensure consistency
      const finalResults = TaxPlanningCalculationService.calculate(adjustedInputs);

      await TaxPlanningFnaAPI.saveSession(clientId, {
        inputs: adjustedInputs,
        finalResults,
        adjustments,
        recommendations,
        adviserNotes,
        status: 'published'
      });
      
      toast.success("Tax Planning Record published successfully");
      
      if (onFNAComplete) onFNAComplete();
      if (onComplete) onComplete();
      if (onClose) onClose();
      
    } catch (error) {
      console.error("Failed to publish tax plan", error);
      toast.error("Failed to publish tax plan. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // ================= RENDER =================

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
            onNext={handleStep2Next}
            onBack={() => setCurrentStep(1)}
          />
        );
      case 3:
        if (!baselineInputs || !baselineResults || !adjustedInputs) return null;
        return (
          <Step3ManualAdjustment
            baselineInputs={baselineInputs}
            baselineResults={baselineResults}
            onCalculate={handleCalculateScenario}
            onNext={handleStep3Submit}
            onBack={() => setCurrentStep(2)}
          />
        );
      case 4:
        if (!adjustedInputs || !baselineInputs) return null;
        // We calculate final results on the fly or use a cached one. 
        // Let's re-calculate to be safe, ensuring consistency.
        const finalResults = TaxPlanningCalculationService.calculate(adjustedInputs);
        
        return (
          <Step4Finalise
            finalInputs={adjustedInputs}
            finalResults={finalResults}
            adjustments={adjustments}
            onPublish={handlePublish}
            onBack={() => setCurrentStep(3)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[1600px] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-semibold">
              Tax Planning FNA {clientName && `- ${clientName}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
              
            {/* Stepper - Standardized to match Risk/Retirement FNA */}
            <div className="flex justify-between items-center relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10" />
              {WIZARD_STEPS.map((step) => {
                const isActive = currentStep === step.step;
                const isCompleted = currentStep > step.step;
                
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
          </div>
        </div>

        {/* Publishing State Overlay */}
        {isPublishing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
            <Card className="p-6 max-w-sm shadow-lg border-2">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                <p className="font-medium text-base">Finalizing Record</p>
                <p className="text-sm text-muted-foreground">
                  Encrypting and locking tax planning data...
                </p>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}