import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Lock,
  Calendar
} from 'lucide-react';
import { FinalTaxPlan } from '../types';

interface TaxPlanningResultsViewProps {
  plan: FinalTaxPlan;
}

export function TaxPlanningResultsView({ plan }: TaxPlanningResultsViewProps) {
  if (!plan) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No tax plan data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { inputs, finalResults, recommendations, adjustments, adviserNotes, generatedAt } = plan;

  const formatMoney = (val: number) => `R ${Math.round(val).toLocaleString()}`;
  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  const acceptedRecs = recommendations.filter(r => r.status === 'accepted');
  const rejectedRecs = recommendations.filter(r => r.status === 'rejected');

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* 1. HEADER & META */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tax Planning Record of Advice</h1>
          <p className="text-slate-500">Generated on {new Date(generatedAt).toLocaleDateString()} at {new Date(generatedAt).toLocaleTimeString()}</p>
        </div>
        <Badge variant="outline" className="text-slate-600 border-slate-300">
          {(inputs as Record<string, unknown>).taxYear as string || `${new Date(generatedAt).getFullYear()}/${new Date(generatedAt).getFullYear() + 1}`} Tax Year
        </Badge>
      </div>

      {/* 2. EXECUTIVE SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Gross Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatMoney(finalResults.grossIncome)}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
           <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Net Tax Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatMoney(finalResults.totalTaxLiability)}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
           <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Effective Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatPercent(finalResults.effectiveTaxRate)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 3. ADVICE & RECOMMENDATIONS */}
      <Card className="border-green-200 shadow-sm">
        <CardHeader className="bg-green-50/50 border-b border-green-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-700" />
            <CardTitle className="text-green-900">Adviser Recommendations</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {acceptedRecs.length === 0 ? (
            <p className="text-slate-500 italic">No specific recommendations were included in this record.</p>
          ) : (
            <div className="grid gap-4">
              {acceptedRecs.map(rec => (
                <div key={rec.id} className="flex gap-4 p-4 border rounded-lg bg-white">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-slate-900">{rec.title}</h4>
                    <p className="text-slate-600 text-sm mt-1">{rec.description}</p>
                    {rec.impactValue > 0 && (
                      <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                        Potential Saving: {formatMoney(rec.impactValue)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {rejectedRecs.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <h5 className="text-sm font-semibold text-slate-500 mb-3">Considered but Excluded</h5>
              <ul className="space-y-2">
                {rejectedRecs.map(rec => (
                  <li key={rec.id} className="text-sm text-slate-400 flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                     {rec.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. FINANCIAL DETAIL (MATH) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-slate-700" />
            <CardTitle>Tax Calculation Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="divide-y text-sm">
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Employment Income</span>
              <span>{formatMoney(inputs.employmentIncome)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Variable / Bonus</span>
              <span>{formatMoney(inputs.variableIncome)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Business / Rental / Other</span>
              <span>{formatMoney(inputs.businessIncome + inputs.rentalIncome + inputs.foreignIncome)}</span>
            </div>
             <div className="py-2 flex justify-between font-medium bg-slate-50 px-2 -mx-2">
              <span className="text-slate-900">Total Gross Income</span>
              <span>{formatMoney(finalResults.grossIncome)}</span>
            </div>
            
             <div className="py-2 flex justify-between text-slate-500">
              <span>Less: Deductions (RA + Exemptions)</span>
              <span>- {formatMoney(finalResults.interestExemption + finalResults.actualRADeduction)}</span>
            </div>
            
            <div className="py-2 flex justify-between font-bold text-slate-900 border-t border-slate-200 mt-2 pt-2">
              <span>Taxable Income</span>
              <span>{formatMoney(finalResults.taxableIncome)}</span>
            </div>

             <div className="py-2 flex justify-between text-slate-500">
              <span>Normal Tax (Before Rebates)</span>
              <span>{formatMoney(finalResults.incomeTaxBeforeRebates)}</span>
            </div>
             <div className="py-2 flex justify-between text-green-600">
              <span>Less: Rebates</span>
              <span>- {formatMoney(finalResults.primaryRebate + finalResults.secondaryRebate + finalResults.tertiaryRebate)}</span>
            </div>
            {(finalResults.medicalTaxCredits ?? 0) > 0 && (
             <div className="py-2 flex justify-between text-green-600">
              <span>Less: Medical Tax Credits (Section 6A)</span>
              <span>- {formatMoney(finalResults.medicalTaxCredits)}</span>
            </div>
            )}
             <div className="py-2 flex justify-between text-slate-500">
              <span>Plus: Specific Taxes (Div + CGT)</span>
              <span>+ {formatMoney(finalResults.dividendTax)}</span>
            </div>

            <div className="py-3 flex justify-between font-bold text-lg text-slate-900 border-t border-double border-slate-300 mt-2">
              <span>Final Tax Liability</span>
              <span>{formatMoney(finalResults.totalTaxLiability)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. AUDIT TRAIL */}
      {(adjustments.length > 0 || adviserNotes) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700" />
              <CardTitle className="text-amber-900 text-base">Compliance & Adjustments</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             {adjustments.length > 0 && (
               <div>
                 <h5 className="text-xs font-bold text-amber-800 uppercase mb-2">Scenario Adjustments Applied</h5>
                 <ul className="space-y-1">
                   {adjustments.map(adj => (
                     <li key={adj.id} className="text-sm text-amber-900 flex justify-between border-b border-amber-200/50 pb-1 last:border-0">
                       <span>{adj.field}</span>
                       <span className="font-mono text-xs">
                         {formatMoney(Number(adj.originalValue))} &rarr; {formatMoney(Number(adj.newValue))}
                       </span>
                     </li>
                   ))}
                 </ul>
               </div>
             )}

             {adviserNotes && (
               <div className="pt-2">
                  <h5 className="text-xs font-bold text-amber-800 uppercase mb-1">Adviser Notes</h5>
                  <p className="text-sm text-amber-900 italic">"{adviserNotes}"</p>
               </div>
             )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}