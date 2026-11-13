import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';

import { RoAStepStart } from './roa-steps/RoAStepStart';
import { RoAStepClient } from './roa-steps/RoAStepClient';
import { RoAStepModules } from './roa-steps/RoAStepModules';
import { RoAStepModuleConversation } from './roa-steps/RoAStepModuleConversation';
import { RoAStepReview } from './roa-steps/RoAStepReview';
import { Check, Save } from 'lucide-react';
import { RoADraft, RoAModule, RoAField, RoAEvidenceItem } from '../types';
import type { RoAModuleConversationStatus } from '../types';
import { roaApi } from '../api';
import { adviceEngineKeys } from '../hooks/queryKeys';
import {
  getFallbackRuntimeModules,
  getModuleRuntimeStatus,
  moduleContractToRuntimeModule,
} from '../roaModuleRuntime';
import { useBreadcrumbTrail, useConfirm } from '../../../layout/page';

export type { RoADraft, RoAModule, RoAField, RoAEvidenceItem };

/**
 * Conversation is the default authoring mode; only modules explicitly set to
 * 'form' use the legacy form details flow.
 */
function isConversationModule(module: RoAModule | undefined): boolean {
  return (module?.authoringMode ?? 'conversation') !== 'form';
}

const STEPS = [
  { id: 'start', title: 'Start', description: 'Begin RoA draft' },
  { id: 'client', title: 'Client', description: 'Select or create client' },
  { id: 'modules', title: 'Modules', description: 'Choose advice modules' },
  {
    id: 'details',
    title: 'Module details',
    description: 'Complete each module with the AI assistant',
  },
  { id: 'review', title: 'Review & compile', description: 'Compile and export' },
];

