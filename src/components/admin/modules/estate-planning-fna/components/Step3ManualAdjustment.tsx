/**
 * Estate Planning — Step 3: Adviser Manual Adjustment
 *
 * The adviser may override the administration-cost assumptions, whether the
 * estate passes to a surviving spouse, the marginal rate used for CGT on death
 * and a predeceased spouse's unused abatement. Statutory values are fixed.
 * Every override needs a recorded reason; the wizard recalculates before Step 4.
 */

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import {
  FNAAssumptionOverrides,
  FNAStepNavigation,
  hasAssumptionOverrides,
  isOverrideReasonValid,
  type FNAAssumptionRow,
} from '../../fna';
import type {
  EstateAdjustableAssumptions,
  EstatePlanningAdviserAdjustments,
  EstatePlanningInputs,
} from '../types';
import { resolveEstateAssumptions } from '../utils';

type NumericAssumption = Exclude<keyof EstateAdjustableAssumptions, 'spousalBequest'>;

const NUMERIC_ASSUMPTIONS: {
  id: NumericAssumption;
  label: string;
  format: 'percent' | 'fraction' | 'currency';
}[] = [
  {
    id: 'executorFeePercentage',
    label: 'Executor fee (of gross estate, excl. VAT — 15% VAT is added)',
    format: 'percent',
  },
  { id: 'conveyancingFeesPerProperty', label: 'Conveyancing per property', format: 'currency' },
  { id: 'masterFeesEstimate', label: "Master's fees", format: 'currency' },
  { id: 'funeralCostsEstimate', label: 'Funeral costs', format: 'currency' },
  { id: 'cgtMarginalRate', label: 'Marginal tax rate for CGT on death', format: 'fraction' },
  {
    id: 'predeceasedSpouseUnusedAbatement',
    label: "Predeceased spouse's unused abatement (s4A, up to R3.5m)",
    format: 'currency',
  },
];

interface Step3Props {
  inputs: EstatePlanningInputs;
  initialAdjustments?: EstatePlanningAdviserAdjustments;
  onNext: (adjustments: EstatePlanningAdviserAdjustments) => void;
  onBack: () => void;
}

export function Step3ManualAdjustment({ inputs, initialAdjustments, onNext, onBack }: Step3Props) {
  const system = resolveEstateAssumptions(inputs.assumptions);
  const overrides = initialAdjustments?.overrides ?? {};

  const [values, setValues] = useState<Record<NumericAssumption, number>>(() => {
    const initial = {} as Record<NumericAssumption, number>;
    for (const { id } of NUMERIC_ASSUMPTIONS) initial[id] = overrides[id] ?? system[id];
    return initial;
  });
  const [spousalBequest, setSpousalBequest] = useState(
    overrides.spousalBequest ?? system.spousalBequest,
  );
  const [reason, setReason] = useState(initialAdjustments?.reason ?? '');
  const [showReasonError, setShowReasonError] = useState(false);

  const rows: FNAAssumptionRow[] = NUMERIC_ASSUMPTIONS.map(({ id, label, format }) => ({
    id,
    label,
    format,
    systemValue: system[id],
    value: values[id],
  }));

  const spousalChanged = spousalBequest !== system.spousalBequest;
  const overridden = spousalChanged || hasAssumptionOverrides(rows);

  const handleNext = () => {
    if (!isOverrideReasonValid(overridden, reason)) {
      setShowReasonError(true);
      return;
    }
    const next: EstatePlanningAdviserAdjustments['overrides'] = {};
    for (const { id } of NUMERIC_ASSUMPTIONS) {
      if (Math.abs(values[id] - system[id]) > 1e-9) next[id] = values[id];
    }
    if (spousalChanged) next.spousalBequest = spousalBequest;
    onNext({ overrides: next, reason: overridden ? reason.trim() : '' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estate Distribution</CardTitle>
          <CardDescription>
            System value: {system.spousalBequest ? 'passes to spouse' : 'does not pass to spouse'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3 max-w-md">
            <Label htmlFor="estate-spousal-bequest">
              Estate passes to a surviving spouse (section 4(q) deduction)
            </Label>
            <Switch
              id="estate-spousal-bequest"
              checked={spousalBequest}
              onCheckedChange={setSpousalBequest}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administration Cost Assumptions</CardTitle>
          <CardDescription>
            Estate duty rates (20%, 25% above R30m), the R3.5m abatement, the CGT inclusion rate and
            exclusions are statutory and fixed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FNAAssumptionOverrides
            rows={rows}
            onChange={(id, value) =>
              setValues((prev) => ({ ...prev, [id as NumericAssumption]: value }))
            }
            reason={reason}
            onReasonChange={setReason}
            reasonRequired={overridden}
            showReasonError={showReasonError}
          />
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {overridden
            ? 'The analysis will be recalculated with your overrides before you finalise it.'
            : 'No overrides — the system calculation will be carried forward unchanged.'}
        </AlertDescription>
      </Alert>

      <FNAStepNavigation step={3} onBack={onBack} onNext={handleNext} />
    </div>
  );
}
