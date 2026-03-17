/**
 * AdminCompleteDialog
 *
 * Dialog for admin to complete a client's application on their behalf.
 * Reuses the existing onboarding step components (Step1Personal through
 * Step5Terms) with mode='admin' to track the completedBy audit field.
 *
 * SS7  -- No business logic in UI; uses useOnboarding hook
 * SS8.1 -- Follows existing dialog patterns (AlertDialog)
 * SS12.3 -- completedBy audit field for compliance
 */

import React, { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Progress } from '../../../../ui/progress';
import {
  ChevronLeft, ChevronRight, Send, Loader2,
  User, MapPin, Briefcase, FileText, Shield,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { toast } from 'sonner@2.0.3';
import { useOnboarding } from '../../../../modules/onboarding/hooks/useOnboarding';
import { Step1Personal } from '../../../../modules/onboarding/components/Step1Personal';
import { Step2Contact } from '../../../../modules/onboarding/components/Step2Contact';
import { Step3Employment } from '../../../../modules/onboarding/components/Step3Employment';
import { Step4Services } from '../../../../modules/onboarding/components/Step4Services';
import { Step5Terms } from '../../../../modules/onboarding/components/Step5Terms';
import type { Application } from '../types';

// -- Types --------------------------------------------------------------------

interface AdminCompleteDialogProps {
  application: Application | null;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  adminUserId: string;
}

// -- Step icon mapping --------------------------------------------------------

const STEP_ICONS = [User, MapPin, Briefcase, FileText, Shield];
const STEP_LABELS = ['Personal', 'Contact', 'Employment', 'Services', 'Terms'];

// -- Component ----------------------------------------------------------------

export function AdminCompleteDialog({
  application,
  open,
  onClose,
  onComplete,
  adminUserId,
}: AdminCompleteDialogProps) {
  if (!application) return null;

  const {
    currentStep,
    totalSteps,
    data,
    isLoading,
    validationErrors,
    progress,
    updateData,
    goToNextStep,
    goToPreviousStep,
    submit,
  } = useOnboarding({
    mode: 'admin',
    targetUserId: application.user_id,
    adminUserId,
  });

  const handleSubmit = useCallback(async () => {
    const result = await submit();
    if (result.success) {
      toast.success('Application submitted on behalf of client');
      onComplete();
      onClose();
    } else {
      toast.error(result.error || 'Failed to submit application');
    }
  }, [submit, onComplete, onClose]);

  const renderStep = () => {
    const stepProps = { data, updateData, errors: validationErrors };
    switch (currentStep) {
      case 1: return <Step1Personal {...stepProps} />;
      case 2: return <Step2Contact {...stepProps} />;
      case 3: return <Step3Employment {...stepProps} />;
      case 4: return <Step4Services {...stepProps} />;
      case 5: return <Step5Terms {...stepProps} />;
      default: return null;
    }
  };

  const clientName = application.user_name ||
    `${application.application_data?.firstName || ''} ${application.application_data?.lastName || ''}`.trim() ||
    'Client';

  return (
    <div className="contents">
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 gap-0 overflow-hidden bg-white flex flex-col" hideCloseButton>
          {/* Header */}
          <div className="px-6 py-4 border-b bg-white shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Complete Application
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 mt-0.5">
                  Completing on behalf of <span className="font-semibold text-gray-700">{clientName}</span>
                  {application.application_number && (
                    <span className="text-gray-400 ml-2">({application.application_number})</span>
                  )}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                Admin Mode
              </Badge>
            </div>

            {/* Step progress */}
            <div className="mt-4 flex items-center gap-2">
              {STEP_LABELS.map((label, idx) => {
                const stepNum = idx + 1;
                const Icon = STEP_ICONS[idx];
                const isActive = stepNum === currentStep;
                const isDone = stepNum < currentStep;
                return (
                  <div key={label} className="flex items-center gap-1">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                        isActive && 'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
                        isDone && 'bg-green-50 text-green-700',
                        !isActive && !isDone && 'bg-gray-50 text-gray-400',
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">{label}</span>
                    </div>
                    {idx < STEP_LABELS.length - 1 && (
                      <div className={cn('w-4 h-px', isDone ? 'bg-green-300' : 'bg-gray-200')} />
                    )}
                  </div>
                );
              })}
            </div>
            <Progress value={progress} className="mt-3 h-1" />
          </div>

          {/* Scrollable form content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    {validationErrors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {renderStep()}
          </div>

          {/* Footer navigation */}
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-white shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousStep}
              disabled={currentStep === 1 || isLoading}
              className="gap-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>

            <span className="text-xs text-gray-400">
              Step {currentStep} of {totalSteps}
            </span>

            {currentStep < totalSteps ? (
              <Button
                size="sm"
                onClick={goToNextStep}
                disabled={isLoading}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isLoading}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Submit on Behalf
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
