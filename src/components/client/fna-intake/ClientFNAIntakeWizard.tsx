/**
 * ClientFNAIntakeWizard — client-led Step 1 intake per FNA domain
 */

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { BrandSectionLoader } from '../../ui/brand-loader';
import { Button } from '../../ui/button';
import { FNAIntakeConsentDialog } from './FNAIntakeConsentDialog';
import { InvestmentIntakeStep1 } from './InvestmentIntakeStep1';
import { EstateIntakeStep1 } from './EstateIntakeStep1';
import { IntakeReadOnlyReview } from './IntakeReadOnlyReview';
import { RetirementIllustrativeProjection } from './RetirementIllustrativeProjection';
import {
  getIntakeDraft,
  saveIntakeDraft,
  submitIntakeSession,
  type FnaIntakeDomain,
  type FnaIntakeSession,
} from '../../../services/fna-intake-api';
import { fnaKeys } from '../../../utils/queryKeys';
import type {
  RetirementFNAInputs,
  RetirementFNAAdjustments,
} from '../../admin/modules/retirement-fna/types';
import type { MedicalFNAInputs } from '../../admin/modules/medical-fna/types';
import type { InformationGatheringInput } from '../../admin/modules/risk-planning-fna/types';
import type { TaxPlanningInputs } from '../../admin/modules/tax-planning-fna/types';

const LazyRetirementStep1 = React.lazy(() =>
  import('../../admin/modules/retirement-fna/components/Step1InputForm').then((m) => ({
    default: m.Step1InputForm,
  })),
);

const LazyMedicalStep1 = React.lazy(() =>
  import('../../admin/modules/medical-fna/components/Step1InputForm').then((m) => ({
    default: m.Step1InputForm,
  })),
);

const LazyRiskStep1 = React.lazy(() =>
  import('../../admin/modules/risk-planning-fna/components/Step1InformationGathering').then(
    (m) => ({
      default: m.Step1InformationGathering,
    }),
  ),
);

const LazyTaxStep1 = React.lazy(() =>
  import('../../admin/modules/tax-planning-fna/components/Step1InputForm').then((m) => ({
    default: m.Step1InputForm,
  })),
);

