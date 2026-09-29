/**
 * Estate Planning — results summary shared by Step 2 (system) and Step 4 (final).
 */

import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import type { EstatePlanningResults } from '../types';
import { formatCurrency } from '../utils';

const LIQUIDITY_LABELS: Record<
  EstatePlanningResults['liquidityAnalysis']['liquidityRisk'],
  string
> = {
  none: 'No shortfall',
  moderate: 'Moderate risk',
  severe: 'Severe risk',
};

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold border-t pt-2' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">R{formatCurrency(value)}</span>
    </div>
  );
}

export function EstateResultsSummary({
  results,
  title,
  description,
}: {
  results: EstatePlanningResults;
  title: string;
  description: string;
}) {
  const { deathBalanceSheet: sheet, liquidityAnalysis: liquidity, structuralRisks } = results;
  const highRisks = structuralRisks.filter((r) => r.severity === 'high');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Gross Estate</p>
            <p className="text-lg font-semibold">
              R{formatCurrency(results.executiveSummary.grossEstateValue)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Net Estate for Heirs</p>
            <p className="text-lg font-semibold">R{formatCurrency(sheet.netEstateForHeirs)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Liquidity Shortfall</p>
            <p
              className={`text-lg font-semibold ${
                liquidity.liquidityShortfall > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              R{formatCurrency(liquidity.liquidityShortfall)}
            </p>
            <Badge variant="outline">{LIQUIDITY_LABELS[liquidity.liquidityRisk]}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">High-severity Risks</p>
            <p className="text-lg font-semibold">{highRisks.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold">Estate duty</h4>
            <Row label="Gross estate" value={sheet.estateDuty.grossEstate} />
            <Row label="Less liabilities" value={sheet.estateDuty.lessLiabilities} />
            <Row label="Less administration costs" value={sheet.estateDuty.lessCosts} />
            <Row label="Less abatement" value={sheet.estateDuty.lessAbatement} />
            <Row label="Less spousal deduction" value={sheet.estateDuty.lessSpousalDeduction} />
            <Row
              label="Estimated estate duty"
              value={sheet.estateDuty.estimatedEstateDuty}
              strong
            />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Administration costs & CGT</h4>
            <Row label="Executor fees" value={sheet.administrationCosts.executorFees} />
            <Row label="Conveyancing" value={sheet.administrationCosts.conveyancingFees} />
            <Row label="Master's fees" value={sheet.administrationCosts.masterFees} />
            <Row label="Funeral costs" value={sheet.administrationCosts.funeralCosts} />
            <Row label="Estimated CGT on death" value={sheet.cgtOnDeath.estimatedCGT} />
            <Row label="Liquidity required" value={liquidity.liquidityRequired.total} strong />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
