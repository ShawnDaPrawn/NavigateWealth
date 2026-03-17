import React from 'react';
import { Button } from '../../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../ui/dialog';
import { Progress } from '../../../ui/progress';
import { Separator } from '../../../ui/separator';
import { ScrollArea } from '../../../ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  Loader2
} from 'lucide-react';

export interface FNAWizardStepConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface FNAWizardLayoutProps {
  // Dialog Control
  open: boolean;
  onClose: () => void;
  
  // Header Info
  title: string;
  description?: string;
  
  // Steps
  steps: FNAWizardStepConfig[];
  currentStepIndex: number;
  onStepChange?: (index: number) => void;
  
  // Navigation Actions
  onBack: () => void;
  onNext: () => void;
  onSave?: () => void;
  
  // State flags
  loading?: boolean;
  isSaving?: boolean;
  isNextDisabled?: boolean;
  isLastStep?: boolean;
  
  // Custom Labels/Icons
  nextLabel?: string;
  nextIcon?: React.ElementType;
  saveLabel?: string;
  
  // Content
  children: React.ReactNode;
}

export function FNAWizardLayout({
  open,
  onClose,
  title,
  description,
  steps,
  currentStepIndex,
  onStepChange,
  onBack,
  onNext,
  onSave,
  loading = false,
  isSaving = false,
  isNextDisabled = false,
  isLastStep = false,
  nextLabel = 'Next',
  nextIcon: NextIcon = ChevronRight,
  saveLabel = 'Save Draft',
  children
}: FNAWizardLayoutProps) {
  
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Handle step click (navigation via icons)
  const handleStepClick = (index: number) => {
    // Only allow clicking previous steps or current step
    // Or if we want to allow free navigation, we can enable it here
    if (onStepChange && index <= currentStepIndex) {
      onStepChange(index);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-[90vw] h-[90vh] flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center space-y-4">
             <Loader2 className="h-10 w-10 animate-spin text-primary" />
             <p className="text-lg text-muted-foreground">Loading...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[90vw] sm:max-w-[90vw] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b bg-gray-50/50">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between">
                <div>
                    <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                    {description && (
                    <DialogDescription className="text-sm text-muted-foreground mt-1">
                        {description}
                    </DialogDescription>
                    )}
                </div>
            </div>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="space-y-2 mb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-medium">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress
              value={progress}
              className="h-2"
              aria-label={`Wizard progress: step ${currentStepIndex + 1} of ${steps.length}`}
            />
          </div>

          {/* Step Indicators */}
          <div
            className="flex items-center justify-between gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide"
            role="tablist"
            aria-label="Wizard steps"
          >
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStepIndex;
              const isCompleted = idx < currentStepIndex;
              const isClickable = onStepChange && idx <= currentStepIndex;
              
              return (
                <div
                  key={step.id}
                  onClick={() => isClickable && handleStepClick(idx)}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleStepClick(idx);
                    }
                  }}
                  role="tab"
                  tabIndex={isClickable ? 0 : -1}
                  aria-selected={isActive}
                  aria-label={`Step ${idx + 1}: ${step.label}${isCompleted ? ' (completed)' : isActive ? ' (current)' : ''}`}
                  className={`
                    flex flex-col items-center gap-2 min-w-[80px] group transition-all duration-200
                    ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                    ${isActive ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-80'}
                  `}
                >
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm border-2
                      ${isCompleted
                        ? 'bg-green-100 border-green-200 text-green-700'
                        : isActive
                        ? 'bg-primary border-primary text-primary-foreground shadow-md'
                        : 'bg-white border-gray-200 text-gray-400'
                      }
                    `}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`
                    text-xs font-medium text-center max-w-[100px] leading-tight
                    ${isActive ? 'text-primary' : 'text-gray-500'}
                  `}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTENT - Scrollable Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30" role="tabpanel" aria-label={`Step ${currentStepIndex + 1}: ${steps[currentStepIndex]?.label}`}>
             <div className="w-full max-w-none px-12 py-8 mx-auto">
                {children}
             </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-white flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={currentStepIndex === 0 || isSaving}
            className="w-[120px]"
            aria-label={`Previous step${currentStepIndex > 0 ? `: ${steps[currentStepIndex - 1]?.label}` : ''}`}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-3">
            {onSave && (
              <Button 
                variant="secondary" 
                onClick={onSave}
                disabled={isSaving}
                className="w-[140px]"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saveLabel}
              </Button>
            )}

            <Button 
                onClick={onNext}
                disabled={isNextDisabled || isSaving}
                className={`w-[160px] ${isLastStep ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
                {isSaving && isLastStep ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                    <NextIcon className="h-4 w-4 mr-2" />
                )}
                {nextLabel}
            </Button>
          </div>
        </div>

        {/* Screen reader announcement for step changes */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex]?.label}
        </div>
      </DialogContent>
    </Dialog>
  );
}