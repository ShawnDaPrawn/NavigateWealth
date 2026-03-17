import React, { useState, Suspense } from 'react';
import { 
  CheckCircle, 
  Users, 
  Mail, 
  Send, 
  History,
  Settings,
  Loader2
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { CommunicationDraft } from './types';
import { Step1Recipients } from './components/steps/Step1Recipients';
import { Step2Compose } from './components/steps/Step2Compose';
import { Step3Review } from './components/steps/Step3Review';
// Cross-module dependency: communication → personnel (public hook surface)
// Justified: Communication module requires permission gating for admin actions.
// §3.1 exception documented — shared permission context would be the ideal alternative.
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

// Heavy sub-views — lazy-loaded (only rendered on user action)
const CommunicationHistory = React.lazy(() => import('./components/CommunicationHistory').then(m => ({ default: m.CommunicationHistory })));
const TransactionalEmailsManager = React.lazy(() => import('./components/TransactionalEmailsManager').then(m => ({ default: m.TransactionalEmailsManager })));

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

const STEPS = [
  { id: 1, name: 'Select Recipients', icon: Users },
  { id: 2, name: 'Compose', icon: Mail },
  { id: 3, name: 'Review & Send', icon: Send },
];

export function CommunicationModule() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [showTransactional, setShowTransactional] = useState(false);
  const { canDo } = useCurrentUserPermissions();

  const canCompose = canDo('communication', 'create');
  const canSend = canDo('communication', 'send');

  // Central State for the Wizard
  const [draft, setDraft] = useState<CommunicationDraft>({
    step: 1,
    channel: 'email',
    recipientType: 'single',
    selectedRecipients: [],
    subject: '',
    bodyHtml: '',
    attachments: [],
    scheduling: {
      type: 'immediate'
    }
  });

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const updateDraft = (updates: Partial<CommunicationDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    setCurrentStep(1);
    setDraft({
      step: 1,
      channel: 'email',
      recipientType: 'single',
      selectedRecipients: [],
      subject: '',
      bodyHtml: '',
      attachments: [],
      scheduling: {
        type: 'immediate'
      }
    });
  };

  if (showHistory) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <CommunicationHistory onClose={() => setShowHistory(false)} />
      </Suspense>
    );
  }

  if (showTransactional) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <TransactionalEmailsManager onBack={() => setShowTransactional(false)} />
      </Suspense>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Communication Centre</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage client communications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button variant="outline" onClick={() => setShowTransactional(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Transactional Emails
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="w-full bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <div key={step.id} className="contents">
                <div className="flex flex-col items-center relative z-10">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                      isActive 
                        ? 'border-primary bg-primary text-white shadow-md scale-110' 
                        : isCompleted
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted bg-white text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span 
                    className={`text-xs font-medium mt-2 transition-colors duration-200 ${
                      isActive ? 'text-primary' : isCompleted ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-[2px] mx-4 bg-gray-100 relative">
                    <div 
                      className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-in-out"
                      style={{ width: isCompleted ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        {currentStep === 1 && (
          <Step1Recipients 
            draft={draft} 
            updateDraft={updateDraft} 
            onNext={handleNext} 
          />
        )}
        {currentStep === 2 && (
          <Step2Compose 
            draft={draft} 
            updateDraft={updateDraft} 
            onNext={handleNext} 
            onBack={handleBack} 
          />
        )}
        {currentStep === 3 && (
          <Step3Review 
            draft={draft} 
            updateDraft={updateDraft} 
            onBack={handleBack} 
            onReset={handleReset}
            canSend={canSend}
          />
        )}
      </div>
    </div>
  );
}
// End of file — no barrel re-exports (no external consumers)