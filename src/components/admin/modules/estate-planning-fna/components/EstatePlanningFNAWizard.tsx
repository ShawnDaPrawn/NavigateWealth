/**
 * Estate Planning FNA Wizard
 * Placeholder wizard for Estate Planning Financial Needs Analysis
 */

import { useState, useEffect, useCallback } from 'react';
import { FNAWizardLayout, FNAWizardStepConfig } from '../../fna/FNAWizardLayout';
import { CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { EstatePlanningAPI } from '../api';
import { EstatePlanningCalculationService } from '../utils';
import type { EstatePlanningInputs } from '../types';
import { ESTATE_PLANNING_CONSTANTS } from '../constants';
import { ReviewStep } from './ReviewStep';
import { useFormPrefill } from '../../form-prefill/useFormPrefill';
import { isFormPrefillEnabled } from '../../../../../utils/formPrefillFeature';
import { logger } from '../../../../../utils/logger';

interface EstatePlanningFNAWizardProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onFNAComplete?: (fnaId: string) => void;
  intakePrefill?: Record<string, unknown>;
}

function buildDefaultInputs(intakePrefill?: Record<string, unknown>): EstatePlanningInputs {
  const defaultInputs: EstatePlanningInputs = {
    familyInfo: {
      fullName: '',
      dateOfBirth: '',
      age: 0,
      maritalStatus: 'single',
      citizenship: 'South Africa',
      taxResidency: 'South Africa',
    },
    dependants: [],
    willInfo: {
      hasValidWill: 'unknown',
      executorNominated: 'unknown',
      guardianNominated: 'unknown',
      specialBequests: [],
      willNeedsUpdate: false,
    },
    assets: [],
    liabilities: [],
    lifePolicies: [],
    assumptions: {
      executorFeePercentage: ESTATE_PLANNING_CONSTANTS.DEFAULT_EXECUTOR_FEE_PERCENTAGE,
      conveyancingFeesPerProperty: ESTATE_PLANNING_CONSTANTS.DEFAULT_CONVEYANCING_FEE_PER_PROPERTY,
      masterFeesEstimate: ESTATE_PLANNING_CONSTANTS.DEFAULT_MASTER_FEES,
      funeralCostsEstimate: ESTATE_PLANNING_CONSTANTS.DEFAULT_FUNERAL_COSTS,
      estateDutyRate: ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_RATE,
      estateDutyAbatement: ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_ABATEMENT,
      spousalBequest: false,
      cgtInclusionRate: ESTATE_PLANNING_CONSTANTS.CGT_INCLUSION_RATE_INDIVIDUAL,
    },
    hasOffshorAssets: false,
    hasTrusts: false,
    planningNotes: '',
  };

  return { ...defaultInputs, ...(intakePrefill ?? {}) } as EstatePlanningInputs;
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function mergePrefillIntoEstateInputs(
  base: EstatePlanningInputs,
  values: Record<string, unknown>,
): EstatePlanningInputs {
  const next = { ...base, familyInfo: { ...base.familyInfo } } as EstatePlanningInputs &
    Record<string, unknown>;
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key.includes('.')) {
      setNestedValue(next as Record<string, unknown>, key, value);
    } else if (key in next) {
      (next as Record<string, unknown>)[key] = value;
    }
  });
  return next as EstatePlanningInputs;
}

export function EstatePlanningFNAWizard({
  open,
  onClose,
  clientId,
  onFNAComplete,
  intakePrefill,
}: EstatePlanningFNAWizardProps) {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [inputs, setInputs] = useState<EstatePlanningInputs | null>(null);
  const prefillEnabled = isFormPrefillEnabled();

  const { PrefillUI, startPrefill } = useFormPrefill({
    clientId: open && prefillEnabled && !intakePrefill ? clientId : undefined,
    formId: 'estate-fna-step1',
    currentValues: (inputs ?? {}) as Record<string, unknown>,
    onApplyValues: (values) => {
      setInputs((prev) => (prev ? mergePrefillIntoEstateInputs(prev, values) : prev));
    },
  });

  const steps: FNAWizardStepConfig[] = [
    { id: 'review', label: 'Review & Calculate', icon: FileText },
  ];

  const initializeFNA = useCallback(async () => {
    setLoading(true);
    try {
      const defaults = buildDefaultInputs(intakePrefill);
      setInputs(defaults);

      if (prefillEnabled && !intakePrefill) {
        void startPrefill();
        return;
      }

      if (intakePrefill) {
        toast.success('Estate Planning FNA initialized with intake data');
        return;
      }

      // Legacy path when prefill disabled
      const autoPopulatedInputs = await EstatePlanningAPI.autoPopulateInputs(clientId);
      setInputs({ ...defaults, ...autoPopulatedInputs });
      toast.success('Estate Planning FNA initialized with client data');
    } catch (_error: unknown) {
      setInputs(buildDefaultInputs(intakePrefill));
      logger.info('Estate Planning FNA backend not available - working in client-side mode');
    } finally {
      setLoading(false);
    }
  }, [clientId, intakePrefill, prefillEnabled, startPrefill]);

  useEffect(() => {
    if (open) {
      void initializeFNA();
    }
  }, [open, clientId, initializeFNA]);

  const handleCalculate = async () => {
    if (!inputs) {
      toast.error('No inputs available');
      return;
    }

    try {
      setCalculating(true);
      const results = EstatePlanningCalculationService.calculateEstatePlan(inputs);
      const session = await EstatePlanningAPI.saveSession(
        clientId,
        inputs,
        results,
        'published',
        'Estate Planning FNA completed via wizard',
      );

      toast.success('Estate Planning FNA completed and published');
      onFNAComplete?.(session.id);
      onClose();
    } catch (error: unknown) {
      console.error('❌ Error calculating Estate Planning FNA:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to calculate Estate Planning FNA',
      );
    } finally {
      setCalculating(false);
    }
  };

  return (
    <FNAWizardLayout
      open={open}
      onClose={() => !calculating && onClose()}
      title="Estate Planning FNA"
      description="Analyze the client's estate planning needs and identify risks"
      steps={steps}
      currentStepIndex={0}
      onNext={handleCalculate}
      onBack={() => {}}
      loading={loading}
      isSaving={calculating}
      isLastStep={true}
      nextLabel="Calculate & Publish"
      nextIcon={CheckCircle}
    >
      <div className="min-h-[400px] space-y-4">
        {prefillEnabled && !intakePrefill && PrefillUI}
        <ReviewStep inputs={inputs} />
      </div>
    </FNAWizardLayout>
  );
}
