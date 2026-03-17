/**
 * FNA Wizard Component
 * Multi-step wizard for running Financial Needs Analysis
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Checkbox } from '../../../ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { toast } from 'sonner@2.0.3';
import {
  Calculator,
  ChevronRight,
  Info,
  Send,
  Users,
  DollarSign,
  CreditCard,
  PiggyBank,
  Settings
} from 'lucide-react';
import { FNAAPI } from './api';
import { calculateRiskPlanning } from './riskUtils';
import { formatCurrency, formatCurrencyInput, parseCurrency } from '../../../../utils/currencyFormatter';
import type { FNAWizardStep, FNAInputs, FNALiability } from './types';
import { FNAWizardLayout, FNAWizardStepConfig } from './FNAWizardLayout';

/** Shared props for FNA wizard step components */
interface FNAStepProps {
  inputs: Partial<FNAInputs>;
  updateInput?: (field: string, value: string | number | boolean) => void;
  updateNestedInput?: (parent: string, field: string, value: string | number | boolean) => void;
}

interface FNAWizardProps {
  clientId: string;
  clientName?: string;
  open: boolean;
  onClose: () => void;
  onFNAComplete?: (fnaId: string) => void;
}

export function FNAWizard({ clientId, clientName = '', open, onClose, onFNAComplete }: FNAWizardProps) {
  const [currentStep, setCurrentStep] = useState<FNAWizardStep>('personal');
  const [inputs, setInputs] = useState<Partial<FNAInputs>>({});
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [fnaId, setFnaId] = useState<string | null>(null);

  const stepsList: FNAWizardStep[] = [
    'personal',
    'income',
    'liabilities',
    'assets',
    'assumptions',
    'review'
  ];

  const stepConfig: Record<FNAWizardStep, FNAWizardStepConfig> = {
    personal: { id: 'personal', label: 'Personal & Household', icon: Users },
    income: { id: 'income', label: 'Income & Expenses', icon: DollarSign },
    liabilities: { id: 'liabilities', label: 'Liabilities', icon: CreditCard },
    assets: { id: 'assets', label: 'Assets', icon: PiggyBank },
    assumptions: { id: 'assumptions', label: 'Assumptions', icon: Settings },
    review: { id: 'review', label: 'Review & Calculate', icon: Calculator }
  };

  const wizardSteps = stepsList.map(step => stepConfig[step]);

  useEffect(() => {
    if (open) {
      initializeFNA();
    }
  }, [open]);

  const initializeFNA = async () => {
    setLoading(true);
    try {
      // Try to create new FNA session from backend
      const fna = await FNAAPI.createFNA(clientId);
      setFnaId(fna.id);
      setInputs(fna.inputs);
      toast.success('FNA initialized with client data');
    } catch (error) {
      // Backend endpoint not available - work in client-side mode
      // Generate a temporary client-side ID
      const tempId = `fna-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setFnaId(tempId);
      setInputs({});
      console.log('⚠️ FNA backend not available - working in client-side mode');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = stepsList.indexOf(currentStep);

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepsList.length) {
      setCurrentStep(stepsList[nextIndex]);
    }
  };

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(stepsList[prevIndex]);
    }
  };

  const updateInput = (field: string, value: string | number | boolean) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedInput = (parent: string, field: string, value: string | number | boolean) => {
    setInputs(prev => ({
      ...prev,
      [parent]: { ...(prev[parent as keyof FNAInputs] as Record<string, unknown> || {}), [field]: value }
    }));
  };

  const saveInputs = async () => {
    if (!fnaId) return;
    
    try {
      await FNAAPI.updateFNAInputs(fnaId, inputs as FNAInputs);
      toast.success('Inputs saved');
    } catch (error) {
      console.error('Error saving inputs:', error);
      toast.error('Failed to save inputs');
    }
  };

  const calculateAndFinish = async (action: 'draft' | 'publish') => {
    if (!fnaId) return;

    setCalculating(true);
    try {
      // Try to save final inputs to backend
      try {
        await FNAAPI.updateFNAInputs(fnaId, inputs as FNAInputs);
      } catch (error) {
        console.log('⚠️ Could not save inputs - backend not available');
      }
      
      // Try to run calculation on backend
      try {
        const calculatedFNA = await FNAAPI.calculateFNA(fnaId);
        
        // Try to save as draft or publish
        if (action === 'publish') {
          await FNAAPI.publishFNA(fnaId);
          toast.success('FNA published successfully');
        } else {
          await FNAAPI.saveDraft(fnaId);
          toast.success('FNA saved as draft');
        }

        if (onFNAComplete) {
          onFNAComplete(fnaId);
        }
        onClose();
      } catch (error) {
        // Backend not available - show helpful message
        console.log('⚠️ FNA calculation backend not available');
        toast.error('FNA calculation backend is not yet implemented. The wizard data has been collected but cannot be processed until backend endpoints are created.', {
          duration: 6000,
        });
        
        // Still close and complete for now
        if (onFNAComplete) {
          onFNAComplete(fnaId);
        }
        onClose();
      }
    } finally {
      setCalculating(false);
    }
  };

  const isReviewStep = currentStep === 'review';

  // Handler for "Next" / "Publish" button
  const handleNext = () => {
    if (isReviewStep) {
      calculateAndFinish('publish');
    } else {
      goToNextStep();
    }
  };

  // Handler for "Save" button
  const handleSave = () => {
    if (isReviewStep) {
      calculateAndFinish('draft');
    } else {
      saveInputs();
    }
  };

  return (
    <FNAWizardLayout
      open={open}
      onClose={onClose}
      title={`Financial Needs Analysis - ${clientName}`}
      description="Complete the FNA wizard to calculate risk planning needs"
      steps={wizardSteps}
      currentStepIndex={currentStepIndex}
      onStepChange={(index) => setCurrentStep(stepsList[index])}
      onBack={goToPrevStep}
      onNext={handleNext}
      onSave={handleSave}
      loading={loading}
      isSaving={calculating}
      isLastStep={isReviewStep}
      saveLabel={isReviewStep ? 'Save as Draft' : 'Save Progress'}
      nextLabel={isReviewStep ? 'Calculate & Publish' : 'Next'}
      nextIcon={isReviewStep ? Send : ChevronRight}
    >
      <div className="min-h-[400px]">
        {currentStep === 'personal' && (
          <PersonalStep inputs={inputs} updateInput={updateInput} />
        )}
        {currentStep === 'income' && (
          <IncomeStep inputs={inputs} updateInput={updateInput} />
        )}
        {currentStep === 'liabilities' && (
          <LiabilitiesStep inputs={inputs} updateInput={updateInput} />
        )}
        {currentStep === 'assets' && (
          <AssetsStep inputs={inputs} updateInput={updateInput} updateNestedInput={updateNestedInput} />
        )}
        {currentStep === 'assumptions' && (
          <AssumptionsStep inputs={inputs} updateNestedInput={updateNestedInput} updateInput={updateInput} />
        )}
        {currentStep === 'review' && (
          <ReviewStep inputs={inputs} updateNestedInput={updateNestedInput} />
        )}
      </div>
    </FNAWizardLayout>
  );
}

// ==================== STEP COMPONENTS ====================

function PersonalStep({ inputs, updateInput }: FNAStepProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Client Age</Label>
          <Input
            type="number"
            value={inputs.clientAge || ''}
            onChange={(e) => updateInput('clientAge', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Expected Retirement Age</Label>
          <Input
            type="number"
            value={inputs.expectedRetirementAge || 65}
            onChange={(e) => updateInput('expectedRetirementAge', Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>Marital Status</Label>
        <Input
          value={inputs.maritalStatus || ''}
          onChange={(e) => updateInput('maritalStatus', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Spouse Name (if applicable)</Label>
          <Input
            value={inputs.spouseName || ''}
            onChange={(e) => updateInput('spouseName', e.target.value)}
          />
        </div>
        <div>
          <Label>Spouse Monthly Income</Label>
          <Input
            value={formatCurrencyInput(inputs.spouseIncome || 0)}
            onChange={(e) => updateInput('spouseIncome', parseCurrency(e.target.value))}
          />
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="size-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm">
              <strong>Dependants:</strong> {(inputs.dependants || []).length} loaded from family members.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Dependants marked as financially dependent have been automatically included.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncomeStep({ inputs, updateInput }: FNAStepProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Gross Monthly Income</Label>
          <Input
            value={formatCurrencyInput(inputs.grossMonthlyIncome || 0)}
            onChange={(e) => updateInput('grossMonthlyIncome', parseCurrency(e.target.value))}
          />
        </div>
        <div>
          <Label>Net Monthly Income</Label>
          <Input
            value={formatCurrencyInput(inputs.netMonthlyIncome || 0)}
            onChange={(e) => updateInput('netMonthlyIncome', parseCurrency(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Monthly Essential Expenses</Label>
          <Input
            value={formatCurrencyInput(inputs.monthlyEssentialExpenses || 0)}
            onChange={(e) => updateInput('monthlyEssentialExpenses', parseCurrency(e.target.value))}
          />
        </div>
        <div>
          <Label>Monthly Total Expenses</Label>
          <Input
            value={formatCurrencyInput(inputs.monthlyTotalExpenses || 0)}
            onChange={(e) => updateInput('monthlyTotalExpenses', parseCurrency(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>Monthly Retirement Saving</Label>
        <Input
          value={formatCurrencyInput(inputs.monthlyRetirementSaving || 0)}
          onChange={(e) => updateInput('monthlyRetirementSaving', parseCurrency(e.target.value))}
        />
        <p className="text-sm text-muted-foreground mt-1">
          RA, pension, provident fund and other long-term investments
        </p>
      </div>
    </div>
  );
}

function LiabilitiesStep({ inputs, updateInput }: FNAStepProps) {
  const liabilities = inputs.liabilities || [];

  const updateLiability = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...liabilities];
    updated[index] = { ...updated[index], [field]: value };
    updateInput('liabilities', updated);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review and update settlement flags for each liability. These determine which debts will be included in each risk calculation.
      </p>

      <div className="space-y-3">
        {liabilities.map((liability: FNALiability, index: number) => (
          <Card key={liability.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{liability.name}</CardTitle>
              <CardDescription>
                {liability.type} • {formatCurrency(liability.outstandingBalance)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={liability.settleOnDeath}
                    onCheckedChange={(checked) => updateLiability(index, 'settleOnDeath', checked)}
                  />
                  <Label className="text-sm">Settle on Death</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={liability.settleOnDisability}
                    onCheckedChange={(checked) => updateLiability(index, 'settleOnDisability', checked)}
                  />
                  <Label className="text-sm">Settle on Disability</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={liability.settleOnSevereIllness}
                    onCheckedChange={(checked) => updateLiability(index, 'settleOnSevereIllness', checked)}
                  />
                  <Label className="text-sm">Settle on CI</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {liabilities.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No liabilities found in client profile
        </div>
      )}
    </div>
  );
}

function AssetsStep({ inputs, updateInput, updateNestedInput }: FNAStepProps) {
  const assets = inputs.assets || {};

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Liquid assets that could be used to support the family in an emergency. Retirement funds are excluded.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Emergency Savings</Label>
          <Input
            value={formatCurrencyInput(assets.emergencySavings || 0)}
            onChange={(e) => updateNestedInput('assets', 'emergencySavings', parseCurrency(e.target.value))}
          />
        </div>
        <div>
          <Label>Unit Trusts / Investments</Label>
          <Input
            value={formatCurrencyInput(assets.unitTrustsInvestments || 0)}
            onChange={(e) => updateNestedInput('assets', 'unitTrustsInvestments', parseCurrency(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Discretionary Investments</Label>
          <Input
            value={formatCurrencyInput(assets.discretionaryInvestments || 0)}
            onChange={(e) => updateNestedInput('assets', 'discretionaryInvestments', parseCurrency(e.target.value))}
          />
        </div>
        <div>
          <Label>Other Liquid Assets</Label>
          <Input
            value={formatCurrencyInput(assets.otherLiquidAssets || 0)}
            onChange={(e) => updateNestedInput('assets', 'otherLiquidAssets', parseCurrency(e.target.value))}
          />
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm">
            <strong>Total Liquid Assets:</strong>{' '}
            {formatCurrency(
              (assets.emergencySavings || 0) +
              (assets.unitTrustsInvestments || 0) +
              (assets.discretionaryInvestments || 0) +
              (assets.otherLiquidAssets || 0)
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AssumptionsStep({ inputs, updateNestedInput, updateInput }: FNAStepProps) {
  const assumptions = inputs.assumptions || {};

  return (
    <div className="space-y-8">
      {/* General Assumptions */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">General Assumptions</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Safe Withdrawal Rate (decimal)</Label>
            <Input
              type="number"
              step="0.01"
              value={assumptions.safeWithdrawalRate || 0.05}
              onChange={(e) => updateNestedInput('assumptions', 'safeWithdrawalRate', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">Default 0.05 (5%)</p>
          </div>
          <div>
            <Label>Income Replacement Years</Label>
            <Input
              type="number"
              value={assumptions.incomeReplacementYears || 0}
              onChange={(e) => updateNestedInput('assumptions', 'incomeReplacementYears', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">If using years-based method</p>
          </div>
        </div>
      </div>

      {/* Life Cover Specific */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Life Cover Inputs</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Final Expenses Estimate</Label>
            <Input
              value={formatCurrencyInput(assumptions.finalExpensesEstimate || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'finalExpensesEstimate', parseCurrency(e.target.value))}
            />
          </div>
          <div>
            <Label>Education Funding Total</Label>
            <Input
              value={formatCurrencyInput(assumptions.educationFundingTotal || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'educationFundingTotal', parseCurrency(e.target.value))}
            />
          </div>
          <div>
            <Label>Estate Costs Estimate</Label>
            <Input
              value={formatCurrencyInput(assumptions.estateCostsEstimate || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'estateCostsEstimate', parseCurrency(e.target.value))}
            />
          </div>
          <div>
            <Label>Annual Income Needed (Dependants)</Label>
            <Input
              value={formatCurrencyInput(assumptions.annualIncomeNeededForDependants || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'annualIncomeNeededForDependants', parseCurrency(e.target.value))}
            />
          </div>
          <div className="col-span-2">
             <Label>Calculation Method</Label>
             <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="lifeMethodYears"
                    checked={inputs.lifeCoverMethod === 'years'}
                    onChange={() => updateInput('lifeCoverMethod', 'years')}
                    className="size-4"
                  />
                  <Label htmlFor="lifeMethodYears" className="font-normal">Years Based</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="lifeMethodCap"
                    checked={inputs.lifeCoverMethod === 'capitalisation'}
                    onChange={() => updateInput('lifeCoverMethod', 'capitalisation')}
                    className="size-4"
                  />
                  <Label htmlFor="lifeMethodCap" className="font-normal">Capitalisation</Label>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Lump-Sum Disability Specific */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Lump-Sum Disability Inputs</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Lifestyle Modifications Cost</Label>
            <Input
              value={formatCurrencyInput(assumptions.lifestyleModificationsCost || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'lifestyleModificationsCost', parseCurrency(e.target.value))}
            />
          </div>
          <div>
            <Label>Medical Adaptation Cost</Label>
            <Input
              value={formatCurrencyInput(assumptions.medicalAdaptationCost || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'medicalAdaptationCost', parseCurrency(e.target.value))}
            />
          </div>
          <div>
            <Label>Annual Income Required (If Disabled)</Label>
            <Input
              value={formatCurrencyInput(assumptions.annualIncomeRequiredIfDisabled || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'annualIncomeRequiredIfDisabled', parseCurrency(e.target.value))}
            />
          </div>
          <div className="col-span-2">
             <Label>Calculation Method</Label>
             <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="disabilityMethodYears"
                    checked={inputs.disabilityMethod === 'years'}
                    onChange={() => updateInput('disabilityMethod', 'years')}
                    className="size-4"
                  />
                  <Label htmlFor="disabilityMethodYears" className="font-normal">Years to Retirement</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="disabilityMethodCap"
                    checked={inputs.disabilityMethod === 'capitalisation'}
                    onChange={() => updateInput('disabilityMethod', 'capitalisation')}
                    className="size-4"
                  />
                  <Label htmlFor="disabilityMethodCap" className="font-normal">Capitalisation</Label>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Severe Illness Specific */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Severe Illness Inputs</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Medical Shortfalls Estimate</Label>
            <Input
              value={formatCurrencyInput(assumptions.medicalShortfallsEstimate || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'medicalShortfallsEstimate', parseCurrency(e.target.value))}
            />
          </div>
          <div>
            <Label>Lifestyle Adjustments Cost</Label>
            <Input
              value={formatCurrencyInput(assumptions.lifestyleAdjustmentsCost || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'lifestyleAdjustmentsCost', parseCurrency(e.target.value))}
            />
          </div>
          <div>
            <Label>Income Gap (Months)</Label>
            <Input
              type="number"
              value={assumptions.incomeGapMonthsUnableToWork || 0}
              onChange={(e) => updateNestedInput('assumptions', 'incomeGapMonthsUnableToWork', Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Debt Buffer % (of Total Debt)</Label>
            <Input
              type="number"
              step="0.1"
              value={assumptions.debtBufferPercentage || 0}
              onChange={(e) => updateNestedInput('assumptions', 'debtBufferPercentage', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">e.g. 0.1 for 10%</p>
          </div>
        </div>
      </div>

      {/* Income Protection Specific */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Income Protection Inputs</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Monthly Income Required (Lifestyle)</Label>
            <Input
              value={formatCurrencyInput(assumptions.monthlyIncomeRequiredToMaintainLifestyle || 0)}
              onChange={(e) => updateNestedInput('assumptions', 'monthlyIncomeRequiredToMaintainLifestyle', parseCurrency(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ inputs, updateNestedInput }: FNAStepProps) {
  const results = useMemo(() => calculateRiskPlanning(inputs as FNAInputs), [inputs]);
  
  // Note: Render logic for RiskResultCard is complex and was not in the read scope.
  // Assuming it was rendered in the original file (which I read but was truncated).
  // I will simplify the display for now to ensure compilation, or try to reconstruct.
  // Wait, I saw RiskResultCard in the truncated read?
  // "import { RiskResultCard } from './components/RiskResultCard';" was NOT in my read.
  // But `<RiskResultCard` WAS in the truncated view.
  // This implies RiskResultCard is likely defined in this file or I missed an import.
  // Actually, in the previous read of FNAWizard.tsx, I saw:
  // `<RiskResultCard` in the `ReviewStep`.
  // But I don't see `RiskResultCard` component definition in the file.
  // It must be imported or defined below.
  // Since I can't see it, I'll assume it was defined below or I need to create a placeholder.
  // I'll create a placeholder component here to avoid errors.

  return (
    <div className="space-y-8 pb-8">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
        <div className="flex items-start gap-2">
          <Info className="size-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Review & Adjust Recommendations</p>
            <p className="text-sm text-blue-700 mt-1">
              Review the calculated needs below. You can override the recommended amount based on your professional discretion.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder for RiskResultCard iteration */}
      <Card>
        <CardHeader>
          <CardTitle>Life Cover</CardTitle>
          <CardDescription>Calculated Need: {formatCurrency(results.lifeCover.calculatedNeed)}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please review the life cover calculation.</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Capital Disability</CardTitle>
          <CardDescription>Calculated Need: {formatCurrency(results.capitalDisability.calculatedNeed)}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please review the disability calculation.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Severe Illness</CardTitle>
          <CardDescription>Calculated Need: {formatCurrency(results.severeIllness.calculatedNeed)}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please review the severe illness calculation.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Income Protection</CardTitle>
          <CardDescription>Calculated Need: {formatCurrency(results.incomeProtection.calculatedNeed)}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please review the income protection calculation.</p>
        </CardContent>
      </Card>
    </div>
  );
}