import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { TaxPlanningInputs, TaxCalculationResults } from '../types';
import { TAX_YEAR_2026_2027 } from '../constants';
import { ArrowLeft, ArrowRight, Calculator, AlertTriangle } from 'lucide-react';
import { Progress } from '../../../../ui/progress';

interface Step2Props {
  inputs: TaxPlanningInputs;
  calculations: TaxCalculationResults;
  onNext: () => void;
  onBack: () => void;
}

export function Step2SystemCalculation({ inputs, calculations, onNext, onBack }: Step2Props) {
  
  const formatMoney = (val: number) => `R ${Math.round(val).toLocaleString()}`;
  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  // Safe percentage calculation to prevent NaN/Infinity
  const safePercent = (numerator: number, denominator: number): number => {
    if (!denominator || !isFinite(denominator) || denominator === 0) return 0;
    const result = (numerator / denominator) * 100;
    return isFinite(result) ? Math.min(result, 100) : 0;
  };

  const raUtilisation = safePercent(inputs.raContributions, calculations.maxAllowedRADeduction);
  const tfsaUtilisation = safePercent(inputs.tfsaContributionsLifetime, TAX_YEAR_2026_2027.TFSA_LIFETIME_LIMIT);

  const totalRebates = calculations.primaryRebate + calculations.secondaryRebate + calculations.tertiaryRebate;

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-3 items-center text-slate-800">
        <Calculator className="w-5 h-5 shrink-0 text-slate-600" />
        <div>
          <h4 className="font-semibold text-sm">System Auto-Calculation</h4>
          <p className="text-sm text-slate-600">
            Deterministic projection based on 2026/2027 tax tables. This is a baseline calculation without adjustments.
          </p>
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Net Tax Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{formatMoney(calculations.totalTaxLiability)}</div>
            <p className="text-xs text-muted-foreground mt-1">Includes Income Tax, Dividend Tax &amp; CGT</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-white to-slate-50">
           <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Effective Tax Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{formatPercent(calculations.effectiveTaxRate)}</div>
             <p className="text-xs text-muted-foreground mt-1">Total Tax / Gross Wealth Creation</p>
          </CardContent>
        </Card>

         <Card className={`bg-gradient-to-br from-white ${calculations.raGap > 0 ? 'to-amber-50 border-amber-200' : 'to-green-50'}`}>
           <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">RA Deduction Gap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${calculations.raGap > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {formatMoney(calculations.raGap)}
            </div>
             <p className="text-xs text-muted-foreground mt-1">Unused tax deduction capacity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Waterfall Calculation */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tax Calculation Sequence</CardTitle>
            <CardDescription>Step-by-step determination of liability (2026/2027)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="divide-y text-sm">
              
              <div className="py-3 flex justify-between items-center">
                <span className="font-medium text-slate-700">1. Gross Income Base</span>
                <span>{formatMoney(calculations.grossIncome)}</span>
              </div>
              
              <div className="py-3 flex justify-between items-center bg-green-50/50 -mx-4 px-4 text-green-700">
                <span className="flex items-center gap-2">2. Less: Interest Exemption</span>
                <span>({formatMoney(calculations.interestExemption)})</span>
              </div>
              
              <div className="py-3 flex justify-between items-center bg-green-50/50 -mx-4 px-4 text-green-700">
                <span className="flex items-center gap-2">3. Less: Retirement Annuity Deduction</span>
                <span>({formatMoney(calculations.actualRADeduction)})</span>
              </div>

               <div className="py-3 flex justify-between items-center bg-slate-50 -mx-4 px-4 font-semibold text-slate-900 border-y-2 border-slate-200">
                <span>4. Taxable Income (Final)</span>
                <span>{formatMoney(calculations.taxableIncome)}</span>
              </div>

              <div className="py-3 flex justify-between items-center">
                <span>5. Normal Tax (Before Rebates)</span>
                <span>{formatMoney(calculations.incomeTaxBeforeRebates)}</span>
              </div>

               <div className="py-3 flex justify-between items-center text-green-700">
                <span>6. Less: Rebates (Primary + Age)</span>
                <span>- {formatMoney(totalRebates)}</span>
              </div>

              <div className="py-3 flex justify-between items-center text-green-700">
                <span>7. Less: Medical Tax Credits (Section 6A)</span>
                <span>- {formatMoney(calculations.medicalTaxCredits)}</span>
              </div>

              <div className="py-3 flex justify-between items-center font-medium">
                <span>Net Income Tax Payable</span>
                <span>{formatMoney(calculations.netIncomeTax)}</span>
              </div>

               <div className="py-3 flex justify-between items-center text-slate-500">
                <span>8. Plus: Dividend Tax (20%)</span>
                <span>+ {formatMoney(calculations.dividendTax)}</span>
              </div>

               <div className="py-4 flex justify-between items-center font-bold text-lg bg-slate-100 -mx-4 px-4 rounded-b-lg">
                <span>Total Tax Liability</span>
                <span>{formatMoney(calculations.totalTaxLiability)}</span>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Right Column: Leakage & Flags */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Optimisation Gaps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* RA Gap */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">RA Utilization</span>
                  <span>{Math.round(raUtilisation)}%</span>
                </div>
                <Progress value={raUtilisation} className="h-2" />
                {calculations.raGap > 0 && (
                  <p className="text-xs text-amber-600 font-medium">
                    Unused Cap: {formatMoney(calculations.raGap)}
                    <br/>
                    Potential Saving: {formatMoney(calculations.raTaxSavingPotential)}
                  </p>
                )}
                {calculations.maxAllowedRADeduction === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No RA deduction capacity (income too low or zero)
                  </p>
                )}
              </div>

              {/* Interest Leakage */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                   <span className="font-medium">Interest Exemption</span>
                   <span className={calculations.taxableInterest > 0 ? "text-red-500" : "text-green-600"}>
                     {calculations.taxableInterest > 0 ? "Exceeded" : "Efficient"}
                   </span>
                </div>
                 {calculations.taxableInterest > 0 && (
                  <div className="bg-red-50 p-2 rounded text-xs text-red-700">
                    <span className="font-bold">Leakage:</span> You are paying marginal tax on {formatMoney(calculations.taxableInterest)} of interest.
                  </div>
                )}
              </div>

               {/* TFSA */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                   <span className="font-medium">TFSA Lifetime</span>
                   <span>{Math.round(tfsaUtilisation)}% Used</span>
                </div>
                 <Progress value={tfsaUtilisation} className="h-2" />
              </div>

              {/* Medical Credits */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Medical Credits</span>
                  <span className="text-green-600">{formatMoney(calculations.medicalTaxCredits)}/yr</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inputs.medicalSchemeMembers} member{inputs.medicalSchemeMembers !== 1 ? 's' : ''} on scheme
                </p>
              </div>

            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Adviser Note</span>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              These figures are mathematically generated based on confirmed inputs and 2026/2027 SARS tables. 
              In the next step, you can apply manual adjustments for once-off events or specific exclusions.
            </p>
          </div>
        </div>

      </div>

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inputs
        </Button>
        <Button onClick={onNext} size="lg" className="bg-primary hover:bg-primary/90">
          Proceed to Adjustments <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

    </div>
  );
}
