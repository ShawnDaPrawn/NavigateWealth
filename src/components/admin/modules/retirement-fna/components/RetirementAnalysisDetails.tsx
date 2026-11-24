/**
 * Retirement FNA — the engine v2 detail shared by Step 2, Step 4 and the
 * published results view: today's-money figures, how the target and the
 * projected capital are made up, the drawdown the capital implies, the s11F
 * check and the assumption notes.
 *
 * Every field it reads is optional: FNAs published before engine v2 do not
 * carry them, and for those this renders nothing.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { AlertTriangle, CheckCircle2, Info, Landmark } from 'lucide-react';
import { formatCurrency } from '../../../../../utils/currencyFormatter';
import type { RetirementCalculationResults } from '../types';
import { RETIREMENT_DRAWDOWN, RETIREMENT_S11F } from '../utils/calculation-engine';

interface RetirementAnalysisDetailsProps {
  results: RetirementCalculationResults;
}

function pct(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
    >
      <span>{label}</span>
      <span className={strong ? '' : 'font-medium text-foreground'}>{value}</span>
    </div>
  );
}

export function RetirementAnalysisDetails({ results }: RetirementAnalysisDetailsProps) {
  const r = results;
  const hasToday = r.targetMonthlyIncomeToday !== undefined;
  const hasBreakdown = r.monthlyIncomeFromCapital !== undefined;
  const hasDrawdown = r.drawdownStatus !== undefined;
  const hasS11F = r.deductibleContributionLimit !== undefined;
  if (!hasToday && !hasBreakdown && !hasDrawdown && !hasS11F && !r.assumptionNotes?.length) {
    return null;
  }

  const shortfallToday = r.capitalShortfallToday ?? 0;

  return (
    <div className="space-y-6">
      {r.incomeBasis === 'net' && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm text-yellow-900">
            Gross income was not captured, so the target is based on net income. This understates
            the capital needed — capture gross income for a reliable figure.
          </AlertDescription>
        </Alert>
      )}

      {hasToday && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">In Today's Money</CardTitle>
            <CardDescription>
              The figures above are in future rands at retirement. Deflated by{' '}
              {r.inflationRate !== undefined ? pct(r.inflationRate) : 'inflation'} p.a. over{' '}
              {r.yearsToRetirement} years, they are worth:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Target monthly income</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(r.targetMonthlyIncomeToday ?? 0)}
                </p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Required capital</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(r.requiredCapitalToday ?? 0)}
                </p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Projected capital</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(r.projectedCapitalToday ?? 0)}
                </p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  {shortfallToday > 0 ? 'Shortfall' : 'Surplus'}
                </p>
                <p className="text-lg font-semibold">{formatCurrency(Math.abs(shortfallToday))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasBreakdown && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Income the Capital Must Fund</CardTitle>
              <CardDescription>Monthly, at retirement (future rands)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label={`Target (${r.replacementRatio !== undefined ? pct(r.replacementRatio, 0) : ''} of ${r.incomeBasis === 'net' ? 'net' : 'gross'} income)`}
                value={formatCurrency(r.targetMonthlyIncome)}
              />
              <Row
                label="Less other guaranteed income"
                value={`− ${formatCurrency(r.otherMonthlyIncomeAtRetirement ?? 0)}`}
              />
              <Row
                label="From retirement capital"
                value={formatCurrency(r.monthlyIncomeFromCapital ?? 0)}
                strong
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Projected Capital Make-up</CardTitle>
              <CardDescription>At retirement (future rands)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label="Current retirement savings, grown"
                value={formatCurrency(r.projectedRetirementSavings ?? 0)}
              />
              <Row
                label="Other earmarked capital, grown"
                value={formatCurrency(r.projectedOtherCapital ?? 0)}
              />
              <Row
                label={`Contributions${r.premiumEscalation !== undefined ? ` (escalating ${pct(r.premiumEscalation)} p.a.)` : ''}`}
                value={formatCurrency(r.projectedContributions ?? 0)}
              />
              <Row label="Projected capital" value={formatCurrency(r.projectedCapital)} strong />
            </CardContent>
          </Card>
        </div>
      )}

      {hasDrawdown && r.drawdownStatus !== 'not-required' && (
        <Alert
          className={
            r.drawdownStatus === 'sustainable'
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }
        >
          {r.drawdownStatus === 'sustainable' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle
            className={r.drawdownStatus === 'sustainable' ? 'text-green-900' : 'text-red-900'}
          >
            {r.initialDrawdownRate === null || r.initialDrawdownRate === undefined
              ? 'No capital projected to fund the income'
              : `Initial drawdown: ${pct(r.initialDrawdownRate)} p.a.`}
          </AlertTitle>
          <AlertDescription
            className={`text-sm ${r.drawdownStatus === 'sustainable' ? 'text-green-800' : 'text-red-800'}`}
          >
            {r.drawdownStatus === 'sustainable' &&
              `The projected capital supports the required income at or below ${pct(RETIREMENT_DRAWDOWN.SUSTAINABLE_MAX, 0)} p.a., a sustainable living annuity drawdown.`}
            {r.drawdownStatus === 'high' &&
              `Above ${pct(RETIREMENT_DRAWDOWN.SUSTAINABLE_MAX, 0)} p.a. a living annuity is at high risk of running out during retirement. The regulatory range is ${pct(RETIREMENT_DRAWDOWN.LIVING_ANNUITY_MIN)}–${pct(RETIREMENT_DRAWDOWN.LIVING_ANNUITY_MAX)}.`}
            {r.drawdownStatus === 'exceeds-maximum' &&
              `The required income cannot be drawn from the projected capital within the living annuity maximum of ${pct(RETIREMENT_DRAWDOWN.LIVING_ANNUITY_MAX)} p.a.`}
          </AlertDescription>
        </Alert>
      )}

      {hasS11F && (
        <Card className={r.exceedsDeductibleLimit ? 'border-yellow-200 bg-yellow-50/50' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Tax Deductibility (s11F)
            </CardTitle>
            <CardDescription>
              27.5% of income, capped at {formatCurrency(RETIREMENT_S11F.ANNUAL_CAP)} p.a. —
              pension, provident and RA combined, including employer contributions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Recommended contributions (first year)"
              value={formatCurrency(r.annualRecommendedContribution ?? 0)}
            />
            <Row
              label="Deductible limit"
              value={formatCurrency(r.deductibleContributionLimit ?? 0)}
            />
            <Row
              label="Not deductible this year"
              value={formatCurrency(r.contributionAboveDeductibleLimit ?? 0)}
              strong
            />
            {r.exceedsDeductibleLimit && (
              <p className="text-xs text-yellow-800 pt-1">
                Contributions above the limit carry forward to later years or reduce tax on
                retirement lump sums, but give no deduction now. Consider funding the excess in a
                tax-free savings account or discretionary investment.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!!r.assumptionNotes?.length && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Basis of this analysis</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-1 text-sm list-disc pl-4">
              {r.assumptionNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
