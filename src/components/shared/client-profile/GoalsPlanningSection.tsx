/**
 * The client's own goals and the planning inputs a financial plan needs
 * (retirement, emergency fund, investment knowledge, capacity for loss).
 * Rendered in the client portal and the admin profile viewer. Shapes and rules
 * live in `src/shared/client-profile/planning.ts`.
 */
import { Flag, Plus, Target, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { CurrencyInputField } from '../../ui/currency-input';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { NumberInputField } from '../../ui/number-input';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';
import {
  CAPACITY_FOR_LOSS_OPTIONS,
  GOAL_PRIORITY_OPTIONS,
  INVESTMENT_KNOWLEDGE_OPTIONS,
  INVESTMENT_PRODUCT_OPTIONS,
  PROFILE_GOAL_CATEGORY_OPTIONS,
  createProfileGoal,
  emergencyFundTarget,
  goalProgressPercent,
  yearsToRetirement,
  type CapacityForLoss,
  type GoalPriority,
  type InvestmentKnowledge,
  type PlanningProfile,
  type ProfileGoal,
  type ProfileGoalCategory,
} from '../../../shared/client-profile';
import { formatCurrency } from '../../../utils/currencyFormatter';
import { CheckboxGroup, SectionHeader, SubHeading } from './fields';
import { type Audience, newRowId, says } from './fieldHelpers';

interface GoalsPlanningSectionProps {
  goals: ProfileGoal[];
  onGoalsChange: (goals: ProfileGoal[]) => void;
  planning: PlanningProfile;
  onPlanningChange: (planning: PlanningProfile) => void;
  audience: Audience;
  dateOfBirth?: string;
  /** Monthly figure the emergency fund is measured against (net income). */
  monthlyIncome?: number;
  /** Free-text goals the client gave on their application, if any. */
  applicationGoals?: string;
}

export function GoalsPlanningSection({
  goals,
  onGoalsChange,
  planning,
  onPlanningChange,
  audience,
  dateOfBirth = '',
  monthlyIncome = 0,
  applicationGoals = '',
}: GoalsPlanningSectionProps) {
  const you = (client: string, adviser: string) => says(audience, client, adviser);
  const updateGoal = (id: string, patch: Partial<ProfileGoal>) =>
    onGoalsChange(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const updatePlanning = (patch: Partial<PlanningProfile>) =>
    onPlanningChange({ ...planning, ...patch });

  const years = yearsToRetirement(dateOfBirth, planning.plannedRetirementAge, new Date());
  const fundTarget = emergencyFundTarget(planning.emergencyFundTargetMonths, monthlyIncome);

  return (
    <div className="space-y-6">
      {/* ── Goals ─────────────────────────────────────────────────────── */}
      <Card>
        <SectionHeader
          icon={Flag}
          title={you('Your Goals', 'Client goals')}
          description={you(
            'What you want your money to do for you, in order of importance',
            "The client's own stated goals and priorities",
          )}
          actions={
            <Button
              size="sm"
              onClick={() => onGoalsChange([...goals, createProfileGoal(newRowId('goal'))])}
              className="bg-[#6d28d9] hover:bg-[#5b21b6]"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add goal
            </Button>
          }
        />
        <CardContent className="space-y-4">
          {applicationGoals.trim() && (
            <div className="rounded-lg bg-gray-50 p-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {you('What you told us when you applied', 'Goals noted on the application')}
              </p>
              <p className="mt-1 whitespace-pre-line text-gray-800">{applicationGoals}</p>
            </div>
          )}

          {goals.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
              {you(
                'No goals yet. Add the things you are saving or planning for — retirement, education, a home, an emergency fund.',
                'No goals recorded yet.',
              )}
            </div>
          )}

          {goals.map((goal) => {
            const progress = goalProgressPercent(goal);
            return (
              <div key={goal.id} className="space-y-4 rounded-lg border border-gray-200 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <Label htmlFor={`goal-category-${goal.id}`}>Type of goal</Label>
                    <Select
                      value={goal.category}
                      onValueChange={(v) =>
                        updateGoal(goal.id, { category: v as ProfileGoalCategory })
                      }
                    >
                      <SelectTrigger id={`goal-category-${goal.id}`} className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFILE_GOAL_CATEGORY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`goal-name-${goal.id}`}>Goal</Label>
                    <Input
                      id={`goal-name-${goal.id}`}
                      value={goal.name}
                      onChange={(e) => updateGoal(goal.id, { name: e.target.value })}
                      placeholder="e.g. Emma's university fees"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Remove goal ${goal.name || ''}`.trim()}
                      onClick={() => onGoalsChange(goals.filter((g) => g.id !== goal.id))}
                      className="border-red-600 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`goal-target-${goal.id}`}>Target amount</Label>
                    <CurrencyInputField
                      id={`goal-target-${goal.id}`}
                      value={goal.targetAmount}
                      onValueChange={(v) => updateGoal(goal.id, { targetAmount: v ?? 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`goal-date-${goal.id}`}>Target date</Label>
                    <Input
                      id={`goal-date-${goal.id}`}
                      type="date"
                      value={goal.targetDate}
                      onChange={(e) => updateGoal(goal.id, { targetDate: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`goal-priority-${goal.id}`}>Priority</Label>
                    <Select
                      value={goal.priority}
                      onValueChange={(v) => updateGoal(goal.id, { priority: v as GoalPriority })}
                    >
                      <SelectTrigger id={`goal-priority-${goal.id}`} className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOAL_PRIORITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`goal-saved-${goal.id}`}>Saved so far</Label>
                    <CurrencyInputField
                      id={`goal-saved-${goal.id}`}
                      value={goal.amountSaved}
                      onValueChange={(v) => updateGoal(goal.id, { amountSaved: v ?? 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`goal-monthly-${goal.id}`}>Saving each month</Label>
                    <CurrencyInputField
                      id={`goal-monthly-${goal.id}`}
                      value={goal.monthlyContribution}
                      onValueChange={(v) => updateGoal(goal.id, { monthlyContribution: v ?? 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    {progress !== null && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div
                          className="mt-1 h-2 rounded-full bg-gray-200"
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${goal.name || 'Goal'} progress`}
                        >
                          <div
                            className="h-2 rounded-full bg-[#6d28d9]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor={`goal-notes-${goal.id}`}>Notes</Label>
                  <Textarea
                    id={`goal-notes-${goal.id}`}
                    value={goal.notes}
                    onChange={(e) => updateGoal(goal.id, { notes: e.target.value })}
                    className="mt-1.5"
                    rows={2}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Planning profile ──────────────────────────────────────────── */}
      <Card>
        <SectionHeader
          icon={Target}
          title={you('Planning Preferences', 'Planning profile')}
          description={you(
            'The assumptions your financial plan is built on',
            'Planning inputs and suitability facts (FAIS)',
          )}
        />
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <SubHeading>Retirement</SubHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="plannedRetirementAge">
                  {you('Age you plan to retire', 'Planned retirement age')}
                </Label>
                <NumberInputField
                  id="plannedRetirementAge"
                  value={planning.plannedRetirementAge || ''}
                  onValueChange={(v) => updatePlanning({ plannedRetirementAge: v ?? 0 })}
                  placeholder="e.g. 65"
                  className="mt-1.5"
                />
                {years !== null && (
                  <p className="mt-1 text-xs text-gray-500">
                    {years} {years === 1 ? 'year' : 'years'} from now
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="retirementIncomeTargetPercent">
                  Retirement income needed (% of today&apos;s income)
                </Label>
                <NumberInputField
                  id="retirementIncomeTargetPercent"
                  value={planning.retirementIncomeTargetPercent || ''}
                  onValueChange={(v) =>
                    updatePlanning({ retirementIncomeTargetPercent: Math.min(v ?? 0, 200) })
                  }
                  placeholder="e.g. 75"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <SubHeading hint="Cash set aside for emergencies, separate from long-term investments.">
              Emergency fund
            </SubHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="emergencyFundTargetMonths">Target (months of income)</Label>
                <NumberInputField
                  id="emergencyFundTargetMonths"
                  value={planning.emergencyFundTargetMonths || ''}
                  onValueChange={(v) =>
                    updatePlanning({ emergencyFundTargetMonths: Math.min(v ?? 0, 36) })
                  }
                  placeholder="e.g. 3"
                  className="mt-1.5"
                />
                {fundTarget > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    About {formatCurrency(fundTarget)} at the current net income
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="emergencyFundCurrentAmount">Currently set aside</Label>
                <CurrencyInputField
                  id="emergencyFundCurrentAmount"
                  value={planning.emergencyFundCurrentAmount}
                  onValueChange={(v) => updatePlanning({ emergencyFundCurrentAmount: v ?? 0 })}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <SubHeading>Investment knowledge and experience</SubHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="investmentKnowledge">Knowledge</Label>
                <Select
                  value={planning.investmentKnowledge}
                  onValueChange={(v) =>
                    updatePlanning({ investmentKnowledge: v as InvestmentKnowledge })
                  }
                >
                  <SelectTrigger id="investmentKnowledge" className="mt-1.5">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_KNOWLEDGE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="investmentExperienceYears">Years of investing</Label>
                <NumberInputField
                  id="investmentExperienceYears"
                  value={planning.investmentExperienceYears || ''}
                  onValueChange={(v) => updatePlanning({ investmentExperienceYears: v ?? 0 })}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-gray-900">
                {you('Products you have invested in', 'Products the client has invested in')}
              </p>
              <CheckboxGroup
                id="investmentProductsHeld"
                options={INVESTMENT_PRODUCT_OPTIONS}
                value={planning.investmentProductsHeld}
                onChange={(investmentProductsHeld) => updatePlanning({ investmentProductsHeld })}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <SubHeading
              hint={you(
                'Not how you would feel about a fall in value — how much it would actually affect your life and plans.',
                'Distinct from risk tolerance (the questionnaire): the financial effect of a loss, not the client’s comfort with it.',
              )}
            >
              Capacity for loss
            </SubHeading>
            <p id="capacityForLoss-label" className="text-sm text-gray-900">
              {you(
                'If your investments fell by 20% and took a few years to recover, how would it affect you?',
                'If the client’s investments fell 20% and took years to recover, how would it affect them?',
              )}
            </p>
            <RadioGroup
              aria-labelledby="capacityForLoss-label"
              value={planning.capacityForLoss}
              onValueChange={(v) => updatePlanning({ capacityForLoss: v as CapacityForLoss })}
              className="gap-2"
            >
              {CAPACITY_FOR_LOSS_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  htmlFor={`capacityForLoss-${o.value}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    planning.capacityForLoss === o.value
                      ? 'border-[#6d28d9] bg-[#6d28d9]/5'
                      : 'border-gray-200'
                  }`}
                >
                  <RadioGroupItem
                    id={`capacityForLoss-${o.value}`}
                    value={o.value}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm text-gray-900">{o.label}</span>
                    <span className="block text-xs text-gray-500">{o.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div>
              <Label htmlFor="capacityForLossNotes">Notes (optional)</Label>
              <Textarea
                id="capacityForLossNotes"
                value={planning.capacityForLossNotes}
                onChange={(e) => updatePlanning({ capacityForLossNotes: e.target.value })}
                className="mt-1.5"
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
