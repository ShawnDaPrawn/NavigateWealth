/**
 * Estate Planning FNA Wizard
 * Placeholder wizard for Estate Planning Financial Needs Analysis
 */

import React, { useState, useEffect } from 'react';
import { FNAWizardLayout, FNAWizardStepConfig } from '../../fna/FNAWizardLayout';
import { CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { EstatePlanningAPI } from '../api';
import { EstatePlanningCalculationService } from '../utils';
import type { EstatePlanningInputs } from '../types';
import { ESTATE_PLANNING_CONSTANTS } from '../constants';
import { ReviewStep } from './ReviewStep';

interface EstatePlanningFNAWizardProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onFNAComplete: (fnaId: string) => void;
}

export function EstatePlanningFNAWizard({
  open,
  onClose,
  clientId,
  onFNAComplete,
}: EstatePlanningFNAWizardProps) {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [inputs, setInputs] = useState<EstatePlanningInputs | null>(null);

  useEffect(() => {
    if (open) {
      initializeFNA();
    }
  }, [open, clientId]);

  const steps: FNAWizardStepConfig[] = [
    { id: 'review', label: 'Review & Calculate', icon: FileText }
  ];

  const initializeFNA = async () => {
    setLoading(true);
    try {
      // Auto-populate from client data
      const autoPopulatedInputs = await EstatePlanningAPI.autoPopulateInputs(clientId);
      
      // Merge with defaults
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

      const mergedInputs = {
        ...defaultInputs,
        ...autoPopulatedInputs,
      };

      setInputs(mergedInputs);
      toast.success('Estate Planning FNA initialized with client data');
    } catch (error: unknown) {
      // Backend endpoint not available - work in client-side mode
      // Generate default inputs
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
      setInputs(defaultInputs);
      console.log('⚠️ Estate Planning FNA backend not available - working in client-side mode');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!inputs) {
      toast.error('No inputs available');
      return;
    }

    try {
      setCalculating(true);
      
      // Calculate results
      const results = EstatePlanningCalculationService.calculateEstatePlan(inputs);

      // Save as published
      const session = await EstatePlanningAPI.saveSession(
        clientId,
        inputs,
        results,
        'published',
        'Estate Planning FNA completed via wizard'
      );

      toast.success('Estate Planning FNA completed and published');
      onFNAComplete(session.id);
      onClose();
    } catch (error: unknown) {
      console.error('❌ Error calculating Estate Planning FNA:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to calculate Estate Planning FNA');
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
      onBack={() => {}} // No back button on first step
      loading={loading}
      isSaving={calculating}
      isLastStep={true}
      nextLabel="Calculate & Publish"
      nextIcon={CheckCircle}
    >
      <div className="min-h-[400px]">
        <ReviewStep inputs={inputs} />
      </div>
    </FNAWizardLayout>
  );
}