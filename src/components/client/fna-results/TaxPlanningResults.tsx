/**
 * Client-Side Tax Planning FNA Results Display
 * Read-only view of published Tax Planning Analysis
 * 
 * Data source: /supabase/functions/server/tax-planning-fna-routes.tsx
 * Uses "finalResults" (not "results") and typed TaxPlanningInputs
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { 
  FileText, 
  TrendingDown,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Info,
  PieChart,
  Lightbulb,
  Calculator
} from 'lucide-react';
import { TaxPlanningFNA, formatCurrency } from '../../../services/fna-api';

interface TaxPlanningResultsProps {
  fna: TaxPlanningFNA;
}

export function TaxPlanningResults({ fna }: TaxPlanningResultsProps) {
  const { finalResults, inputs, recommendations, adviserNotes } = fna;

  // Guard against missing data
  if (!finalResults) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-900">Tax calculation results are not yet available for this analysis.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-orange-600">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 mb-2">Tax Planning Analysis Summary</h3>
              <p className="text-sm text-gray-700 mb-4">
                Comprehensive tax exposure analysis with optimization strategies 
                based on {inputs.age >= 65 ? 'senior' : 'standard'} tax tables for South African residents.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg border border-orange-100">
                  <p className="text-xs text-gray-600 mb-1">Gross Income</p>
                  <p className="text-gray-900">{formatCurrency(finalResults.grossIncome)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-orange-100">
                  <p className="text-xs text-gray-600 mb-1">Taxable Income</p>
                  <p className="text-gray-900">{formatCurrency(finalResults.taxableIncome)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-orange-100">
                  <p className="text-xs text-gray-600 mb-1">Total Tax Liability</p>
                  <p className="text-gray-900">{formatCurrency(finalResults.totalTaxLiability)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-orange-100">
                  <p className="text-xs text-gray-600 mb-1">Effective Rate</p>
                  <p className="text-gray-900">
                    {(finalResults.effectiveTaxRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Calculation Breakdown */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base">Tax Calculation Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-gray-600 mb-1">Total Tax Liability</p>
              <p className="text-xl text-gray-900">
                {formatCurrency(finalResults.totalTaxLiability)}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-xs text-gray-600 mb-1">Effective Tax Rate</p>
              <p className="text-xl text-gray-900">
                {(finalResults.effectiveTaxRate * 100).toFixed(2)}%
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-gray-600 mb-1">Net Income Tax</p>
              <p className="text-xl text-gray-900">
                {formatCurrency(finalResults.netIncomeTax)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Detailed breakdown */}
          <div className="space-y-2">
            <p className="text-xs text-gray-700">
              <strong>Detailed Tax Computation:</strong>
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Gross Income</span>
                <span className="text-gray-900">{formatCurrency(finalResults.grossIncome)}</span>
              </div>
              {finalResults.actualRADeduction > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Less: RA Deduction</span>
                  <span className="text-green-700">({formatCurrency(finalResults.actualRADeduction)})</span>
                </div>
              )}
              {finalResults.taxableInterest > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Add: Taxable Interest (above exemption)</span>
                  <span className="text-gray-900">{formatCurrency(finalResults.taxableInterest)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-900">Taxable Income</span>
                <span className="text-gray-900">{formatCurrency(finalResults.taxableIncome)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Income Tax Before Rebates</span>
                <span className="text-gray-900">{formatCurrency(finalResults.incomeTaxBeforeRebates)}</span>
              </div>
              {finalResults.primaryRebate > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Less: Primary Rebate</span>
                  <span className="text-green-700">({formatCurrency(finalResults.primaryRebate)})</span>
                </div>
              )}
              {finalResults.secondaryRebate > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Less: Secondary Rebate (age 65+)</span>
                  <span className="text-green-700">({formatCurrency(finalResults.secondaryRebate)})</span>
                </div>
              )}
              {finalResults.tertiaryRebate > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Less: Tertiary Rebate (age 75+)</span>
                  <span className="text-green-700">({formatCurrency(finalResults.tertiaryRebate)})</span>
                </div>
              )}
              {(finalResults.medicalTaxCredits ?? 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Less: Medical Tax Credits (Section 6A)</span>
                  <span className="text-green-700">({formatCurrency(finalResults.medicalTaxCredits)})</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-900">Net Income Tax</span>
                <span className="text-gray-900">{formatCurrency(finalResults.netIncomeTax)}</span>
              </div>
              {finalResults.dividendTax > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Dividend Withholding Tax</span>
                  <span className="text-gray-900">{formatCurrency(finalResults.dividendTax)}</span>
                </div>
              )}
              {finalResults.cgtPayable > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Capital Gains Tax</span>
                  <span className="text-gray-900">{formatCurrency(finalResults.cgtPayable)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-900">Total Tax Liability</span>
                <span className="text-red-700">{formatCurrency(finalResults.totalTaxLiability)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income Streams */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-600">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base">Income Streams</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {inputs.employmentIncome > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Employment Income</span>
                <span className="text-gray-900">{formatCurrency(inputs.employmentIncome)}</span>
              </div>
            )}
            {inputs.variableIncome > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Variable Income (Commission/Bonuses)</span>
                <span className="text-gray-900">{formatCurrency(inputs.variableIncome)}</span>
              </div>
            )}
            {inputs.businessIncome > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Business Income</span>
                <span className="text-gray-900">{formatCurrency(inputs.businessIncome)}</span>
              </div>
            )}
            {inputs.rentalIncome > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Rental Income</span>
                <span className="text-gray-900">{formatCurrency(inputs.rentalIncome)}</span>
              </div>
            )}
            {inputs.interestIncome > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Interest Income</span>
                <span className="text-gray-900">{formatCurrency(inputs.interestIncome)}</span>
              </div>
            )}
            {inputs.dividendIncome > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Dividend Income</span>
                <span className="text-gray-900">{formatCurrency(inputs.dividendIncome)}</span>
              </div>
            )}
            {inputs.foreignIncome > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Foreign Income</span>
                <span className="text-gray-900">{formatCurrency(inputs.foreignIncome)}</span>
              </div>
            )}
            {inputs.capitalGainsRealised > 0 && (
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Capital Gains Realised</span>
                <span className="text-gray-900">{formatCurrency(inputs.capitalGainsRealised)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tax-Advantaged Contributions */}
      {(inputs.raContributions > 0 || finalResults.raGap > 0) && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-600">
                <PieChart className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Tax-Advantaged Contributions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-900">RA Contributions</p>
                    <p className="text-xs text-gray-600">
                      Max deductible: {formatCurrency(finalResults.maxAllowedRADeduction)} | 
                      Actual deduction: {formatCurrency(finalResults.actualRADeduction)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-900">
                    {formatCurrency(inputs.raContributions)}
                  </p>
                </div>
              </div>

              {finalResults.raGap > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-900">Unused RA Deduction Capacity</p>
                      <p className="text-xs text-gray-600">
                        You have {formatCurrency(finalResults.raGap)} in unused RA deduction capacity. 
                        Maximizing this could save you approximately {formatCurrency(finalResults.raTaxSavingPotential)} in tax.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {finalResults.interestTaxLeakage > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-900">Interest Tax Leakage</p>
                      <p className="text-xs text-gray-600">
                        You are paying {formatCurrency(finalResults.interestTaxLeakage)} in tax on interest above exemption. 
                        Consider redirecting to a TFSA ({formatCurrency(finalResults.tfsaRemainingLifetime)} lifetime capacity remaining).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-600">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-base">Tax Planning Recommendations</CardTitle>
              </div>
              {finalResults.raTaxSavingPotential > 0 && (
                <Badge className="bg-green-600 hover:bg-green-700">
                  Potential Savings: {formatCurrency(finalResults.raTaxSavingPotential)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-4 bg-teal-50 rounded-lg border border-teal-100">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 mb-1">
                      <strong>{rec.title}</strong>
                    </p>
                    <p className="text-xs text-gray-600 mb-2">{rec.description}</p>
                    <div className="flex items-center gap-2">
                      {rec.impactValue > 0 && (
                        <Badge variant="outline" className="bg-white">
                          Impact: {formatCurrency(rec.impactValue)}
                        </Badge>
                      )}
                      <Badge 
                        variant={rec.status === 'accepted' ? 'default' : 'outline'}
                        className="capitalize"
                      >
                        {rec.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Adviser Notes */}
      {adviserNotes && adviserNotes.trim() !== '' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 mb-2"><strong>Adviser Notes:</strong></p>
                <p className="text-xs text-blue-800 whitespace-pre-wrap">{adviserNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Notes */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="mb-2">
                <strong>Important Notes:</strong>
              </p>
              <ul className="space-y-1 text-xs">
                <li>- This analysis is based on current South African tax legislation and your disclosed income.</li>
                <li>- Tax laws are subject to change. Annual reviews are essential to maintain tax efficiency.</li>
                <li>- Always maintain proper documentation for all tax deductions and credits claimed.</li>
                <li>- Some optimization strategies require advance planning (e.g., retirement contributions).</li>
                <li>- Consult with a registered tax practitioner before implementing tax strategies.</li>
                <li>- This analysis is for planning purposes and does not constitute tax advice or SARS submissions.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}