/**
 * Investment Needs Analysis (INA) Wizard
 *
 * Runs the shared four-step FNA flow (see fna/wizard/fnaWizardFlow.ts) inside
 * the shared FNAWizardShell, exactly like the other five analyses:
 *
 *   1. Information Gathering    — client keys via the review prefill, the
 *                                 discretionary investments from the client's
 *                                 policy records, and the goals
 *   2. System Auto-Calculation  — goal funding with the standard assumptions
 *   3. Adviser Manual Adjustment — risk profile / assumption overrides + reason
 *   4. Finalise & Publish
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FNAWizardShell, resolveInitialFNAStep, useFNAPublish } from '../../fna';
import type { FNAWizardProps } from '../../fna';
import type {
  InvestmentINAAdviserAdjustments,
  InvestmentINAInputs,
  InvestmentINAResults,
  WizardStep,
} from '../types';
import { DEFAULT_ECONOMIC_ASSUMPTIONS, WIZARD_STEPS } from '../constants';
import { InvestmentINAApiService } from '../api';
import { logger } from '../../../../../utils/logger';
import { Step1InformationGathering } from './Step1InformationGathering';
import { Step2SystemCalculation } from './Step2SystemCalculation';
import { Step3ManualAdjustment } from './Step3ManualAdjustment';
import { Step4Finalise } from './Step4Finalise';

type INAInputs = Partial<InvestmentINAInputs>;

/**
 * The client's discretionary investments are records, not client keys, so the
 * review prefill cannot carry them. They come from the INA auto-populate
 * endpoint; only these list fields are taken from it — every client KEY value
 * reaches the form through the review prefill, as in every other FNA.
 */
const CLIENT_RECORD_FIELDS = [
  'discretionaryInvestments',
  'totalDiscretionaryCapitalCurrent',
  'totalDiscretionaryMonthlyContributions',
] as const satisfies readonly (keyof InvestmentINAInputs)[];

async function loadClientRecords(clientId: string): Promise<INAInputs> {
  try {
    const populated = await InvestmentINAApiService.autoPopulateInputs(clientId);
    const records: INAInputs = {};
    for (const field of CLIENT_RECORD_FIELDS) {
      if (populated?.[field] !== undefined) {
        (records as Record<string, unknown>)[field] = populated[field];
      }
    }
    return records;
  } catch (error) {
    logger.warn('Investment INA: could not load the client’s investment records', { error });
    return {};
  }
}

function buildInitialInputs(intakePrefill?: Record<string, unknown>): INAInputs {
  return {
    householdDependants: 0,
    longTermInflationRate: DEFAULT_ECONOMIC_ASSUMPTIONS.longTermInflationRate,
    expectedRealReturns: { ...DEFAULT_ECONOMIC_ASSUMPTIONS.expectedRealReturns },
    discretionaryInvestments: [],
    totalDiscretionaryCapitalCurrent: 0,
    totalDiscretionaryMonthlyContributions: 0,
    goals: [],
    ...(intakePrefill as INAInputs | undefined),
  };
}

function applyOverrides(
  inputs: INAInputs,
  adjustments?: InvestmentINAAdviserAdjustments,
): InvestmentINAInputs {
  return { ...inputs, ...adjustments?.overrides } as InvestmentINAInputs;
}

function hasOverrides(adjustments?: InvestmentINAAdviserAdjustments): boolean {
  return !!adjustments && Object.keys(adjustments.overrides).length > 0;
}

export function InvestmentINAWizard({
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
  const [inputs, setInputs] = useState<INAInputs>(() => buildInitialInputs(intakePrefill));
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [systemResults, setSystemResults] = useState<InvestmentINAResults | null>(null);
  const [adjustments, setAdjustments] = useState<InvestmentINAAdviserAdjustments>();
  const [finalResults, setFinalResults] = useState<InvestmentINAResults | null>(null);
  // An accepted intake has already been reviewed by the client and adviser.
  const [recordReviewed, setRecordReviewed] = useState(hasIntake);

  const { isPublishing, publish } = useFNAPublish({
    fnaType: 'investment',
    onFNAComplete,
    onClose,
  });

  const calculate = useCallback(
    async (calcInputs: InvestmentINAInputs): Promise<InvestmentINAResults | null> => {
      setCalculating(true);
      try {
        return await InvestmentINAApiService.calculateINA(clientId, calcInputs);
      } catch (error) {
        logger.error('Investment INA calculation failed', error);
        toast.error(
          `Failed to calculate the INA: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        setCalculating(false);
      }
    },
    [clientId],
  );

  // Load the client's investment records once, then open where resolveInitialFNAStep says.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const records = await loadClientRecords(clientId);
      if (cancelled) return;
      // Records first, then the intake on top: the client's own answers win.
      const loaded = { ...buildInitialInputs(), ...records, ...(intakePrefill as INAInputs) };
      setInputs(loaded);

      if (initialStep === 2) {
        // Falls back to Step 1 if the intake cannot be calculated as it stands.
        const results = await calculate(loaded as InvestmentINAInputs);
        if (cancelled) return;
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

  const updateInputs = useCallback((updates: INAInputs) => {
    setInputs((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleStep1Submit = async () => {
    setRecordReviewed(true);
    const results = await calculate(inputs as InvestmentINAInputs);
    if (!results) return;
    setSystemResults(results);
    // New inputs invalidate any earlier adjustment.
    setAdjustments(undefined);
    setFinalResults(null);
    setCurrentStep(2);
  };

  const handleStep3Submit = async (next: InvestmentINAAdviserAdjustments) => {
    if (!systemResults) return;
    const results = hasOverrides(next)
      ? await calculate(applyOverrides(inputs, next))
      : systemResults;
    if (!results) return;
    setAdjustments(next);
    setFinalResults(results);
    setCurrentStep(4);
  };

  const handlePublish = (adviserNotes: string) => {
    if (!finalResults) return;
    const adviserAdjustments: InvestmentINAAdviserAdjustments | undefined = hasOverrides(
      adjustments,
    )
      ? {
          ...adjustments!,
          systemValues: {
            clientRiskProfile: inputs.clientRiskProfile,
            longTermInflationRate: inputs.longTermInflationRate,
            expectedRealReturns: inputs.expectedRealReturns,
          },
        }
      : undefined;

    void publish(async () => {
      const session = await InvestmentINAApiService.saveSession(
        clientId,
        { ...applyOverrides(inputs, adjustments), adviserAdjustments, adviserNotes },
        finalResults,
        'published',
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
            onChange={updateInputs}
            onNext={() => void handleStep1Submit()}
            autoStartPrefill={!recordReviewed}
            isCalculating={calculating}
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
            onNext={(next) => void handleStep3Submit(next)}
            onBack={() => setCurrentStep(2)}
            isCalculating={calculating}
          />
        );
      case 4:
        if (!finalResults) return null;
        return (
          <Step4Finalise
            results={finalResults}
            adjustments={adjustments}
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
      fnaType="investment"
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
