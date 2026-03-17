/**
 * Client-Side Medical FNA Results Display
 * Read-only view of published Medical Needs Analysis
 * 
 * Data source: /supabase/functions/server/medical-fna-routes.tsx
 * Backend stores inputs with nested structures: currentPlan, healthNeeds, preferences
 * Results use: hospitalCover, dayToDayCare, chronicCover, affordability
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { 
  Heart, 
  Activity,
  Pill,
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { MedicalFNA, formatCurrency } from '../../../services/fna-api';

interface MedicalResultsProps {
  fna: MedicalFNA;
}

export function MedicalResults({ fna }: MedicalResultsProps) {
  const { results, inputs } = fna;

  // Safely access nested input structures
  const currentPlan = inputs?.currentPlan;
  const healthNeeds = inputs?.healthNeeds;
  const preferences = inputs?.preferences;

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <Card className="border-red-200 bg-gradient-to-r from-red-50 to-pink-50">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-600">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 mb-2">Medical Needs Analysis Summary</h3>
              <p className="text-sm text-gray-700 mb-4">
                Comprehensive assessment of your medical aid scheme coverage, gap analysis, and recommendations 
                for optimal healthcare protection.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg border border-red-100">
                  <p className="text-xs text-gray-600 mb-1">Client Age</p>
                  <p className="text-gray-900">{inputs?.clientAge || 0} years</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-100">
                  <p className="text-xs text-gray-600 mb-1">Dependants</p>
                  <p className="text-gray-900">{inputs?.dependants?.length || 0}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-100">
                  <p className="text-xs text-gray-600 mb-1">Medical Scheme</p>
                  <p className="text-gray-900 text-xs">{currentPlan?.schemeName || 'Not specified'}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-100">
                  <p className="text-xs text-gray-600 mb-1">Monthly Premium</p>
                  <p className="text-gray-900">{formatCurrency(currentPlan?.monthlyPremium || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Medical Scheme Details */}
      {currentPlan && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-600">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Current Medical Scheme</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Scheme Provider</p>
                <p className="text-gray-900">{currentPlan.schemeName || 'Not specified'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Plan Option</p>
                <p className="text-gray-900">{currentPlan.planOptionName || 'Not specified'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Monthly Premium</p>
                <p className="text-gray-900">{formatCurrency(currentPlan.monthlyPremium || 0)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Plan Type</p>
                <p className="text-gray-900 capitalize">{currentPlan.planType || 'Not specified'}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-600 mb-1">Dependants Covered</p>
                <p className="text-gray-900">{currentPlan.dependantsCovered || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Hospital Benefit Level</p>
                <p className="text-gray-900">{currentPlan.hospitalBenefitLevel || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Medical Savings Account</p>
                <p className="text-gray-900">
                  {currentPlan.hasMedicalSavingsAccount ? `Yes (${formatCurrency(currentPlan.msaAmountAnnual || 0)}/yr)` : 'No'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Chronic Cover Level</p>
                <p className="text-gray-900">{currentPlan.chronicCoverLevel || 'N/A'}</p>
              </div>
            </div>

            {currentPlan.hasGapCover && (
              <div className="contents">
                <Separator />
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-900 mb-1">Gap Cover</p>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{currentPlan.gapCoverProvider || 'Provider not specified'} - {currentPlan.gapCoverType || 'Standard'}</span>
                    <span>{formatCurrency(currentPlan.gapCoverMonthlyPremium || 0)}/mo</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hospital Cover Analysis */}
      {results?.hospitalCover && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-base">Hospital Cover Analysis</CardTitle>
              </div>
              <Badge 
                variant={results.hospitalCover.hospitalBenefitAdequacy === 'adequate' ? 'default' : 'destructive'}
                className="capitalize"
              >
                {results.hospitalCover.hospitalBenefitAdequacy}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Required Tier</p>
                <p className="text-lg text-gray-900">Tier {results.hospitalCover.requiredTier}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Network Adequacy</p>
                <p className="text-lg text-gray-900 capitalize">{results.hospitalCover.networkAdequacy}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Specialist Reimbursement Risk</p>
                <p className="text-lg text-gray-900 capitalize">{results.hospitalCover.specialistReimbursementRisk}</p>
              </div>
            </div>

            {results.hospitalCover.requiredTierRationale && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-gray-700">{results.hospitalCover.requiredTierRationale}</p>
              </div>
            )}

            {results.hospitalCover.gapCoverNecessity !== 'not-needed' && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900 mb-1">
                      Gap Cover: <span className="capitalize">{results.hospitalCover.gapCoverNecessity}</span>
                    </p>
                    <p className="text-xs text-gray-600">{results.hospitalCover.gapCoverRationale}</p>
                  </div>
                </div>
              </div>
            )}

            {results.hospitalCover.recommendations && results.hospitalCover.recommendations.length > 0 && (
              <div className="space-y-2">
                {results.hospitalCover.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle className="h-3 w-3 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Day-to-Day Care Analysis */}
      {results?.dayToDayCare && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-600">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-base">Day-to-Day Care Analysis</CardTitle>
              </div>
              <Badge 
                variant={results.dayToDayCare.adequacyScore === 'adequate' ? 'default' : 'destructive'}
                className="capitalize"
              >
                {results.dayToDayCare.adequacyScore}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs text-gray-600 mb-1">Total Expected Annual Cost</p>
                <p className="text-xl text-gray-900">
                  {formatCurrency(results.dayToDayCare.totalExpectedDayToDayCost)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-gray-600 mb-1">MSA Allowance</p>
                <p className="text-xl text-gray-900">
                  {formatCurrency(results.dayToDayCare.currentMSAAllowance)}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-xs text-gray-600 mb-1">Projected Out-of-Pocket</p>
                <p className="text-xl text-gray-900">
                  {formatCurrency(results.dayToDayCare.projectedOutOfPocketCost)}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs text-gray-700">
                <strong>Expected Annual Healthcare Costs:</strong>
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">GP Visits</span>
                  <span className="text-gray-900">{formatCurrency(results.dayToDayCare.expectedAnnualGPCost)}</span>
                </div>
                <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Specialist Visits</span>
                  <span className="text-gray-900">{formatCurrency(results.dayToDayCare.expectedAnnualSpecialistCost)}</span>
                </div>
                <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Dental</span>
                  <span className="text-gray-900">{formatCurrency(results.dayToDayCare.expectedAnnualDentistCost)}</span>
                </div>
                <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Optometry</span>
                  <span className="text-gray-900">{formatCurrency(results.dayToDayCare.expectedAnnualOptometryCost)}</span>
                </div>
                {results.dayToDayCare.expectedAnnualChronicMedication > 0 && (
                  <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">Chronic Medication</span>
                    <span className="text-gray-900">{formatCurrency(results.dayToDayCare.expectedAnnualChronicMedication)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Other Costs</span>
                  <span className="text-gray-900">{formatCurrency(results.dayToDayCare.expectedAnnualOtherCosts)}</span>
                </div>
              </div>
            </div>

            {results.dayToDayCare.recommendations && results.dayToDayCare.recommendations.length > 0 && (
              <div className="contents">
                <Separator />
                <div className="space-y-2">
                  {results.dayToDayCare.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                      <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chronic Cover Analysis */}
      {results?.chronicCover && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-600">
                  <Pill className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-base">Chronic Cover Analysis</CardTitle>
              </div>
              <Badge 
                variant={results.chronicCover.chronicCoverAdequacy === 'excellent' ? 'default' : 'destructive'}
                className="capitalize"
              >
                {results.chronicCover.chronicCoverAdequacy}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Chronic Conditions</p>
                <p className="text-lg text-gray-900">
                  {results.chronicCover.hasChronicConditions 
                    ? `${results.chronicCover.chronicConditionsList.length} condition${results.chronicCover.chronicConditionsList.length !== 1 ? 's' : ''}` 
                    : 'None'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">PMB Qualifying</p>
                <p className="text-lg text-gray-900">{results.chronicCover.isPMBQualifying ? 'Yes' : 'No'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Formulary Adequacy</p>
                <p className="text-lg text-gray-900 capitalize">{results.chronicCover.formularyAdequacy}</p>
              </div>
            </div>

            {results.chronicCover.identifiedGaps && results.chronicCover.identifiedGaps.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-700"><strong>Identified Gaps:</strong></p>
                {results.chronicCover.identifiedGaps.map((gap, idx) => (
                  <div key={idx} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-900">{gap}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.chronicCover.recommendations && results.chronicCover.recommendations.length > 0 && (
              <div className="space-y-2">
                {results.chronicCover.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle className="h-3 w-3 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Affordability Analysis */}
      {results?.affordability && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-base">Affordability Analysis</CardTitle>
              </div>
              <Badge 
                variant={results.affordability.isSustainable ? 'default' : 'destructive'}
                className="capitalize"
              >
                {results.affordability.affordabilityLevel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-xs text-gray-600 mb-1">Total Monthly Premium</p>
                <p className="text-xl text-gray-900">
                  {formatCurrency(results.affordability.currentTotalPremium)}
                </p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-xs text-gray-600 mb-1">Premium to Income Ratio</p>
                <p className="text-xl text-gray-900">
                  {results.affordability.premiumToIncomeRatio.toFixed(1)}%
                </p>
              </div>
            </div>

            {results.affordability.sustainabilityRationale && (
              <div className="contents">
                <Separator />
                <div className="text-xs text-gray-600">
                  <p><strong>Sustainability Assessment:</strong></p>
                  <p className="mt-1">{results.affordability.sustainabilityRationale}</p>
                </div>
              </div>
            )}

            {results.affordability.recommendations && results.affordability.recommendations.length > 0 && (
              <div className="contents">
                <Separator />
                <div className="space-y-2">
                  {results.affordability.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                      <CheckCircle className="h-3 w-3 text-indigo-600 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Health Profile */}
      {healthNeeds && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Health Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">GP Visits/Year</p>
                <p className="text-gray-900">{healthNeeds.expectedGPVisitsPerYear}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Specialist Visits/Year</p>
                <p className="text-gray-900">{healthNeeds.expectedSpecialistVisitsPerYear}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Dental Visits/Year</p>
                <p className="text-gray-900">{healthNeeds.expectedDentistVisitsPerYear}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Optometry Visits/Year</p>
                <p className="text-gray-900">{healthNeeds.expectedOptometryVisitsPerYear}</p>
              </div>
            </div>

            {healthNeeds.chronicConditions && healthNeeds.chronicConditions.length > 0 && (
              <div className="contents">
                <Separator />
                <div>
                  <p className="text-xs text-gray-700 mb-2"><strong>Chronic Conditions:</strong></p>
                  <div className="flex flex-wrap gap-2">
                    {healthNeeds.chronicConditions.map((condition, idx) => (
                      <Badge key={idx} variant="outline" className="capitalize">{condition}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {healthNeeds.chronicMedicationCostMonthly > 0 && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-gray-600 mb-1">Monthly Chronic Medication Cost</p>
                <p className="text-gray-900">{formatCurrency(healthNeeds.chronicMedicationCostMonthly)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Results Available */}
      {!results && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-900">
                Medical analysis calculations have not yet been completed for this FNA. 
                Contact your financial adviser for a detailed assessment.
              </p>
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
                <li>- This analysis is based on your current medical scheme benefits and PMB (Prescribed Minimum Benefits) regulations.</li>
                <li>- Medical scheme benefits and premiums are subject to change annually.</li>
                <li>- Consider reviewing your medical cover during open enrollment periods.</li>
                <li>- Consult with your financial adviser before making any changes to your medical scheme.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}