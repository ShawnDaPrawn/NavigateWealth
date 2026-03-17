import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../../ui/dialog';
import { RequestTemplate, Request, ClientAssociationRule, RequestPriority } from '../../types';
import { RequestStatus } from '../../types';
import { StepSelectTemplate } from './new-request-steps/StepSelectTemplate';
import { StepAssociateClient } from './new-request-steps/StepAssociateClient';
import { StepRequestDetails } from './new-request-steps/StepRequestDetails';
import { StepAssignees } from './new-request-steps/StepAssignees';
import { StepReview } from './new-request-steps/StepReview';
import { useAuth } from '../../../../../auth/AuthContext';

interface NewRequestWizardProps {
  onClose: () => void;
  onSuccess: (request: Request) => void;
}

interface RequestDraft {
  templateId: string | null;
  template: RequestTemplate | null;
  clientId: string | null;
  clientName: string | null;
  requestSubject: string | null;
  requestDetails: Record<string, string | number | boolean | string[] | null>;
  assignees: string[];
  priority: RequestPriority;
}

export function NewRequestWizard({ onClose, onSuccess }: NewRequestWizardProps) {
  const { user } = useAuth();
  const currentUserId = user?.id || 'unknown';
  const [currentStep, setCurrentStep] = useState(1);
  const [draft, setDraft] = useState<RequestDraft>({
    templateId: null,
    template: null,
    clientId: null,
    clientName: null,
    requestSubject: null,
    requestDetails: {},
    assignees: [],
    priority: RequestPriority.MEDIUM,
  });

  const steps = [
    { number: 1, title: 'Select Template', description: 'Choose request type' },
    { number: 2, title: 'Associate Client', description: 'Link to client' },
    { number: 3, title: 'Request Details', description: 'Capture information' },
    { number: 4, title: 'Assignees', description: 'Assign team members' },
    { number: 5, title: 'Review', description: 'Confirm & create' },
  ];

  const updateDraft = (updates: Partial<RequestDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return draft.template !== null;
      case 2:
        // Check client association rule
        if (!draft.template) return false;
        if (draft.template.clientAssociationRule === ClientAssociationRule.REQUIRED) {
          return draft.clientId !== null;
        }
        if (draft.template.clientAssociationRule === ClientAssociationRule.OPTIONAL) {
          // If no client selected, must have request subject
          if (!draft.clientId && !draft.requestSubject) return false;
        }
        return true;
      case 3:
        // Check all required fields are filled
        if (!draft.template) return false;
        const requiredFields = draft.template.requestDetailsSchema.flatMap(section =>
          section.fields.filter(f => f.required).map(f => f.key)
        );
        return requiredFields.every(key => {
          const value = draft.requestDetails[key];
          return value !== undefined && value !== null && value !== '';
        });
      case 4:
        // Check assignees based on template rules
        return draft.assignees.length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceedFromStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleCreate = async () => {
    // TODO: Implement API call to create request
    console.log('Creating request:', draft);
    
    // Simulate API call
    const newRequest: Request = {
      id: `REQ-${Date.now()}`,
      templateId: draft.templateId!,
      templateVersion: draft.template!.version,
      status: RequestStatus.NEW,
      priority: draft.priority,
      clientId: draft.clientId || undefined,
      clientName: draft.clientName || undefined,
      requestDetails: draft.requestDetails,
      assignees: draft.assignees.map(userId => ({
        userId,
        userName: 'User Name', // TODO: Get from API
        role: 'Admin',
        assignedAt: new Date().toISOString(),
        assignedBy: currentUserId,
      })),
      complianceApproval: {
        required: draft.template!.complianceApprovalConfig.enabled,
        checklistStatus: [],
      },
      lifecycle: {
        stageHistory: [],
      },
      complianceSignOff: {
        required: draft.template!.complianceSignOffConfig.enabled,
        deficiencies: [],
      },
      finalised: false,
      documentIds: [],
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      updatedBy: currentUserId,
      updatedAt: new Date().toISOString(),
    };

    onSuccess(newRequest);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepSelectTemplate
            selectedTemplate={draft.template}
            onSelectTemplate={(template) => updateDraft({ template, templateId: template.id })}
          />
        );
      case 2:
        return (
          <StepAssociateClient
            template={draft.template!}
            clientId={draft.clientId}
            clientName={draft.clientName}
            requestSubject={draft.requestSubject}
            onSelectClient={(clientId, clientName) => updateDraft({ clientId, clientName })}
            onSetRequestSubject={(subject) => updateDraft({ requestSubject: subject })}
          />
        );
      case 3:
        return (
          <StepRequestDetails
            template={draft.template!}
            requestDetails={draft.requestDetails}
            onUpdateDetails={(details) => updateDraft({ requestDetails: details })}
          />
        );
      case 4:
        return (
          <StepAssignees
            template={draft.template!}
            assignees={draft.assignees}
            onUpdateAssignees={(assignees) => updateDraft({ assignees })}
          />
        );
      case 5:
        return (
          <StepReview
            draft={draft}
            onUpdatePriority={(priority) => updateDraft({ priority })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[64vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">New Request</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {steps[currentStep - 1].description}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4 py-6 border-b">
          {steps.map((step, index) => (
            <div className="contents" key={step.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    step.number === currentStep
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : step.number < currentStep
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-slate-300 bg-white text-slate-400'
                  }`}
                >
                  {step.number < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.number}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-xs font-medium ${
                      step.number === currentStep
                        ? 'text-blue-600'
                        : step.number < currentStep
                        ? 'text-green-600'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    step.number < currentStep ? 'bg-green-600' : 'bg-slate-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {renderStepContent()}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="text-sm text-slate-500">
            Step {currentStep} of {steps.length}
          </div>

          {currentStep < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={!canProceedFromStep(currentStep)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={!canProceedFromStep(currentStep)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Create Request
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}