interface ClientFNAIntakeWizardProps {
  clientId: string;
  domain: FnaIntakeDomain;
  readOnly?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function ClientFNAIntakeWizard({
  clientId,
  domain,
  readOnly: readOnlyProp = false,
  onComplete,
  onCancel,
}: ClientFNAIntakeWizardProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [session, setSession] = useState<FnaIntakeSession | null>(null);
  const [pendingInputs, setPendingInputs] = useState<Record<string, unknown>>({});
  const [showConsent, setShowConsent] = useState(false);
  const [showProjection, setShowProjection] = useState(false);

  const isReadOnly = readOnlyProp || session?.status === 'submitted';
  const hasSavedInputs = Object.keys(pendingInputs).length > 0;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const draft = await getIntakeDraft(clientId, domain);
        if (!cancelled) {
          setSession(draft);
          setPendingInputs(draft?.inputs ?? {});
        }
      } catch {
        if (!cancelled) toast.error('Could not load your saved progress');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, domain]);

  const invalidateStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: fnaKeys.batchStatus(clientId) });
  }, [clientId, queryClient]);

  const persistDraft = useCallback(
    async (inputs: Record<string, unknown>) => {
      if (isReadOnly) return null;
      setIsSaving(true);
      try {
        const saved = await saveIntakeDraft(clientId, domain, inputs);
        setSession(saved);
        setPendingInputs(inputs);
        invalidateStatus();
        toast.success('Progress saved');
        return saved;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save progress');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, domain, invalidateStatus, isReadOnly],
  );

  const handleContinue = useCallback(
    async (inputs: Record<string, unknown>) => {
      if (isReadOnly) return;
      const saved = await persistDraft(inputs);
      if (saved) {
        setPendingInputs(inputs);
        if (domain === 'retirement') {
          setShowProjection(true);
        }
        setShowConsent(true);
      }
    },
    [persistDraft, domain, isReadOnly],
  );

  const handleSubmit = useCallback(async () => {
    if (isReadOnly) return;
    let activeSession = session;
    if (!activeSession?.id) {
      const saved = await persistDraft(pendingInputs);
      if (!saved) return;
      activeSession = saved;
      setSession(saved);
    }

    const sessionId = activeSession.id;
    if (!sessionId) {
      toast.error('Save your progress before submitting');
      return;
    }

    setIsSaving(true);
    try {
      await submitIntakeSession(sessionId);
      invalidateStatus();
      setShowConsent(false);
      toast.success('Submitted to your adviser for review');
      onComplete?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit');
    } finally {
      setIsSaving(false);
    }
  }, [session, pendingInputs, persistDraft, invalidateStatus, onComplete, isReadOnly]);

  if (loading) {
    return (
      <BrandSectionLoader
        title="Loading your discovery form"
        message="Preparing your financial discovery intake."
      />
    );
  }

  const retirementInitial = pendingInputs as Partial<RetirementFNAInputs>;
  const medicalInitial = pendingInputs as Partial<MedicalFNAInputs>;
  const riskInitial = pendingInputs as Partial<InformationGatheringInput>;
  const taxInitial = pendingInputs as Partial<TaxPlanningInputs>;

  return (
    <div className="space-y-4">
      {onCancel && !isReadOnly && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Your progress is saved as you go. You can leave and return anytime to finish.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="shrink-0">
            Continue later
          </Button>
        </div>
      )}

      {session?.requestInfoAt && !isReadOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your adviser needs more information. Please update your answers and submit again.
        </div>
      )}

      {isReadOnly && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {readOnlyProp || session?.status === 'submitted'
            ? 'Your submitted answers are shown below. You cannot edit until your adviser requests more information.'
            : 'Already submitted — your adviser is reviewing this intake.'}
        </div>
      )}

      {isReadOnly ? (
        <IntakeReadOnlyReview domain={domain} inputs={pendingInputs} />
      ) : (
        <>
          {domain === 'retirement' && showProjection && (
            <RetirementIllustrativeProjection inputs={retirementInitial} />
          )}

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading form…
              </div>
            }
          >
            {domain === 'retirement' && (
              <LazyRetirementStep1
                clientId={clientId}
                initialData={hasSavedInputs ? retirementInitial : {}}
                intakeMode
                hideAssumptionsTab
                submitLabel="Continue to submit"
                onSaveDraft={(data, assumptions) => void persistDraft({ ...data, ...assumptions })}
                onNext={(data: RetirementFNAInputs, assumptions: RetirementFNAAdjustments) =>
                  void handleContinue({ ...data, assumptions })
                }
              />
            )}

            {domain === 'medical' && (
              <LazyMedicalStep1
                clientId={clientId}
                initialData={hasSavedInputs ? medicalInitial : undefined}
                intakeMode
                submitLabel="Continue to submit"
                onSaveDraft={(data: MedicalFNAInputs) =>
                  void persistDraft(data as unknown as Record<string, unknown>)
                }
                onNext={(data: MedicalFNAInputs) =>
                  void handleContinue(data as unknown as Record<string, unknown>)
                }
              />
            )}

            {domain === 'risk' && (
              <LazyRiskStep1
                clientId={clientId}
                initialData={hasSavedInputs ? riskInitial : undefined}
                intakeMode
                submitLabel="Continue to submit"
                onSaveDraft={(data: InformationGatheringInput) =>
                  void persistDraft(data as unknown as Record<string, unknown>)
                }
                onNext={(data: InformationGatheringInput) =>
                  void handleContinue(data as unknown as Record<string, unknown>)
                }
              />
            )}

            {domain === 'tax' && (
              <LazyTaxStep1
                clientId={clientId}
                initialData={hasSavedInputs ? taxInitial : {}}
                intakeMode
                submitLabel="Continue to submit"
                onSaveDraft={(data: TaxPlanningInputs) =>
                  void persistDraft(data as unknown as Record<string, unknown>)
                }
                onNext={(data: TaxPlanningInputs) =>
                  void handleContinue(data as unknown as Record<string, unknown>)
                }
              />
            )}

            {domain === 'investment' && (
              <InvestmentIntakeStep1
                initialInputs={pendingInputs}
                isSaving={isSaving}
                readOnly={false}
                onSaveDraft={(inputs) => void persistDraft(inputs)}
                onContinue={(inputs) => void handleContinue(inputs)}
              />
            )}

            {domain === 'estate' && (
              <EstateIntakeStep1
                initialInputs={pendingInputs}
                isSaving={isSaving}
                readOnly={false}
                onSaveDraft={(inputs) => void persistDraft(inputs)}
                onContinue={(inputs) => void handleContinue(inputs)}
              />
            )}
          </Suspense>
        </>
      )}

      <FNAIntakeConsentDialog
        open={showConsent && !isReadOnly}
        onOpenChange={setShowConsent}
        onConfirm={() => void handleSubmit()}
        isSubmitting={isSaving}
      />
    </div>
  );
}
