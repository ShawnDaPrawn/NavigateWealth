/**
 * Client investment intake — goals and risk profile (no product selection).
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { RISK_PROFILE_LABELS } from '@/components/admin/modules/investment-ina/constants';
import type { RiskProfile } from '@/components/admin/modules/investment-ina/types';

interface GoalRow {
  id: string;
  goalName: string;
  targetAmount: number;
  monthlyContribution: number;
  targetDate: string;
}

interface InvestmentIntakeStep1Props {
  initialInputs?: Record<string, unknown>;
  onContinue: (inputs: Record<string, unknown>) => void;
  onSaveDraft: (inputs: Record<string, unknown>) => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

function emptyGoal(): GoalRow {
  return {
    id: crypto.randomUUID(),
    goalName: '',
    targetAmount: 0,
    monthlyContribution: 0,
    targetDate: '',
  };
}

function goalsFromInitial(initialInputs: Record<string, unknown>): GoalRow[] {
  const existing = initialInputs.goals;
  if (!Array.isArray(existing) || existing.length === 0) return [emptyGoal()];
  return existing.map((goal) => {
    const row = goal as Record<string, unknown>;
    return {
      id: String(row.id ?? crypto.randomUUID()),
      goalName: String(row.goalName ?? ''),
      targetAmount: Number(row.goalAmountToday ?? row.targetAmount ?? 0),
      monthlyContribution: Number(row.currentContributionToGoal ?? row.monthlyContribution ?? 0),
      targetDate: String(row.targetDate ?? row.targetYear ?? ''),
    };
  });
}

export function InvestmentIntakeStep1({
  initialInputs = {},
  onContinue,
  onSaveDraft,
  isSaving = false,
  readOnly = false,
}: InvestmentIntakeStep1Props) {
  const [goals, setGoals] = useState<GoalRow[]>(() => goalsFromInitial(initialInputs));
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(
    (initialInputs.clientRiskProfile as RiskProfile) ?? 'balanced',
  );
  const [horizonYears, setHorizonYears] = useState(
    String(
      (initialInputs.economicAssumptions as { investmentHorizonYears?: number })
        ?.investmentHorizonYears ?? 10,
    ),
  );
  const [notes, setNotes] = useState(String(initialInputs.planningNotes ?? ''));

  const buildInputs = (): Record<string, unknown> => ({
    goals: goals.map((goal) => ({
      id: goal.id,
      goalName: goal.goalName,
      goalType: 'wealth-creation',
      goalAmountToday: goal.targetAmount,
      targetDate: goal.targetDate,
      targetYear: Number.parseInt(goal.targetDate, 10) || new Date().getFullYear() + 10,
      priorityLevel: 'medium',
      linkedInvestmentIds: [],
      currentContributionToGoal: goal.monthlyContribution,
      expectedLumpSums: [],
      useClientRiskProfile: true,
    })),
    clientRiskProfile: riskProfile,
    economicAssumptions: {
      investmentHorizonYears: Number(horizonYears) || 10,
    },
    planningNotes: notes,
  });

  const updateGoal = (index: number, patch: Partial<GoalRow>) => {
    setGoals((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your investment goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goals.map((goal, index) => (
            <div key={goal.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Goal {index + 1}</span>
                {!readOnly && goals.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGoals((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Goal name</Label>
                  <Input
                    disabled={readOnly}
                    value={goal.goalName}
                    onChange={(e) => updateGoal(index, { goalName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Target amount (R)</Label>
                  <Input
                    type="number"
                    disabled={readOnly}
                    value={goal.targetAmount || ''}
                    onChange={(e) =>
                      updateGoal(index, { targetAmount: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly contribution (R)</Label>
                  <Input
                    type="number"
                    disabled={readOnly}
                    value={goal.monthlyContribution || ''}
                    onChange={(e) =>
                      updateGoal(index, { monthlyContribution: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Target year</Label>
                  <Input
                    disabled={readOnly}
                    placeholder="e.g. 2035"
                    value={goal.targetDate}
                    onChange={(e) => updateGoal(index, { targetDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setGoals((prev) => [...prev, emptyGoal()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add another goal
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk comfort</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>How would you describe your investment risk tolerance?</Label>
            <Select
              disabled={readOnly}
              value={riskProfile}
              onValueChange={(v) => setRiskProfile(v as RiskProfile)}
            >
              <SelectTrigger>
                <SelectValue />
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
          <div className="space-y-1.5">
            <Label>Investment time horizon (years)</Label>
            <Input
              type="number"
              disabled={readOnly}
              value={horizonYears}
              onChange={(e) => setHorizonYears(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Anything else we should know?</Label>
            <Textarea
              disabled={readOnly}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onSaveDraft(buildInputs())}
          >
            Save draft
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => onContinue(buildInputs())}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
