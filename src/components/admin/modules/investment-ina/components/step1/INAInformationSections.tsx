/**
 * Investment INA — Step 1 sections.
 *
 * The four tabs of the INA's Information Gathering step. They were separate
 * wizard steps before the INA moved onto the shared four-step FNA flow; the
 * fields are unchanged.
 */

import { useState } from 'react';
import { AlertCircle, Plus, Target, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { NumberInputField } from '../../../../../ui/number-input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Textarea } from '../../../../../ui/textarea';
import { Badge } from '../../../../../ui/badge';
import { Separator } from '../../../../../ui/separator';
import type {
  DiscretionaryInvestment,
  GoalType,
  InvestmentGoal,
  InvestmentINAInputs,
  PriorityLevel,
  RiskProfile,
} from '../../types';
import { GOAL_TYPE_LABELS, RISK_PROFILE_LABELS } from '../../constants';
import { formatCurrency } from '../../services/investmentINACalculationService';

export interface INASectionProps {
  inputs: Partial<InvestmentINAInputs>;
  updateInputs: (updates: Partial<InvestmentINAInputs>) => void;
}

export function ClientOverviewSection({ inputs, updateInputs }: INASectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>From the client record — review before continuing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ina-current-age">Current Age *</Label>
            <NumberInputField
              id="ina-current-age"
              value={inputs.currentAge}
              onValueChange={(v) => updateInputs({ currentAge: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ina-dob">Date of Birth *</Label>
            <Input
              id="ina-dob"
              type="date"
              value={inputs.dateOfBirth ?? ''}
              onChange={(e) => updateInputs({ dateOfBirth: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ina-dependants">Household Dependants</Label>
            <NumberInputField
              id="ina-dependants"
              value={inputs.householdDependants ?? 0}
              onValueChange={(v) => updateInputs({ householdDependants: v ?? 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ina-gross">Gross Monthly Income</Label>
            <CurrencyInputField
              id="ina-gross"
              value={inputs.grossMonthlyIncome}
              onValueChange={(v) => updateInputs({ grossMonthlyIncome: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ina-net">Net Monthly Income</Label>
            <CurrencyInputField
              id="ina-net"
              value={inputs.netMonthlyIncome}
              onValueChange={(v) => updateInputs({ netMonthlyIncome: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DiscretionaryInvestmentsSection({ inputs }: Pick<INASectionProps, 'inputs'>) {
  const investments = inputs.discretionaryInvestments || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discretionary Investments</CardTitle>
        <CardDescription>
          From the client&apos;s policy records — investments available for goal funding (
          {investments.length} found)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {investments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
            <p>No discretionary investments found.</p>
            <p className="text-sm">Add investments in the client&apos;s Investments tab first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {investments.map((inv: DiscretionaryInvestment) => (
              <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{inv.productName}</p>
                  <p className="text-sm text-muted-foreground">{inv.provider}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm">Current: {formatCurrency(inv.currentValue)}</p>
                  <p className="text-sm text-muted-foreground">
                    Monthly: {formatCurrency(inv.monthlyContribution)}
                  </p>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total Discretionary Capital</span>
              <span>{formatCurrency(inputs.totalDiscretionaryCapitalCurrent || 0)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskProfileSection({ inputs, updateInputs }: INASectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Risk Profile</CardTitle>
        <CardDescription>The default risk profile for the client&apos;s goals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Risk Profile *</Label>
          <Select
            value={inputs.clientRiskProfile || ''}
            onValueChange={(value) => updateInputs({ clientRiskProfile: value as RiskProfile })}
          >
            <SelectTrigger aria-label="Risk profile">
              <SelectValue placeholder="Select risk profile" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RISK_PROFILE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Each profile carries its own expected real return. The system uses the standard economic
            assumptions; you can override them, with a reason, in Adviser Manual Adjustment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function GoalsSection({ inputs, updateInputs }: INASectionProps) {
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
    if (updates.targetDate) {
      updatedGoals[index].targetYear = new Date(updates.targetDate).getFullYear();
    }
    updateInputs({ goals: updatedGoals });
  };

  const deleteGoal = (index: number) => {
    updateInputs({ goals: goals.filter((_: InvestmentGoal, i: number) => i !== index) });
    if (editingGoalIndex === index) setEditingGoalIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Investment Goals *</h3>
          <p className="text-sm text-muted-foreground">Add at least one goal</p>
        </div>
        <Button type="button" onClick={addNewGoal}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Add Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
            <p>No goals added yet.</p>
            <p className="text-sm">Click &quot;Add Goal&quot; to get started.</p>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalEditorCard({
  goal,
  index,
  isEditing,
  onEdit,
  onCollapse,
  onUpdate,
  onDelete,
}: {
  goal: InvestmentGoal;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onCollapse: () => void;
  onUpdate: (updates: Partial<InvestmentGoal>) => void;
  onDelete: () => void;
}) {
  if (!isEditing) {
    return (
      <Card className="cursor-pointer hover:border-primary" onClick={onEdit}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium">{goal.goalName || `Goal ${index + 1}`}</p>
              <p className="text-sm text-muted-foreground">
                Target: {formatCurrency(goal.goalAmountToday)} by {goal.targetYear}
              </p>
            </div>
            <Badge>{GOAL_TYPE_LABELS[goal.goalType as GoalType]}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const id = (field: string) => `goal-${goal.id}-${field}`;

  return (
    <Card className="border-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Edit Goal {index + 1}</CardTitle>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCollapse}>
              Done
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              aria-label={`Delete goal ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2">
            <Label htmlFor={id('name')}>Goal Name *</Label>
            <Input
              id={id('name')}
              value={goal.goalName}
              onChange={(e) => onUpdate({ goalName: e.target.value })}
              placeholder="e.g., Children's Education, House Deposit"
            />
          </div>
          <div className="space-y-2">
            <Label>Goal Type</Label>
            <Select
              value={goal.goalType}
              onValueChange={(value) => onUpdate({ goalType: value as GoalType })}
            >
              <SelectTrigger aria-label="Goal type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={goal.priorityLevel}
              onValueChange={(value) => onUpdate({ priorityLevel: value as PriorityLevel })}
            >
              <SelectTrigger aria-label="Priority">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={id('amount')}>Required Capital (Today&apos;s Rands) *</Label>
            <CurrencyInputField
              id={id('amount')}
              value={goal.goalAmountToday}
              onValueChange={(v) => onUpdate({ goalAmountToday: v ?? 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id('date')}>Target Date *</Label>
            <Input
              id={id('date')}
              type="date"
              value={goal.targetDate}
              onChange={(e) => onUpdate({ targetDate: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={id('contribution')}>Current Monthly Contribution to Goal</Label>
          <CurrencyInputField
            id={id('contribution')}
            value={goal.currentContributionToGoal}
            onValueChange={(v) => onUpdate({ currentContributionToGoal: v ?? 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={id('description')}>Description (Optional)</Label>
          <Textarea
            id={id('description')}
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
