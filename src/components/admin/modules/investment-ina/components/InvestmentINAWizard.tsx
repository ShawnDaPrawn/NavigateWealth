/**
 * Investment Needs Analysis Wizard
 * Multi-step form for creating and editing Investment INA sessions
 */

import React, { useState, useEffect } from 'react';
import { FNAWizardLayout, FNAWizardStepConfig } from '../../fna/FNAWizardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Button } from '../../../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { Checkbox } from '../../../../ui/checkbox';
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  Settings,
  Users,
  PiggyBank,
  BarChart,
  Calculator
} from 'lucide-react';
import type { 
  InvestmentINAInputs, 
  InvestmentGoal, 
  DiscretionaryInvestment,
  LumpSumContribution,
  RiskProfile,
  GoalType,
  PriorityLevel,
  InvestmentINAWizardStep
} from '../types';
import { DEFAULT_ECONOMIC_ASSUMPTIONS, GOAL_TYPE_LABELS, RISK_PROFILE_LABELS } from '../constants';
import { InvestmentINAApiService } from '../api';
import { InvestmentINACalculationService } from '../services/investmentINACalculationService';
import { toast } from 'sonner@2.0.3';

interface InvestmentINAWizardProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onComplete?: (sessionId: string) => void;
}

export function InvestmentINAWizard({ 
  open, 
  onClose, 
  clientId,
  onComplete 
}: InvestmentINAWizardProps) {
  const [currentStep, setCurrentStep] = useState<InvestmentINAWizardStep>('client-overview');
  const [inputs, setInputs] = useState<Partial<InvestmentINAInputs>>({});
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);

  const stepsList: InvestmentINAWizardStep[] = [
    'client-overview',
    'discretionary-investments',
    'risk-profile',
    'economic-assumptions',
    'goals-setup',
    'review',
    'results'
  ];

  const stepConfig: Record<InvestmentINAWizardStep, FNAWizardStepConfig> = {
    'client-overview': { id: 'client-overview', label: 'Client Overview', icon: Users },
    'discretionary-investments': { id: 'discretionary-investments', label: 'Discretionary Inv.', icon: PiggyBank },
    'risk-profile': { id: 'risk-profile', label: 'Risk Profile', icon: TrendingUp },
    'economic-assumptions': { id: 'economic-assumptions', label: 'Assumptions', icon: Settings },
    'goals-setup': { id: 'goals-setup', label: 'Goals', icon: Target },
    'review': { id: 'review', label: 'Review', icon: Calculator },
    'results': { id: 'results', label: 'Results', icon: BarChart }
  };

  const wizardSteps = stepsList.map(step => stepConfig[step]);

  useEffect(() => {
    if (open) {
      loadInitialData();
    } else {
      // Reset on close
      setCurrentStep('client-overview');
      setInputs({});
      setResults(null);
    }
  }, [open, clientId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const autoPopulated = await InvestmentINAApiService.autoPopulateInputs(clientId);
      setInputs(autoPopulated);
      toast.success('Client data loaded successfully');
    } catch (error: unknown) {
      console.log('⚠️ Investment INA backend not available - working in client-side mode');
      // Initialize with empty inputs
      setInputs({});
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = stepsList.indexOf(currentStep);

  const handleStepChange = (index: number) => {
    const targetStep = stepsList[index];
    setCurrentStep(targetStep);
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    if (!validateCurrentStep()) {
      return;
    }

    // If on review step, calculate results
    if (currentStep === 'review') {
      await calculateResults();
      setCurrentStep('results');
      return;
    }
    
    // If on results step, this button acts as "Save & Publish"
    if (currentStep === 'results') {
      await handleSaveAndPublish();
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepsList.length) {
      setCurrentStep(stepsList[nextIndex]);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(stepsList[prevIndex]);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 'client-overview':
        if (!inputs.currentAge || !inputs.dateOfBirth) {
          toast.error('Please provide client age and date of birth');
          return false;
        }
        break;
      case 'risk-profile':
        if (!inputs.clientRiskProfile) {
          toast.error('Please select a risk profile');
          return false;
        }
        break;
      case 'economic-assumptions':
        if (!inputs.longTermInflationRate || !inputs.expectedRealReturns) {
          toast.error('Please configure economic assumptions');
          return false;
        }
        break;
      case 'goals-setup':
        if (!inputs.goals || inputs.goals.length === 0) {
          toast.error('Please add at least one investment goal');
          return false;
        }
        // Validate each goal
        for (const goal of inputs.goals) {
          const goalErrors = InvestmentINACalculationService.validateGoal(goal);
          if (goalErrors.length > 0) {
            toast.error(`Goal "${goal.goalName}": ${goalErrors[0]}`);
            return false;
          }
        }
        break;
    }
    return true;
  };

  const calculateResults = async () => {
    try {
      setCalculating(true);
      const calculatedResults = await InvestmentINAApiService.calculateINA(clientId, inputs as InvestmentINAInputs);
      setResults(calculatedResults);
    } catch (error: unknown) {
      console.error('Error calculating INA:', error);
      toast.error('Failed to calculate results: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveAndPublish = async () => {
    try {
      setLoading(true);
      const session = await InvestmentINAApiService.saveSession(
        clientId,
        inputs as InvestmentINAInputs,
        results,
        'published'
      );
      toast.success('Investment INA published successfully');
      onComplete?.(session.id);
      onClose();
    } catch (error: unknown) {
      console.error('Error saving INA:', error);
      toast.error('Failed to save INA: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      const session = await InvestmentINAApiService.saveSession(
        clientId,
        inputs as InvestmentINAInputs,
        results,
        'draft'
      );
      toast.success('Investment INA saved as draft');
      onComplete?.(session.id);
      onClose();
    } catch (error: unknown) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const updateInputs = (updates: Partial<InvestmentINAInputs>) => {
    setInputs(prev => ({ ...prev, ...updates }));
  };

  const isResultsStep = currentStep === 'results';
  const isReviewStep = currentStep === 'review';

  // Determine button labels and icons
  let nextLabel = 'Next';
  let NextIcon = ArrowRight;
  
  if (isReviewStep) {
    nextLabel = 'Calculate';
    NextIcon = Calculator;
  } else if (isResultsStep) {
    nextLabel = 'Save & Publish';
    NextIcon = Check;
  }

  const showSaveButton = isResultsStep;

  return (
    <FNAWizardLayout
      open={open}
      onClose={onClose}
      title={`Investment Needs Analysis - ${stepConfig[currentStep].label}`}
      description="Investment planning and goal analysis"
      steps={wizardSteps}
      currentStepIndex={currentStepIndex}
      onStepChange={handleStepChange}
      onBack={handlePrevious}
      onNext={handleNext}
      onSave={showSaveButton ? handleSaveDraft : undefined}
      loading={loading}
      isSaving={calculating || (loading && isResultsStep)}
      isNextDisabled={loading || calculating}
      isLastStep={isResultsStep}
      nextLabel={nextLabel}
      nextIcon={NextIcon}
      saveLabel="Save as Draft"
    >
      <div className="min-h-[400px]">
        {currentStep === 'client-overview' && (
          <ClientOverviewStep inputs={inputs} updateInputs={updateInputs} />
        )}
        {currentStep === 'discretionary-investments' && (
          <DiscretionaryInvestmentsStep inputs={inputs} updateInputs={updateInputs} />
        )}
        {currentStep === 'risk-profile' && (
          <RiskProfileStep inputs={inputs} updateInputs={updateInputs} />
        )}
        {currentStep === 'economic-assumptions' && (
          <EconomicAssumptionsStep inputs={inputs} updateInputs={updateInputs} />
        )}
        {currentStep === 'goals-setup' && (
          <GoalsSetupStep inputs={inputs} updateInputs={updateInputs} />
        )}
        {currentStep === 'review' && (
          <ReviewStep inputs={inputs} />
        )}
        {currentStep === 'results' && (
          <ResultsStep results={results} />
        )}
      </div>
    </FNAWizardLayout>
  );
}

// ==================== STEP COMPONENTS ====================

/** Shared props for Investment INA step components */
interface INAStepProps {
  inputs: Partial<InvestmentINAInputs>;
  updateInputs?: (updates: Partial<InvestmentINAInputs>) => void;
}

function ClientOverviewStep({ inputs, updateInputs }: INAStepProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Auto-populated from client profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Age</Label>
              <Input 
                type="number" 
                value={inputs.currentAge || ''} 
                onChange={(e) => updateInputs({ currentAge: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input 
                type="date" 
                value={inputs.dateOfBirth || ''} 
                onChange={(e) => updateInputs({ dateOfBirth: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Household Dependants</Label>
              <Input 
                type="number" 
                value={inputs.householdDependants || 0} 
                onChange={(e) => updateInputs({ householdDependants: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gross Monthly Income</Label>
              <Input 
                type="number" 
                value={inputs.grossMonthlyIncome || ''} 
                onChange={(e) => updateInputs({ grossMonthlyIncome: parseFloat(e.target.value) })}
                placeholder="R 0"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DiscretionaryInvestmentsStep({ inputs, updateInputs }: INAStepProps) {
  const discretionaryInvs = inputs.discretionaryInvestments || [];
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Discretionary Investments</CardTitle>
          <CardDescription>
            Investments available for goal funding ({discretionaryInvs.length} found)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discretionaryInvs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No discretionary investments found.</p>
              <p className="text-sm">Add investments in the Investments tab first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {discretionaryInvs.map((inv: DiscretionaryInvestment, index: number) => (
                <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{inv.productName}</p>
                    <p className="text-sm text-muted-foreground">{inv.provider}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm">Current: {InvestmentINACalculationService.formatCurrency(inv.currentValue)}</p>
                    <p className="text-sm text-muted-foreground">
                      Monthly: {InvestmentINACalculationService.formatCurrency(inv.monthlyContribution)}
                    </p>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Discretionary Capital</span>
                <span>{InvestmentINACalculationService.formatCurrency(inputs.totalDiscretionaryCapitalCurrent || 0)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RiskProfileStep({ inputs, updateInputs }: INAStepProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Client Risk Profile</CardTitle>
          <CardDescription>Select the default risk profile for investment goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Risk Profile</Label>
            <Select 
              value={inputs.clientRiskProfile || ''} 
              onValueChange={(value) => updateInputs({ clientRiskProfile: value as RiskProfile })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select risk profile" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RISK_PROFILE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Note:</p>
            <p className="text-sm text-muted-foreground">
              You can override this risk profile for individual goals in the Goals Setup step.
              Different risk profiles will use different expected return assumptions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EconomicAssumptionsStep({ inputs, updateInputs }: INAStepProps) {
  const defaults = DEFAULT_ECONOMIC_ASSUMPTIONS;
  
  useEffect(() => {
    // Initialize with defaults if not set
    if (!inputs.longTermInflationRate) {
      updateInputs({ 
        longTermInflationRate: defaults.longTermInflationRate,
        expectedRealReturns: defaults.expectedRealReturns,
      });
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Economic Assumptions</CardTitle>
          <CardDescription>Configure inflation and expected returns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Long-term Inflation Rate (%)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={(inputs.longTermInflationRate || 0) * 100} 
              onChange={(e) => updateInputs({ longTermInflationRate: parseFloat(e.target.value) / 100 })}
            />
            <p className="text-xs text-muted-foreground">South African long-term average is approximately 6%</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Expected Real Returns by Risk Profile (%)</Label>
            <p className="text-sm text-muted-foreground">Returns after inflation</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {Object.keys(RISK_PROFILE_LABELS).map((profile) => (
                <div key={profile} className="space-y-1">
                  <Label className="capitalize text-sm">{profile}</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={(inputs.expectedRealReturns?.[profile as RiskProfile] || 0) * 100} 
                    onChange={(e) => updateInputs({ 
                      expectedRealReturns: {
                        ...inputs.expectedRealReturns,
                        [profile]: parseFloat(e.target.value) / 100
                      }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalsSetupStep({ inputs, updateInputs }: INAStepProps) {
  const [editingGoalIndex, setEditingGoalIndex] = useState<number | null>(null);

  const goals = inputs.goals || [];

  const addNewGoal = () => {
    const newGoal: InvestmentGoal = {
      id: `goal-${Date.now()}`,
      goalName: '',
      goalDescription: '',
      goalType: 'wealth-creation',
      goalAmountToday: 0,
      targetDate: '',
      targetYear: new Date().getFullYear() + 5,
      priorityLevel: 'medium',
      linkedInvestmentIds: [],
      currentContributionToGoal: 0,
      expectedLumpSums: [],
      useClientRiskProfile: true,
    };
    updateInputs({ goals: [...goals, newGoal] });
    setEditingGoalIndex(goals.length);
  };

  const updateGoal = (index: number, updates: Partial<InvestmentGoal>) => {
    const updatedGoals = [...goals];
    updatedGoals[index] = { ...updatedGoals[index], ...updates };
    
    // If target date changed, update target year
    if (updates.targetDate) {
      updatedGoals[index].targetYear = new Date(updates.targetDate).getFullYear();
    }
    
    updateInputs({ goals: updatedGoals });
  };

  const deleteGoal = (index: number) => {
    const updatedGoals = goals.filter((_: InvestmentGoal, i: number) => i !== index);
    updateInputs({ goals: updatedGoals });
    if (editingGoalIndex === index) {
      setEditingGoalIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Investment Goals</h3>
          <p className="text-sm text-muted-foreground">Add and configure goals</p>
        </div>
        <Button onClick={addNewGoal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No goals added yet.</p>
            <p className="text-sm">Click "Add Goal" to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {goals.map((goal: InvestmentGoal, index: number) => (
            <GoalEditorCard 
              key={goal.id}
              goal={goal}
              index={index}
              isEditing={editingGoalIndex === index}
              onEdit={() => setEditingGoalIndex(index)}
              onCollapse={() => setEditingGoalIndex(null)}
              onUpdate={(updates) => updateGoal(index, updates)}
              onDelete={() => deleteGoal(index)}
              discretionaryInvestments={inputs.discretionaryInvestments || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalEditorCard({ goal, index, isEditing, onEdit, onCollapse, onUpdate, onDelete, discretionaryInvestments }: {
  goal: InvestmentGoal;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onCollapse: () => void;
  onUpdate: (updates: Partial<InvestmentGoal>) => void;
  onDelete: () => void;
  discretionaryInvestments: DiscretionaryInvestment[];
}) {
  if (!isEditing) {
    return (
      <Card className="cursor-pointer hover:border-primary" onClick={onEdit}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium">{goal.goalName || `Goal ${index + 1}`}</p>
              <p className="text-sm text-muted-foreground">
                Target: {InvestmentINACalculationService.formatCurrency(goal.goalAmountToday)} by {goal.targetYear}
              </p>
            </div>
            <Badge>{GOAL_TYPE_LABELS[goal.goalType as GoalType]}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Edit Goal {index + 1}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCollapse}>Done</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>Goal Name *</Label>
            <Input 
              value={goal.goalName} 
              onChange={(e) => onUpdate({ goalName: e.target.value })}
              placeholder="e.g., Children's Education, House Deposit"
            />
          </div>
          <div className="space-y-2">
            <Label>Goal Type</Label>
            <Select value={goal.goalType} onValueChange={(value) => onUpdate({ goalType: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={goal.priorityLevel} onValueChange={(value) => onUpdate({ priorityLevel: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Goal Amount and Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Required Capital (Today's Rands) *</Label>
            <Input 
              type="number"
              value={goal.goalAmountToday} 
              onChange={(e) => onUpdate({ goalAmountToday: parseFloat(e.target.value) })}
              placeholder="R 0"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Date *</Label>
            <Input 
              type="date"
              value={goal.targetDate} 
              onChange={(e) => onUpdate({ targetDate: e.target.value })}
            />
          </div>
        </div>

        {/* Contribution */}
        <div className="space-y-2">
          <Label>Current Monthly Contribution to Goal</Label>
          <Input 
            type="number"
            value={goal.currentContributionToGoal} 
            onChange={(e) => onUpdate({ currentContributionToGoal: parseFloat(e.target.value) })}
            placeholder="R 0"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Description (Optional)</Label>
          <Textarea 
            value={goal.goalDescription || ''} 
            onChange={(e) => onUpdate({ goalDescription: e.target.value })}
            placeholder="Additional notes about this goal..."
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({ inputs }: { inputs: Partial<InvestmentINAInputs> }) {
  const goals = inputs.goals || [];
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Inputs</CardTitle>
          <CardDescription>Verify all information before calculation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Client Information</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Age: {inputs.currentAge} years</p>
              <p>Risk Profile: {RISK_PROFILE_LABELS[inputs.clientRiskProfile as RiskProfile]}</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Discretionary Investments</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Total Capital: {InvestmentINACalculationService.formatCurrency(inputs.totalDiscretionaryCapitalCurrent || 0)}</p>
              <p>Monthly Contributions: {InvestmentINACalculationService.formatCurrency(inputs.totalDiscretionaryMonthlyContributions || 0)}/month</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Investment Goals ({goals.length})</p>
            <div className="space-y-2">
              {goals.map((goal: InvestmentGoal) => (
                <div key={goal.id} className="p-2 bg-muted rounded text-sm">
                  <p className="font-medium">{goal.goalName}</p>
                  <p className="text-muted-foreground">
                    {InvestmentINACalculationService.formatCurrency(goal.goalAmountToday)} by {goal.targetYear}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultsStep({ results }: { results: Record<string, unknown> | null }) {
  if (!results) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
        <p className="text-muted-foreground">Calculating your investment needs...</p>
      </div>
    );
  }

  const { portfolioSummary } = results;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Calculation Complete
          </CardTitle>
          <CardDescription>Investment Needs Analysis results summary</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Portfolio Health</p>
              <p className="text-lg font-semibold capitalize">{portfolioSummary.overallPortfolioHealth}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Goals On Track</p>
              <p className="text-lg font-semibold">{portfolioSummary.goalsOnTrack} / {portfolioSummary.totalGoals}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Funding Gap</p>
              <p className={`text-lg font-semibold ${portfolioSummary.totalFundingGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {InvestmentINACalculationService.formatCurrency(portfolioSummary.totalFundingGap)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Additional Monthly Required</p>
              <p className="text-lg font-semibold">
                {InvestmentINACalculationService.formatCurrency(portfolioSummary.totalAdditionalMonthlyRequired)}/mo
              </p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-sm font-medium text-blue-900 mb-2">Next Steps</p>
            <p className="text-sm text-blue-700">
              Review the detailed results after saving. You can download a PDF report and share it with your client.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}