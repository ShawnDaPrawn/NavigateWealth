/**
 * Investment INA — the funding fields of a goal in Step 1: its risk profile,
 * the discretionary investments earmarked for it (with the share of each),
 * and expected lump sums. Without these the calculation counts none of the
 * client's existing capital towards the goal.
 */

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../../ui/input';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { NumberInputField } from '../../../../../ui/number-input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';
import { Checkbox } from '../../../../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  INA_MIN_HORIZON_YEARS,
  resolveInvestmentAllocations,
} from '@/shared/fna-calculations/investment';
import type {
  DiscretionaryInvestment,
  InvestmentGoal,
  LumpSumContribution,
  RiskProfile,
} from '../../types';
import { RISK_PROFILE_LABELS } from '../../constants';
import { formatCurrency } from '../../services/investmentINACalculationService';

type OnUpdate = (updates: Partial<InvestmentGoal>) => void;

const CLIENT_PROFILE = '__client__';

export function GoalRiskProfileField({
  goal,
  clientRiskProfile,
  onUpdate,
}: {
  goal: InvestmentGoal;
  clientRiskProfile?: RiskProfile;
  onUpdate: OnUpdate;
}) {
  const value =
    goal.useClientRiskProfile || !goal.goalSpecificRiskProfile
      ? CLIENT_PROFILE
      : goal.goalSpecificRiskProfile;
  const clientLabel = clientRiskProfile ? RISK_PROFILE_LABELS[clientRiskProfile] : 'not set';

  return (
    <div className="space-y-2">
      <Label>Risk Profile for this Goal</Label>
      <Select
        value={value}
        onValueChange={(next) =>
          next === CLIENT_PROFILE
            ? onUpdate({ useClientRiskProfile: true, goalSpecificRiskProfile: undefined })
            : onUpdate({
                useClientRiskProfile: false,
                goalSpecificRiskProfile: next as RiskProfile,
              })
        }
      >
        <SelectTrigger aria-label="Risk profile for this goal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLIENT_PROFILE}>Client&apos;s profile ({clientLabel})</SelectItem>
          {Object.entries(RISK_PROFILE_LABELS).map(([profile, label]) => (
            <SelectItem key={profile} value={profile}>
              {label} (suits {INA_MIN_HORIZON_YEARS[profile as RiskProfile]}+ years)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function GoalLinkedInvestmentsField({
  goal,
  goals,
  investments,
  onUpdate,
}: {
  goal: InvestmentGoal;
  goals: InvestmentGoal[];
  investments: DiscretionaryInvestment[];
  onUpdate: OnUpdate;
}) {
  const linked = goal.linkedInvestmentIds ?? [];
  const { allocations } = resolveInvestmentAllocations(goals);
  const forGoal = allocations.get(goal.id);

  const toggle = (investmentId: string, checked: boolean) => {
    const nextIds = checked
      ? [...linked.filter((id) => id !== investmentId), investmentId]
      : linked.filter((id) => id !== investmentId);
    const nextAllocations = { ...(goal.linkedInvestmentAllocations ?? {}) };
    if (!checked) delete nextAllocations[investmentId];
    onUpdate({ linkedInvestmentIds: nextIds, linkedInvestmentAllocations: nextAllocations });
  };

  const setAllocation = (investmentId: string, percent: number | undefined) => {
    const nextAllocations = { ...(goal.linkedInvestmentAllocations ?? {}) };
    if (percent === undefined) delete nextAllocations[investmentId];
    else nextAllocations[investmentId] = percent;
    onUpdate({ linkedInvestmentAllocations: nextAllocations });
  };

  return (
    <div className="space-y-2">
      <Label>Existing Investments Earmarked for this Goal</Label>
      {investments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The client has no discretionary investments on record.
        </p>
      ) : (
        <div className="space-y-2">
          {investments.map((inv) => {
            const isLinked = linked.includes(inv.id);
            const allocation = forGoal?.get(inv.id);
            const explicit = goal.linkedInvestmentAllocations?.[inv.id];
            const checkboxId = `goal-${goal.id}-inv-${inv.id}`;
            return (
              <div
                key={inv.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={isLinked}
                    onCheckedChange={(checked) => toggle(inv.id, checked === true)}
                  />
                  <Label htmlFor={checkboxId} className="font-normal">
                    {inv.productName}{' '}
                    <span className="text-muted-foreground">
                      ({formatCurrency(inv.currentValue)})
                    </span>
                  </Label>
                </div>
                {isLinked && (
                  <div className="flex items-center gap-2 text-sm">
                    <Label htmlFor={`${checkboxId}-pct`} className="font-normal">
                      Share %
                    </Label>
                    <NumberInputField
                      id={`${checkboxId}-pct`}
                      className="w-20"
                      decimals={1}
                      value={explicit}
                      placeholder={allocation ? String(Math.round(allocation.percent)) : '100'}
                      onValueChange={(v) => setAllocation(inv.id, v)}
                    />
                    <span className="text-muted-foreground whitespace-nowrap">
                      {explicit === undefined
                        ? allocation?.isShared
                          ? `auto: split between ${allocation.sharedWithGoalCount} goals`
                          : 'auto: 100%'
                        : allocation
                          ? `= ${formatCurrency((inv.currentValue * allocation.percent) / 100)}`
                          : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Leave the share blank to split an investment equally between the goals it is linked to.
            Shares of one investment may not add up to more than 100%.
          </p>
        </div>
      )}
    </div>
  );
}

export function GoalLumpSumsField({
  goal,
  onUpdate,
}: {
  goal: InvestmentGoal;
  onUpdate: OnUpdate;
}) {
  const lumpSums = goal.expectedLumpSums ?? [];

  const update = (index: number, changes: Partial<LumpSumContribution>) =>
    onUpdate({
      expectedLumpSums: lumpSums.map((l, i) => (i === index ? { ...l, ...changes } : l)),
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Expected Lump Sums (Today&apos;s Rands)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onUpdate({
              expectedLumpSums: [
                ...lumpSums,
                { id: `lump-${Date.now()}`, amount: 0, expectedDate: '' },
              ],
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          Add
        </Button>
      </div>
      {lumpSums.map((lumpSum, index) => (
        <div key={lumpSum.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <CurrencyInputField
            aria-label={`Lump sum ${index + 1} amount`}
            value={lumpSum.amount}
            onValueChange={(v) => update(index, { amount: v ?? 0 })}
          />
          <Input
            aria-label={`Lump sum ${index + 1} expected date`}
            type="date"
            value={lumpSum.expectedDate}
            onChange={(e) => update(index, { expectedDate: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove lump sum ${index + 1}`}
            onClick={() => onUpdate({ expectedLumpSums: lumpSums.filter((_, i) => i !== index) })}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      {lumpSums.length > 0 && (
        <p className="text-xs text-muted-foreground">
          A lump sum arriving after the target date does not count towards the goal.
        </p>
      )}
    </div>
  );
}
