/**
 * Illustrative retirement projection — educational only, not advice.
 */

import React, { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import type { RetirementFNAInputs } from '@/components/admin/modules/retirement-fna';

interface RetirementIllustrativeProjectionProps {
  inputs: Partial<RetirementFNAInputs>;
}

export function RetirementIllustrativeProjection({
  inputs,
}: RetirementIllustrativeProjectionProps) {
  const projection = useMemo(() => {
    const currentAge = Number(inputs.currentAge ?? 0);
    const retirementAge = Number(inputs.retirementAge ?? 65);
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const ip = inputs as Record<string, unknown>;
    const monthlyContribution = Number(
      ip.monthlyRetirementContribution ?? ip.monthlyContribution ?? 0,
    );
    const currentFundValue = Number(ip.currentRetirementFundValue ?? ip.currentFundValue ?? 0);
    const annualReturn = 0.07;
    const monthlyReturn = annualReturn / 12;
    const months = yearsToRetirement * 12;

    let balance = currentFundValue;
    for (let i = 0; i < months; i++) {
      balance = balance * (1 + monthlyReturn) + monthlyContribution;
    }

    return {
      yearsToRetirement,
      estimatedBalance: Math.round(balance),
      monthlyContribution,
    };
  }, [inputs]);

  if (
    !projection.yearsToRetirement &&
    !projection.monthlyContribution &&
    !projection.estimatedBalance
  ) {
    return null;
  }

  return (
    <Alert className="border-amber-200 bg-amber-50">
      <Info className="h-4 w-4 text-amber-700" />
      <AlertDescription className="text-sm text-amber-900">
        <strong>Illustrative only — not advice.</strong> If you continued contributing approximately{' '}
        R{projection.monthlyContribution.toLocaleString()} per month for{' '}
        {projection.yearsToRetirement} years (assuming ~7% growth), your fund might reach roughly R
        {projection.estimatedBalance.toLocaleString()}. Your adviser will model formal scenarios
        before publishing recommendations.
      </AlertDescription>
    </Alert>
  );
}
