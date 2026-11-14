import React, { useCallback, useState, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { DsSteps, NavTabsList, NavTabsTrigger, PageHeader, useUrlState } from '../../layout/page';
import { CommunicationDraft } from './types';
import { Crumbs } from './components/Crumbs';
import { Step1Recipients } from './components/steps/Step1Recipients';
import { Step2Compose } from './components/steps/Step2Compose';
import { Step3Review } from './components/steps/Step3Review';
// Cross-module dependency: communication → personnel (public hook surface)
// Justified: Communication module requires permission gating for admin actions.
// §3.1 exception documented — shared permission context would be the ideal alternative.
import { useCurrentUserPermissions } from '../personnel';

// Heavy sub-views — lazy-loaded (only rendered on user action)
const CommunicationHistory = React.lazy(() =>
  import('./components/CommunicationHistory').then((m) => ({ default: m.CommunicationHistory })),
);
const TransactionalEmailsManager = React.lazy(() =>
  import('./components/TransactionalEmailsManager').then((m) => ({
    default: m.TransactionalEmailsManager,
  })),
);

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

const STEPS = [
  { id: 1, name: 'Recipients' },
  { id: 2, name: 'Message' },
  { id: 3, name: 'Review & send' },
];

/** Level-1 tabs, kept in the address (?tab=history). */
const COMMUNICATION_TABS = ['compose', 'history', 'transactional'] as const;
type CommunicationTab = (typeof COMMUNICATION_TABS)[number];

const EMPTY_DRAFT: CommunicationDraft = {
  step: 1,
  channel: 'email',
  recipientType: 'single',
  selectedRecipients: [],
  subject: '',
  bodyHtml: '',
  attachments: [],
  scheduling: {
    type: 'immediate',
  },
};

export function CommunicationModule() {
  const [tab, setTab] = useUrlState<CommunicationTab>('tab', 'compose', COMMUNICATION_TABS);
  // The wizard step stays in memory: the draft it belongs to is not in the
  // address, so a reload on "Review & send" would show an empty campaign.
  const [currentStep, setCurrentStep] = useState(1);
  // A tab that shows one of its records as a page of its own (a history
  // message, an email template editor) hides the module header and tabs.
  const [pageOpenIn, setPageOpenIn] = useState<CommunicationTab | null>(null);
  const { canDo } = useCurrentUserPermissions();

  const canSend = canDo('communication', 'send');

  // Central State for the Wizard
  const [draft, setDraft] = useState<CommunicationDraft>(EMPTY_DRAFT);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const updateDraft = (updates: Partial<CommunicationDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    setCurrentStep(1);
    setDraft(EMPTY_DRAFT);
  };

  const handleViewHistory = () => {
    handleReset();
    setTab('history');
  };

  const historyPageChange = useCallback(
    (open: boolean) =>
      setPageOpenIn((current) => (open ? 'history' : current === 'history' ? null : current)),
    [],
  );
  const transactionalPageChange = useCallback(
    (open: boolean) =>
      setPageOpenIn((current) =>
        open ? 'transactional' : current === 'transactional' ? null : current,
      ),
    [],
  );

  const recordPageOpen = pageOpenIn === tab;

  return (
    <div className="ds-page">
      {!recordPageOpen && (
        <PageHeader
          title="Communication"
          description="Create and send client communications, and see everything that went out."
        />
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as CommunicationTab)}
        className="gap-6"
      >
        {!recordPageOpen && (
          <NavTabsList aria-label="Communication">
            <NavTabsTrigger value="compose">Compose</NavTabsTrigger>
            <NavTabsTrigger value="history">History</NavTabsTrigger>
            <NavTabsTrigger value="transactional">Transactional emails</NavTabsTrigger>
          </NavTabsList>
        )}

        <TabsContent value="compose" className="mt-0 space-y-5">
          <Crumbs trail={[{ label: 'Compose' }]} />
          {/* Stepper (CO-Recipients board: .steps) */}
          <DsSteps steps={STEPS.map((step) => step.name)} current={currentStep - 1} />

          {/* Step Content */}
          <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {currentStep === 1 && (
              <Step1Recipients draft={draft} updateDraft={updateDraft} onNext={handleNext} />
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
                onViewHistory={handleViewHistory}
                canSend={canSend}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Suspense fallback={<ViewFallback />}>
            <CommunicationHistory onRecordPageChange={historyPageChange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="transactional" className="mt-0">
          <Suspense fallback={<ViewFallback />}>
            <TransactionalEmailsManager onEditorPageChange={transactionalPageChange} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
// End of file — no barrel re-exports (no external consumers)
