/**
 * The planning inputs a financial plan needs (retirement, emergency fund,
 * investment knowledge, capacity for loss), rendered in the client portal and
 * the admin profile viewer. Shapes and rules live in
 * `src/shared/client-profile/planning.ts`.
 *
 * Goals are not kept here: investments have one goals model, "Goals" (the
 * Investment INA). This section shows what the client wrote about their goals
 * on the application and points there.
 */
import { Flag, Target } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { CurrencyInputField } from '../../ui/currency-input';
import { Label } from '../../ui/label';
import { NumberInputField } from '../../ui/number-input';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';
import {
  CAPACITY_FOR_LOSS_OPTIONS,
  INVESTMENT_KNOWLEDGE_OPTIONS,
  INVESTMENT_PRODUCT_OPTIONS,
  emergencyFundTarget,
  yearsToRetirement,
  type CapacityForLoss,
  type InvestmentKnowledge,
  type PlanningProfile,
} from '../../../shared/client-profile';
import { formatCurrency } from '../../../utils/currencyFormatter';
import { CheckboxGroup, SectionHeader, SubHeading } from './fields';
import { type Audience, says } from './fieldHelpers';

interface PlanningSectionProps {
  planning: PlanningProfile;
  onPlanningChange: (planning: PlanningProfile) => void;
  audience: Audience;
  dateOfBirth?: string;
  /** Monthly figure the emergency fund is measured against (net income). */
  monthlyIncome?: number;
  /** Free-text goals the client gave on their application, if any. */
  applicationGoals?: string;
}

export function PlanningSection({
  planning,
  onPlanningChange,
  audience,
  dateOfBirth = '',
  monthlyIncome = 0,
  applicationGoals = '',
}: PlanningSectionProps) {
  const you = (client: string, adviser: string) => says(audience, client, adviser);
  const updatePlanning = (patch: Partial<PlanningProfile>) =>
    onPlanningChange({ ...planning, ...patch });

  const years = yearsToRetirement(dateOfBirth, planning.plannedRetirementAge, new Date());
  const fundTarget = emergencyFundTarget(planning.emergencyFundTargetMonths, monthlyIncome);

  return (
    <div className="space-y-6">
      {/* ── Goals: a pointer, not a store ─────────────────────────────── */}
      <Card>
        <SectionHeader
          icon={Flag}
          title="Goals"
          description={you(
            'Your investment goals are set with your adviser in a goals analysis',
            'Investment goals are captured in Goals on the Investments tab',
          )}
        />
        <CardContent>
          {applicationGoals.trim() ? (
            <div className="rounded-lg bg-gray-50 p-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {you('What you told us when you applied', 'Goals noted on the application')}
              </p>
              <p className="mt-1 whitespace-pre-line text-gray-800">{applicationGoals}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              {you(
                'Tell your adviser what you are saving or planning for, and they will set the goals up with you.',
                'No goals were noted on the application.',
              )}
            </p>
          )}
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
