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

function Row({
  label,
  value,
  strong = false,
  negative = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold border-t pt-2' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">
        {negative ? '(' : ''}R{formatCurrency(value)}
        {negative ? ')' : ''}
      </span>
    </div>
  );
}

/** The executor's tariff as a percentage of the gross estate, excluding VAT. */
function executorTariffLabel(results: EstatePlanningResults): string {
  const sheet = results.deathBalanceSheet;
  const gross = sheet.grossEstateAssets.total;
  if (gross <= 0) return 'Executor fees';
  const pct = Math.round((sheet.administrationCosts.executorFees / gross) * 10000) / 100;
  return sheet.administrationCosts.executorFeesVat !== undefined
    ? `Executor fees (${pct}% + VAT)`
    : `Executor fees (${pct}%)`;
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
  const duty = sheet.estateDuty;
  const cgt = sheet.cgtOnDeath;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1">
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
            <Row label="Gross estate" value={duty.grossEstate} />
            <Row label="Less liabilities" value={duty.lessLiabilities} negative />
            <Row label="Less administration costs" value={duty.lessCosts} negative />
            {!!duty.lessCGT && <Row label="Less CGT on death" value={duty.lessCGT} negative />}
            {!!duty.addDeemedPropertyNominated && (
              <Row
                label="Add policies paid to nominated beneficiaries (deemed property)"
                value={duty.addDeemedPropertyNominated}
              />
            )}
            <Row
              label="Less spousal deduction (s4(q))"
              value={duty.lessSpousalDeduction}
              negative
            />
            <Row
              label={
                duty.portedAbatement
                  ? `Less abatement (incl. R${formatCurrency(duty.portedAbatement)} ported)`
                  : 'Less abatement'
              }
              value={duty.lessAbatement}
              negative
            />
            <Row label="Dutiable amount" value={duty.dutiableEstate} />
            {duty.dutyAtFirstRate !== undefined && (
              <Row label="Duty at 20% (first R30m)" value={duty.dutyAtFirstRate} />
            )}
            {!!duty.dutyAtUpperRate && (
              <Row label="Duty at 25% (above R30m)" value={duty.dutyAtUpperRate} />
            )}
            <Row label="Estimated estate duty" value={duty.estimatedEstateDuty} strong />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Administration costs</h4>
            <Row
              label={executorTariffLabel(results)}
              value={sheet.administrationCosts.executorFees}
            />
            {sheet.administrationCosts.executorFeesVat !== undefined && (
              <Row label="VAT on executor fees" value={sheet.administrationCosts.executorFeesVat} />
            )}
            <Row label="Conveyancing" value={sheet.administrationCosts.conveyancingFees} />
            <Row label="Master's fees" value={sheet.administrationCosts.masterFees} />
            <Row label="Funeral costs" value={sheet.administrationCosts.funeralCosts} />
            <Row label="Liquidity required" value={liquidity.liquidityRequired.total} strong />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">CGT on death</h4>
            <Row label="Gains on deemed disposal" value={cgt.totalUnrealisedGains} />
            {!!cgt.primaryResidenceExclusion && (
              <Row
                label="Less primary residence exclusion"
                value={cgt.primaryResidenceExclusion}
                negative
              />
            )}
            {!!cgt.spousalRolloverGain && (
              <Row
                label="Rolled over to surviving spouse (s9HA(2))"
                value={cgt.spousalRolloverGain}
                negative
              />
            )}
            {!!cgt.annualExclusionOnDeath && (
              <Row
                label="Less annual exclusion in year of death"
                value={cgt.annualExclusionOnDeath}
                negative
              />
            )}
            <Row label="Taxable capital gain (inclusion)" value={cgt.inclusionAmount} />
            <Row
              label={
                cgt.marginalRate !== undefined
                  ? `Estimated CGT (at ${Math.round(cgt.marginalRate * 10000) / 100}%)`
                  : 'Estimated CGT on death'
              }
              value={cgt.estimatedCGT}
              strong
            />
          </div>
        </div>

        {(!!results.assumptions?.length || !!results.advisoryNotes?.length) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            {!!results.assumptions?.length && (
              <div className="space-y-2">
                <h4 className="font-semibold">Assumptions</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {results.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!results.advisoryNotes?.length && (
              <div className="space-y-2">
                <h4 className="font-semibold">Check before advising</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {results.advisoryNotes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
