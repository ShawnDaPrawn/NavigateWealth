import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../../ui/card';
import { Separator } from '../../../../../ui/separator';
import { formatCurrency } from '../../utils';
import { LIFE_COVER } from '../../constants';
import type { LifeCoverCalculation } from '../../types';

const pct = (decimal: number) => `${Math.round(decimal * 10_000) / 100}%`;

const BASIS_LABEL = {
  'household-expenditure': 'Household expenditure less spouse income',
  'income-replacement-ratio': 'Share of net income',
  'no-dependants': 'No dependants — no income to replace',
} as const;

interface LifeCoverResultProps {
  calculation: LifeCoverCalculation;
}

export function LifeCoverResult({ calculation }: LifeCoverResultProps) {
  const {
    immediateCapital,
    incomeReplacementCapital,
    educationCapital,
    grossNeed,
    existingCover,
    netShortfall,
    assumptions,
    totalCapitalNeed,
    liquidAssetsOffset,
  } = calculation;
  // Calculations from before system version 3.0.0 have no breakdown fields.
  const isCapitalNeeds = incomeReplacementCapital.basis !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Life Cover (Death) – Capital Needs Analysis
        </CardTitle>
        <CardDescription className="text-sm">Gross need calculation breakdown</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Immediate Capital */}
        <div>
          <h4 className="text-base font-semibold mb-3">1. Immediate Capital</h4>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding Debt</span>
              <span className="font-medium">
                {formatCurrency(immediateCapital.outstandingDebt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Funeral & Final Expenses</span>
              <span className="font-medium">
                {formatCurrency(immediateCapital.funeralFinalExpenses)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Estate Costs ({pct(LIFE_COVER.ESTATE_COSTS_PERCENTAGE)}: executor's fee + VAT)
              </span>
              <span className="font-medium">{formatCurrency(immediateCapital.estateCosts)}</span>
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total Immediate Capital</span>
              <span>{formatCurrency(immediateCapital.total)}</span>
            </div>
          </div>
        </div>

        {/* Income Replacement Capital */}
        <div>
          <h4 className="text-base font-semibold mb-3">2. Income Replacement Capital</h4>
          <div className="space-y-2.5 text-sm">
            {isCapitalNeeds ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Basis</span>
                  <span className="font-medium">
                    {BASIS_LABEL[incomeReplacementCapital.basis ?? 'no-dependants']}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Yearly Income Need</span>
                  <span className="font-medium">
                    {formatCurrency(incomeReplacementCapital.annualIncomeNeed ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provision Term</span>
                  <span className="font-medium">
                    {incomeReplacementCapital.provisionTerm ?? 0} years
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Equivalent Multiple of Net Income</span>
                  <span className="font-medium">{incomeReplacementCapital.incomeMultiple}×</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net Annual Income</span>
                  <span className="font-medium">
                    {formatCurrency(incomeReplacementCapital.netAnnualIncome)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income Multiple</span>
                  <span className="font-medium">{incomeReplacementCapital.incomeMultiple}×</span>
                </div>
              </>
            )}
            <Separator className="my-3" />
            <div className="flex justify-between font-semibold text-base">
              <span>Income Capital Required (present value)</span>
              <span>{formatCurrency(incomeReplacementCapital.total)}</span>
            </div>
          </div>
        </div>

        {/* Education Capital */}
        <div>
          <h4 className="text-base font-semibold mb-3">3. Education Capital</h4>
          {educationCapital.perDependant.length > 0 ? (
            <div className="space-y-2.5 text-sm">
              {educationCapital.perDependant.map((dep) => (
                <div key={dep.dependantId} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {dep.relationship} ({dep.dependencyTerm} years)
                  </span>
                  <span className="font-medium">{formatCurrency(dep.total)}</span>
                </div>
              ))}
              <Separator className="my-3" />
              <div className="flex justify-between font-semibold text-base">
                <span>Total Education Capital</span>
                <span>{formatCurrency(educationCapital.total)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No dependants</p>
          )}
        </div>

        <Separator className="my-4" />

        {/* Total Life Cover */}
        <div className="space-y-2">
          {totalCapitalNeed !== undefined && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Capital Need</span>
                <span>{formatCurrency(totalCapitalNeed)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less Liquid Assets Available</span>
                <span>({formatCurrency(liquidAssetsOffset ?? 0)})</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-semibold">
            <span>Gross Life Cover Need</span>
            <span className="text-primary">{formatCurrency(grossNeed)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Existing Cover (Personal)</span>
            <span>{formatCurrency(existingCover.personal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Existing Cover (Group)</span>
            <span>{formatCurrency(existingCover.group)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Net Shortfall</span>
            <span className={netShortfall > 0 ? 'text-destructive' : 'text-green-600'}>
              {formatCurrency(netShortfall)}
            </span>
          </div>
        </div>

        {/* Assumptions */}
        <div className="mt-4 p-3 bg-muted/50 rounded-md">
          <p className="text-xs font-medium mb-2">Assumptions:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {assumptions.map((assumption, idx) => (
              <li key={idx}>• {assumption}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