export function DraftRoAInterface() {
  const { confirm: askConfirm, confirmDialog } = useConfirm();
  const [currentStep, setCurrentStep] = useState(0);
  // The top-bar trail follows the wizard: "Draft RoA / Client", "/ Modules"…
  // (Advice Engine sets "Draft RoA" when the tab opens; this component is only
  // mounted on that tab, so it owns the trail from here.)
  useBreadcrumbTrail(
    currentStep === 0
      ? [{ label: 'Draft RoA' }]
      : [
          { label: 'Draft RoA', onClick: () => setCurrentStep(0) },
          { label: STEPS[currentStep].title },
        ],
  );
  const [roaDraft, setRoaDraft] = useState<RoADraft | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [discardingDraftId, setDiscardingDraftId] = useState<string | null>(null);
  // Synchronous re-entry guard so a double-click on "Begin RoA Draft" can't fire
  // two concurrent creates (each POST would spawn a separate empty draft).
  const creatingDraftRef = useRef(false);
  const queryClient = useQueryClient();
  const { data: activeContracts = [] } = useQuery({
    queryKey: adviceEngineKeys.roa.moduleContracts({ status: 'active' }),
    queryFn: () => roaApi.getModuleContracts({ status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: allDrafts = [], isLoading: isLoadingDrafts } = useQuery({
    queryKey: adviceEngineKeys.roa.drafts(),
    queryFn: () => roaApi.listDrafts(),
    staleTime: 30 * 1000,
  });
  const existingDrafts = allDrafts.filter((draft) => !draft.lockedAt);
  const finalisedDrafts = allDrafts.filter((draft) => Boolean(draft.lockedAt));
  const contractModules = activeContracts.map(moduleContractToRuntimeModule);
  const availableModules =
    contractModules.length > 0 ? contractModules : getFallbackRuntimeModules();

  // Track which drafts have already had their conversation started so we only
  // POST /conversation/start once per draft when entering the conversation step.
  const startedConversationFor = useRef<Set<string>>(new Set());

  useEffect(() => {
    const draftId = roaDraft?.id;
    if (currentStep !== 3 || !draftId) return;
    if (startedConversationFor.current.has(draftId)) return;
    // Only relevant when at least one selected module uses conversation mode.
    const hasConversationModule = roaDraft.selectedModules.some((moduleId) =>
      isConversationModule(availableModules.find((module) => module.id === moduleId)),
    );
    if (!hasConversationModule) return;

    startedConversationFor.current.add(draftId);
    roaApi
      .startConversation(draftId)
      .then(({ progress: convProgress }) => {
        const statusMap: Record<string, RoAModuleConversationStatus> = {};
        convProgress.modules.forEach((module) => {
          statusMap[module.moduleId] = module.status;
        });
        updateDraft({ moduleConversationStatus: statusMap });
        queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.draft(draftId) });
      })
      .catch((error) => {
        startedConversationFor.current.delete(draftId);
        console.error('Failed to start RoA conversation:', error);
        toast.error(
          error instanceof Error ? error.message : 'Could not start the module conversation.',
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, roaDraft?.id]);

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      await autoSave();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const autoSave = async (draftToSave = roaDraft) => {
    if (!draftToSave) return;

    setIsAutoSaving(true);
    try {
      const savedDraft = await roaApi.saveDraft(draftToSave.id, draftToSave);
      setRoaDraft(savedDraft);
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.drafts() });
    } catch (error) {
      console.error('Failed to save RoA draft:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save RoA draft — your changes are kept locally.',
      );
      setRoaDraft((prev) =>
        prev
          ? {
              ...prev,
              updatedAt: new Date(),
            }
          : null,
      );
    } finally {
      setIsAutoSaving(false);
    }
  };

  const updateDraft = (updates: Partial<RoADraft>) => {
    setRoaDraft((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const createNewDraft = async () => {
    // Create the draft on the server up front (POST) so it owns a real id. The
    // wizard then updates this record via PUT on every step, and the
    // conversation endpoints (start/chat) require the draft to exist
    // server-side — without this first create, those calls fail with
    // "RoA draft not found".
    if (creatingDraftRef.current) return;
    creatingDraftRef.current = true;
    setIsAutoSaving(true);
    try {
      const created = await roaApi.saveDraft(null, {
        selectedModules: [],
        moduleData: {},
        status: 'draft',
        version: 1,
      });
      setRoaDraft(created);
      setCurrentStep(1); // Move to client step
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.drafts() });
    } catch (error) {
      console.error('Failed to create RoA draft:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not start a new RoA draft. Please try again.',
      );
    } finally {
      creatingDraftRef.current = false;
      setIsAutoSaving(false);
    }
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

  const discardDraft = async (draft: RoADraft) => {
    const label = draft.clientData
      ? `${draft.clientData.firstName} ${draft.clientData.lastName}`.trim()
      : draft.clientSnapshot?.displayName || draft.id;
    const ok = await askConfirm({
      title: `Discard this RoA draft${label ? ` for ${label}` : ''}?`,
      description:
        'Uploaded evidence and generated drafts for this draft will be removed from the file index.',
      confirmLabel: 'Discard draft',
      destructive: true,
    });
    if (!ok) return;

    setDiscardingDraftId(draft.id);
    try {
      await roaApi.deleteDraft(draft.id);
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.drafts() });
      queryClient.removeQueries({ queryKey: adviceEngineKeys.roa.draft(draft.id) });
      toast.success('Draft discarded');
      if (roaDraft?.id === draft.id) {
        setRoaDraft(null);
        setCurrentStep(0);
      }
    } catch (error) {
      console.error('Failed to discard RoA draft:', error);
      toast.error(error instanceof Error ? error.message : 'Could not discard draft');
    } finally {
      setDiscardingDraftId(null);
    }
  };

  const resumeFinalisedDraft = (draft: RoADraft) => {
    setRoaDraft(draft);
    setCurrentStep(4); // Locked finals are reviewed on the compile/export step only
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Start
        return true;
      case 1: // Client
        return roaDraft && (roaDraft.clientId || roaDraft.clientData);
      case 2: // Modules
        return roaDraft && roaDraft.selectedModules.length > 0;
      case 3: // Conversation (form fallback per module)
        return (
          roaDraft &&
          roaDraft.selectedModules.every((moduleId) => {
            const module = availableModules.find((item) => item.id === moduleId);
            if (isConversationModule(module)) {
              // Conversation modules are complete when the backend marks them so.
              return roaDraft.moduleConversationStatus?.[moduleId] === 'complete';
            }
            // Legacy form modules still use the runtime form status.
            const moduleData = roaDraft.moduleData[moduleId];
            if (!module || !moduleData) return false;
            return getModuleRuntimeStatus(
              module,
              moduleData,
              roaDraft.moduleEvidence?.[moduleId] || {},
            ).complete;
          })
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
            onResumeFinal={resumeFinalisedDraft}
            onDiscardDraft={discardDraft}
            discardingDraftId={discardingDraftId}
            existingDrafts={existingDrafts}
            finalisedDrafts={finalisedDrafts}
            isLoadingDrafts={isLoadingDrafts}
            isCreating={isAutoSaving}
          />
        );
      case 1:
        return <RoAStepClient draft={roaDraft} onUpdate={updateDraft} />;
      case 2:
        return (
          <RoAStepModules draft={roaDraft} onUpdate={updateDraft} modules={availableModules} />
        );
      case 3:
        return (
          <RoAStepModuleConversation
            draft={roaDraft}
            onUpdate={updateDraft}
            modules={availableModules}
            onAllComplete={() => {
              if (canProceed()) handleNext();
            }}
          />
        );
      case 4:
        return (
          <RoAStepReview
            draft={roaDraft}
            onUpdate={updateDraft}
            onDraftReplaced={(nextDraft) => {
              setRoaDraft(nextDraft);
              queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.drafts() });
            }}
            modules={availableModules}
          />
        );
      default:
        return null;
    }
  };

  const WIZARD_STEPS = STEPS.slice(1);
  const continueLabel =
    currentStep === 1
      ? 'Continue to modules'
      : currentStep === 3
        ? 'Continue to review'
        : 'Continue';

  if (currentStep === 0) {
    return (
      <div className="space-y-6">
        {renderStepContent()}
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step progress */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol aria-label="Record of Advice steps" className="flex flex-wrap items-center gap-2">
          {WIZARD_STEPS.map((step, offset) => {
            const index = offset + 1;
            const done = index < currentStep;
            const current = index === currentStep;
            return (
              <li key={step.id} className="flex items-center gap-2">
                <span
                  aria-current={current ? 'step' : undefined}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? 'bg-nw-violet text-white'
                      : current
                        ? 'border-2 border-nw-violet text-nw-violet'
                        : 'bg-gray-100 text-nw-text-3'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index}
                </span>
                <span
                  className={`text-sm ${current ? 'font-semibold text-nw-ink' : 'text-nw-text-2'}`}
                >
                  {step.title}
                </span>
                {offset < WIZARD_STEPS.length - 1 && (
                  <span aria-hidden="true" className="mx-1 h-px w-6 bg-nw-line" />
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex items-center gap-2">
          {isAutoSaving && (
            <Badge variant="outline" className="border-blue-200 text-blue-600">
              <Save className="mr-1 h-3 w-3" aria-hidden="true" />
              Saving...
            </Badge>
          )}
          {roaDraft && <Badge variant="secondary">Draft v{roaDraft.version}</Badge>}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-nw-line bg-white p-6">{renderStepContent()}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handlePrevious}>
          Back
        </Button>
        {currentStep < STEPS.length - 1 && (
          <Button onClick={handleNext} disabled={!canProceed()}>
            {continueLabel}
          </Button>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
