import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { RequestTemplate, RequestPriority, ClientAssociationRule, AssignmentRule } from '../../types';
import { useTemplates } from '../../hooks/useTemplates';

// Step Components
import { Step1Basics } from './steps/Step1Basics';
import { Step2RequestDetails } from './steps/Step2RequestDetails';
import { Step3Assignees } from './steps/Step3Assignees';
import { Step4ComplianceApproval } from './steps/Step4ComplianceApproval';
import { Step5Lifecycle } from './steps/Step5Lifecycle';
import { Step6ComplianceSignOff } from './steps/Step6ComplianceSignOff';
import { Step7Finalisation } from './steps/Step7Finalisation';

interface TemplateWizardProps {
  template?: RequestTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { id: 1, name: 'Template Basics', component: Step1Basics },
  { id: 2, name: 'Request Details', component: Step2RequestDetails },
  { id: 3, name: 'Assignees', component: Step3Assignees },
  { id: 4, name: 'Compliance Approval', component: Step4ComplianceApproval },
  { id: 5, name: 'Lifecycle Builder', component: Step5Lifecycle },
  { id: 6, name: 'Compliance Sign-Off', component: Step6ComplianceSignOff },
  { id: 7, name: 'Finalisation', component: Step7Finalisation },
];

export function TemplateWizard({ template, onClose, onSuccess }: TemplateWizardProps) {
  const { createTemplate, updateTemplate } = useTemplates({ autoFetch: false });
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [templateData, setTemplateData] = useState<Partial<RequestTemplate>>(
    template || {
      clientAssociationRule: ClientAssociationRule.OPTIONAL,
      // Default to OPTIONAL to unblock validation, user can change if needed.
      defaultPriority: RequestPriority.MEDIUM,
      requestDetailsSchema: [],
      assigneeConfiguration: {
        defaultRoles: [],
        assignmentRule: AssignmentRule.MANUAL_REQUIRED,
        allowExternalAssignees: false,
        reminderConfig: {
          enabled: false,
          intervalHours: 48,
          sendToInternal: true,
          sendToExternal: false,
        },
      },
      complianceApprovalConfig: {
        enabled: false,
        checklistItems: [],
      },
      lifecycleConfiguration: {
        stages: [],
      },
      complianceSignOffConfig: {
        enabled: false,
        approverRole: 'Super Admin',
        deficiencyWorkflow: {
          allowDeficiencies: true,
          requireRemedialDocuments: false,
          requireRemedialComments: false,
        },
      },
      finalisationConfig: {
        completionStateLabel: 'Completed',
        lockAfterCompletion: true,
        requiredFinalDocuments: [],
        sendCompletionEmail: false,
      },
      communicationTriggers: [],
      pdfOutputConfig: {
        templateVersion: '1.0',
        includeSections: [],
        includeAuditLog: true,
      },
    }
  );

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Basics
        if (!templateData.name?.trim()) {
          toast.error('Template name is required');
          return false;
        }
        if (!templateData.category) {
          toast.error('Template category is required');
          return false;
        }
        if (!templateData.requestType) {
          toast.error('Request type is required');
          return false;
        }
        if (!templateData.clientAssociationRule) {
          toast.error('Client association rule is required');
          return false;
        }
        if (!templateData.defaultPriority) {
          toast.error('Default priority is required');
          return false;
        }
        return true;
      
      case 2: // Request Details
        return true;

      case 3: // Assignees
        if (!templateData.assigneeConfiguration?.assignmentRule) {
           toast.error('Assignment rule is required');
           return false;
        }
        return true;

      case 4: // Compliance Approval
        return true;

      case 5: // Lifecycle
        if (!templateData.lifecycleConfiguration?.stages || templateData.lifecycleConfiguration.stages.length === 0) {
           // It's possible to have no custom stages if there are defaults, but usually we want at least one
           // If the system provides defaults, this might be fine. 
           // Assuming explicit definition is better:
           toast.error('At least one lifecycle stage is required');
           return false;
        }
        return true;

      case 6: // Compliance Sign-Off
        if (templateData.complianceSignOffConfig?.enabled && !templateData.complianceSignOffConfig.approverRole) {
           toast.error('Approver role is required when compliance sign-off is enabled');
           return false;
        }
        return true;

      case 7: // Finalisation
        if (!templateData.finalisationConfig?.completionStateLabel) {
           toast.error('Completion state label is required');
           return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepId: number) => {
    // Only allow jumping to previous steps or the next immediate step (if valid)
    if (stepId < currentStep) {
      setCurrentStep(stepId);
    } else if (stepId === currentStep + 1) {
      if (validateStep(currentStep)) {
        setCurrentStep(stepId);
      }
    } else {
       // Optional: Prevent jumping ahead multiple steps without validating intermediate ones
       // For now, let's just allow clicking if it's the next step
       // Or iterate and validate all previous steps?
       // Let's stick to simple "only allow if previous steps are valid" logic, 
       // but implementing that fully might be complex. 
       // Simplest approach: Only allow next step.
       // But the UI shows clickable steps.
       
       // Improved Logic: Check all steps between current and target
       let allValid = true;
       for (let i = currentStep; i < stepId; i++) {
         if (!validateStep(i)) {
           allValid = false;
           break;
         }
       }
       
       if (allValid) {
         setCurrentStep(stepId);
       }
    }
  };

  const handleSave = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);

    try {
      if (template?.id) {
        // Update existing template
        const result = await updateTemplate(template.id, templateData);
        if (result.success) {
          toast.success('Template updated successfully!');
          onSuccess();
          onClose();
        } else {
          toast.error(`Failed to update template: ${result.error}`);
        }
      } else {
        // Create new template
        const result = await createTemplate(templateData);
        if (result.success) {
          toast.success('Template created successfully!');
          onSuccess();
          onClose();
        } else {
          toast.error(`Failed to create template: ${result.error}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const updateTemplateData = (updates: Partial<RequestTemplate>) => {
    setTemplateData((prev) => ({ ...prev, ...updates }));
  };

  const isLastStep = currentStep === STEPS.length;
  const isFirstStep = currentStep === 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl text-slate-900">
              {template ? 'Edit Template' : 'Create Request Template'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div className="contents" key={step.id}>
                <button
                  onClick={() => handleStepClick(step.id)}
                  className={`flex items-center gap-2 group ${
                    currentStep === step.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                      currentStep === step.id
                        ? 'bg-indigo-600 text-white'
                        : currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                    }`}
                  >
                    {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  <span className="text-xs hidden xl:block max-w-[100px] truncate">
                    {step.name}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 bg-slate-200 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <CurrentStepComponent
            templateData={templateData}
            updateTemplateData={updateTemplateData}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div>
            {!isFirstStep && (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {!isLastStep ? (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}