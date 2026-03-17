import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Progress } from '../../../../ui/progress';
import { RoAStepStart } from './roa-steps/RoAStepStart';
import { RoAStepClient } from './roa-steps/RoAStepClient';
import { RoAStepModules } from './roa-steps/RoAStepModules';
import { RoAStepModuleDetails } from './roa-steps/RoAStepModuleDetails';
import { RoAStepReview } from './roa-steps/RoAStepReview';
import { ChevronLeft, ChevronRight, FileText, Save } from 'lucide-react';
import { RoADraft, RoAModule, RoAField } from '../types';

export type { RoADraft, RoAModule, RoAField };

const STEPS = [
  { id: 'start', title: 'Start', description: 'Begin RoA draft' },
  { id: 'client', title: 'Client', description: 'Select or create client' },
  { id: 'modules', title: 'Modules', description: 'Choose advice modules' },
  { id: 'details', title: 'Details', description: 'Complete module forms' },
  { id: 'review', title: 'Review', description: 'Compile and export' }
];

export function DraftRoAInterface() {
  const [currentStep, setCurrentStep] = useState(0);
  const [roaDraft, setRoaDraft] = useState<RoADraft | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const currentStepData = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      autoSave();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const autoSave = async () => {
    if (!roaDraft) return;
    
    setIsAutoSaving(true);
    // Mock autosave delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setRoaDraft(prev => prev ? {
      ...prev,
      updatedAt: new Date()
    } : null);
    
    setIsAutoSaving(false);
  };

  const updateDraft = (updates: Partial<RoADraft>) => {
    setRoaDraft(prev => prev ? { ...prev, ...updates } : null);
  };

  const createNewDraft = () => {
    const newDraft: RoADraft = {
      id: `roa-${Date.now()}`,
      selectedModules: [],
      moduleData: {},
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
    setRoaDraft(newDraft);
    setCurrentStep(1); // Move to client step
  };

  const resumeExistingDraft = (draft: RoADraft) => {
    setRoaDraft(draft);
    // Determine appropriate step based on draft completion
    if (!draft.clientId && !draft.clientData) {
      setCurrentStep(1); // Client step
    } else if (draft.selectedModules.length === 0) {
      setCurrentStep(2); // Modules step
    } else {
      setCurrentStep(3); // Details step
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Start
        return true;
      case 1: // Client
        return roaDraft && (roaDraft.clientId || roaDraft.clientData);
      case 2: // Modules
        return roaDraft && roaDraft.selectedModules.length > 0;
      case 3: // Details
        return roaDraft && roaDraft.selectedModules.every(moduleId => 
          roaDraft.moduleData[moduleId] && 
          Object.keys(roaDraft.moduleData[moduleId]).length > 0
        );
      case 4: // Review
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <RoAStepStart 
            onCreateNew={createNewDraft}
            onResume={resumeExistingDraft}
          />
        );
      case 1:
        return (
          <RoAStepClient 
            draft={roaDraft}
            onUpdate={updateDraft}
          />
        );
      case 2:
        return (
          <RoAStepModules 
            draft={roaDraft}
            onUpdate={updateDraft}
          />
        );
      case 3:
        return (
          <RoAStepModuleDetails 
            draft={roaDraft}
            onUpdate={updateDraft}
          />
        );
      case 4:
        return (
          <RoAStepReview 
            draft={roaDraft}
            onUpdate={updateDraft}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Record of Advice Draft
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Step {currentStep + 1} of {STEPS.length}: {currentStepData.title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAutoSaving && (
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  <Save className="h-3 w-3 mr-1" />
                  Saving...
                </Badge>
              )}
              {roaDraft && (
                <Badge variant="secondary">
                  Draft v{roaDraft.version}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentStepData.description}</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${index <= currentStep 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                    }
                  `}>
                    {index + 1}
                  </div>
                  <div className="ml-2 hidden sm:block">
                    <p className={`text-sm font-medium ${
                      index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`h-px w-8 mx-4 ${
                      index < currentStep ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <Button
                onClick={handleNext}
                disabled={currentStep === STEPS.length - 1 || !canProceed()}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
