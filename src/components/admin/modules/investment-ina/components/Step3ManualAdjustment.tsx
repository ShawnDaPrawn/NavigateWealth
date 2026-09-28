/**
 * Investment INA — Step 3: Adviser Manual Adjustment
 *
 * The adviser may override the client's risk profile and the economic
 * assumptions the system used. Every override needs a recorded reason; the
 * wizard recalculates with the overrides before Step 4.
 */

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  FNAAssumptionOverrides,
  FNAStepNavigation,
  hasAssumptionOverrides,
  isOverrideReasonValid,
  type FNAAssumptionRow,
} from '../../fna';
import { DEFAULT_ECONOMIC_ASSUMPTIONS, RISK_PROFILE_LABELS } from '../constants';
import type {
  InvestmentINAAdviserAdjustments,
  InvestmentINAInputs,
  RiskProfile,
  RiskProfileReturns,
} from '../types';

const RETURN_PROFILES = Object.keys(RISK_PROFILE_LABELS) as RiskProfile[];

interface Step3Props {
  inputs: Partial<InvestmentINAInputs>;
  initialAdjustments?: InvestmentINAAdviserAdjustments;
  onNext: (adjustments: InvestmentINAAdviserAdjustments) => void;
  onBack: () => void;
  isCalculating?: boolean;
}

export function Step3ManualAdjustment({
  inputs,
  initialAdjustments,
  onNext,
  onBack,
  isCalculating = false,
}: Step3Props) {
  const systemInflation =
    inputs.longTermInflationRate ?? DEFAULT_ECONOMIC_ASSUMPTIONS.longTermInflationRate;
  const systemReturns =
    inputs.expectedRealReturns ?? DEFAULT_ECONOMIC_ASSUMPTIONS.expectedRealReturns;
  const systemProfile = inputs.clientRiskProfile;
  const overrides = initialAdjustments?.overrides ?? {};

  const [riskProfile, setRiskProfile] = useState<RiskProfile | undefined>(
    overrides.clientRiskProfile ?? systemProfile,
  );
  const [inflation, setInflation] = useState(overrides.longTermInflationRate ?? systemInflation);
  const [returns, setReturns] = useState<RiskProfileReturns>({
    ...systemReturns,
    ...overrides.expectedRealReturns,
  });
  const [reason, setReason] = useState(initialAdjustments?.reason ?? '');
  const [showReasonError, setShowReasonError] = useState(false);

  const rows: FNAAssumptionRow[] = [
    {
      id: 'inflation',
      label: 'Long-term inflation',
      systemValue: systemInflation,
      value: inflation,
      format: 'fraction',
      hint: 'South African long-term average is approximately 6%',
    },
    ...RETURN_PROFILES.map((profile) => ({
      id: profile,
      label: `Real return — ${RISK_PROFILE_LABELS[profile]}`,
      systemValue: systemReturns[profile],
      value: returns[profile],
      format: 'fraction' as const,
    })),
  ];

  const profileChanged = !!riskProfile && riskProfile !== systemProfile;
  const overridden = profileChanged || hasAssumptionOverrides(rows);

  const handleRowChange = (id: string, value: number) => {
    if (id === 'inflation') setInflation(value);
    else setReturns((prev) => ({ ...prev, [id]: value }));
  };

  const handleNext = () => {
    if (!isOverrideReasonValid(overridden, reason)) {
      setShowReasonError(true);
      return;
    }
    const next: InvestmentINAAdviserAdjustments['overrides'] = {};
    if (profileChanged) next.clientRiskProfile = riskProfile;
    if (Math.abs(inflation - systemInflation) > 1e-9) next.longTermInflationRate = inflation;
    if (RETURN_PROFILES.some((p) => Math.abs(returns[p] - systemReturns[p]) > 1e-9)) {
      next.expectedRealReturns = returns;
    }
    onNext({ overrides: next, reason: overridden ? reason.trim() : '' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Risk Profile</CardTitle>
          <CardDescription>
            System value: {systemProfile ? RISK_PROFILE_LABELS[systemProfile] : 'Not set'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
            <Label>Adviser risk profile</Label>
            <Select
              value={riskProfile ?? ''}
              onValueChange={(value) => setRiskProfile(value as RiskProfile)}
            >
              <SelectTrigger aria-label="Adviser risk profile">
                <SelectValue placeholder="Select risk profile" />
              </SelectTrigger>
              <SelectContent>
                {RETURN_PROFILES.map((profile) => (
                  <SelectItem key={profile} value={profile}>
                    {RISK_PROFILE_LABELS[profile]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Economic Assumptions</CardTitle>
          <CardDescription>Returns are real — after inflation</CardDescription>
        </CardHeader>
        <CardContent>
          <FNAAssumptionOverrides
            rows={rows}
            onChange={handleRowChange}
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

      <FNAStepNavigation step={3} onBack={onBack} onNext={handleNext} isBusy={isCalculating} />
    </div>
  );
}
