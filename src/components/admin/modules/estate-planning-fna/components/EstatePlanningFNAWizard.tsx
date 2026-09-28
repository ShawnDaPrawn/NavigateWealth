/**
 * Estate Planning FNA Wizard
 *
 * Runs the shared four-step FNA flow (see fna/wizard/fnaWizardFlow.ts) inside
 * the shared FNAWizardShell, exactly like the other five analyses:
 *
 *   1. Information Gathering    — client keys via the review prefill, and the
 *                                 client's assets, liabilities, policies and
 *                                 dependants from their records
 *   2. System Auto-Calculation  — death balance sheet and liquidity
 *   3. Adviser Manual Adjustment — cost-assumption overrides + reason
 *   4. Finalise & Publish
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FNAWizardShell, resolveInitialFNAStep, useFNAPublish } from '../../fna';
import type { FNAWizardProps } from '../../fna';
import { EstatePlanningAPI } from '../api';
import { EstatePlanningCalculationService } from '../utils';
import type {
  EstatePlanningAdviserAdjustments,
  EstatePlanningInputs,
  EstatePlanningResults,
  WizardStep,
} from '../types';
import { WIZARD_STEPS } from '../constants';
import { logger } from '../../../../../utils/logger';
import { Step1InformationGathering } from './Step1InformationGathering';
import { Step2SystemCalculation } from './Step2SystemCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';
import { buildDefaultEstateInputs, mergeEstateInputs } from './estateWizardInputs';

/**
 * Records, not client keys: the review prefill cannot carry lists, so these
 * come from the estate auto-populate endpoint. Every client KEY value reaches
 * the form through the review prefill, as in every other FNA.
 */
const CLIENT_RECORD_FIELDS = [
  'assets',
  'liabilities',
  'lifePolicies',
  'dependants',
] as const satisfies readonly (keyof EstatePlanningInputs)[];

async function loadClientRecords(clientId: string): Promise<Record<string, unknown>> {
  try {
    const populated = await EstatePlanningAPI.autoPopulateInputs(clientId);
    const records: Record<string, unknown> = {};
    for (const field of CLIENT_RECORD_FIELDS) {
      if (Array.isArray(populated?.[field])) records[field] = populated[field];
    }
    return records;
  } catch (error) {
    logger.warn('Estate Planning FNA: could not load the client’s estate records', { error });
    return {};
  }
}

function applyOverrides(
  inputs: EstatePlanningInputs,
  adjustments?: EstatePlanningAdviserAdjustments,
): EstatePlanningInputs {
  return { ...inputs, assumptions: { ...inputs.assumptions, ...adjustments?.overrides } };
}

function calculate(inputs: EstatePlanningInputs): EstatePlanningResults | null {
  try {
    return EstatePlanningCalculationService.calculateEstatePlan(inputs);
  } catch (error) {
    logger.error('Estate Planning calculation failed', error);
    toast.error('Failed to calculate the estate plan. Check the client information.');
    return null;
  }
}

export function EstatePlanningFNAWizard({
  clientId,
  clientName,
  open,
  onClose,
  onFNAComplete,
  startAtStep,
  intakePrefill,
}: FNAWizardProps) {
  const hasIntake = !!intakePrefill && Object.keys(intakePrefill).length > 0;
  const [initialStep] = useState(() => resolveInitialFNAStep(startAtStep, intakePrefill));

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [inputs, setInputs] = useState<EstatePlanningInputs>(() =>
    mergeEstateInputs(buildDefaultEstateInputs(), intakePrefill),
  );
  const [loading, setLoading] = useState(true);
  const [systemResults, setSystemResults] = useState<EstatePlanningResults | null>(null);
  const [adjustments, setAdjustments] = useState<EstatePlanningAdviserAdjustments>();
  const [finalResults, setFinalResults] = useState<EstatePlanningResults | null>(null);
  const [recordReviewed, setRecordReviewed] = useState(hasIntake);

  const { isPublishing, publish } = useFNAPublish({ fnaType: 'estate', onFNAComplete, onClose });

  // Load the client's estate records once, then open where resolveInitialFNAStep says.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const records = await loadClientRecords(clientId);
      if (cancelled) return;
      // Records first, then the intake on top: the client's own answers win.
      const loaded = mergeEstateInputs(
        mergeEstateInputs(buildDefaultEstateInputs(), records),
        intakePrefill,
      );
      setInputs(loaded);

      if (initialStep === 2) {
        // Falls back to Step 1 if the intake cannot be calculated as it stands.
        const results = calculate(loaded);
        if (results) {
          setSystemResults(results);
          setCurrentStep(2);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per wizard session; the wizard is mounted fresh each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStep1Submit = () => {
    setRecordReviewed(true);
    const results = calculate(inputs);
    if (!results) return;
    setSystemResults(results);
    // New inputs invalidate any earlier adjustment.
    setAdjustments(undefined);
    setFinalResults(null);
    setCurrentStep(2);
  };

  const handleStep3Submit = (next: EstatePlanningAdviserAdjustments) => {
    if (!systemResults) return;
    const overridden = Object.keys(next.overrides).length > 0;
    const results = overridden ? calculate(applyOverrides(inputs, next)) : systemResults;
    if (!results) return;
    setAdjustments(next);
    setFinalResults(results);
    setCurrentStep(4);
  };

  const handlePublish = (adviserNotes: string) => {
    if (!finalResults) return;
    const overridden = !!adjustments && Object.keys(adjustments.overrides).length > 0;
    const adviserAdjustments: EstatePlanningAdviserAdjustments | undefined = overridden
      ? {
          ...adjustments!,
          systemValues: {
            executorFeePercentage: inputs.assumptions.executorFeePercentage,
            conveyancingFeesPerProperty: inputs.assumptions.conveyancingFeesPerProperty,
            masterFeesEstimate: inputs.assumptions.masterFeesEstimate,
            funeralCostsEstimate: inputs.assumptions.funeralCostsEstimate,
            spousalBequest: inputs.assumptions.spousalBequest,
          },
        }
      : undefined;

    void publish(async () => {
      const session = await EstatePlanningAPI.saveSession(
        clientId,
        { ...applyOverrides(inputs, adjustments), adviserAdjustments, planningNotes: adviserNotes },
        finalResults,
        'published',
        adviserNotes,
      );
      return session.id;
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1InformationGathering
            clientId={clientId}
            inputs={inputs}
            onChange={setInputs}
            onNext={handleStep1Submit}
            autoStartPrefill={!recordReviewed}
          />
        );
      case 2:
        if (!systemResults) return null;
        return (
          <Step2SystemCalculation
            results={systemResults}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        );
      case 3:
        return (
          <Step3ManualAdjustment
            inputs={inputs}
            initialAdjustments={adjustments}
            onNext={handleStep3Submit}
            onBack={() => setCurrentStep(2)}
          />
        );
      case 4:
        if (!finalResults) return null;
        return (
          <Step4Finalise
            results={finalResults}
            adjustments={adjustments}
            initialNotes={inputs.planningNotes}
            onPublish={handlePublish}
            onBack={() => setCurrentStep(3)}
            isPublishing={isPublishing}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FNAWizardShell
      open={open}
      onClose={onClose}
      fnaType="estate"
      clientName={clientName}
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      loading={loading}
      isPublishing={isPublishing}
    >
      {renderStep()}
    </FNAWizardShell>
  );
}
