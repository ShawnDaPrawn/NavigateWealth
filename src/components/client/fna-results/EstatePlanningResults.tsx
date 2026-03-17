/**
 * Client-Side Estate Planning FNA Results Display
 * Read-only view of published Estate Planning Analysis
 * 
 * Data source: /supabase/functions/server/estate-planning-fna-routes.tsx
 * Backend stores inputs with: familyInfo, dependants, willInfo, assets, liabilities,
 * lifePolicies, assumptions, hasOffshorAssets, hasTrusts, trustDetails, planningNotes
 * Results may be null if calculation hasn't been run — in that case we derive
 * summary values from inputs directly.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { 
  Home, 
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info,
  Scale,
  Shield
} from 'lucide-react';
import { EstatePlanningFNA, formatCurrency } from '../../../services/fna-api';

interface EstatePlanningResultsProps {
  fna: EstatePlanningFNA;
}

export function EstatePlanningResults({ fna }: EstatePlanningResultsProps) {
  const { results, inputs, adviserNotes } = fna;

  /** Typed estate asset from inputs */
  interface EstateAsset { currentValue?: number; value?: number; type?: string; subType?: string; description?: string; [key: string]: unknown; }
  interface EstateLiability { outstandingBalance?: number; amount?: number; description?: string; [key: string]: unknown; }
  interface LifePolicy { payableToEstate?: boolean; sumAssured?: number; provider?: string; policyNumber?: string; [key: string]: unknown; }
  interface EstateDependant { name?: string; relationship?: string; age?: number; [key: string]: unknown; }
  interface EstateRecommendation { title?: string; recommendation?: string; description?: string; priority?: string; [key: string]: unknown; }

  // Safely access nested input structures
  const familyInfo = inputs?.familyInfo;
  const dependants: EstateDependant[] = inputs?.dependants || [];
  const willInfo = inputs?.willInfo || {};
  const assets: EstateAsset[] = inputs?.assets || [];
  const liabilities: EstateLiability[] = inputs?.liabilities || [];
  const lifePolicies: LifePolicy[] = inputs?.lifePolicies || [];
  const assumptions = inputs?.assumptions;

  // Calculate estate values from inputs when results are null
  const totalAssets = assets.reduce(
    (sum: number, asset: EstateAsset) => sum + (asset.currentValue || asset.value || 0), 0
  );
  const totalLiabilities = liabilities.reduce(
    (sum: number, liability: EstateLiability) => sum + (liability.outstandingBalance || liability.amount || 0), 0
  );
  const netEstateValue = totalAssets - totalLiabilities;

  const resultsRecord = (results || {}) as Record<string, unknown>;

  // Use results if available, otherwise derive from inputs
  const estateValue = (resultsRecord.estateValue as number) ?? netEstateValue;
  const estateDutyAbatement = assumptions?.estateDutyAbatement || 3500000;
  const estateDutyRate = assumptions?.estateDutyRate || 0.20;
  const dutiableAmount = Math.max(0, estateValue - (assumptions?.spousalBequest ? estateValue : estateDutyAbatement));
  const estimatedEstateDuty = (resultsRecord.estateDuty as number) ?? (dutiableAmount * estateDutyRate);

  // Calculate liquidity needs
  const executorFees = estateValue * (assumptions?.executorFeePercentage || 3.5) / 100;
  const masterFees = assumptions?.masterFeesEstimate || 5000;
  const funeralCosts = assumptions?.funeralCostsEstimate || 50000;
  const conveyancingFees = assumptions?.conveyancingFeesPerProperty || 50000;
  const numProperties = assets.filter((a: EstateAsset) => 
    (a.type || '').toLowerCase() === 'property' || (a.subType || '').toLowerCase().includes('property')
  ).length;
  const totalLiquidityNeeds = (resultsRecord.liquidityNeeds as number) ?? 
    (estimatedEstateDuty + executorFees + masterFees + funeralCosts + (conveyancingFees * numProperties));

  // Total life cover payable to estate
  const totalLifeCoverToEstate = lifePolicies
    .filter((p: LifePolicy) => p.payableToEstate)
    .reduce((sum: number, p: LifePolicy) => sum + (p.sumAssured || 0), 0);

  const liquidityShortfall = totalLiquidityNeeds - totalLifeCoverToEstate;

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-indigo-600">
              <Home className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 mb-2">Estate Planning Analysis Summary</h3>
              <p className="text-sm text-gray-700 mb-4">
                Comprehensive modeling of your estate on death, including asset valuation, estate duty calculations, 
                liquidity requirements, and distribution planning for your beneficiaries.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                  <p className="text-xs text-gray-600 mb-1">Net Estate Value</p>
                  <p className="text-gray-900">{formatCurrency(estateValue)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                  <p className="text-xs text-gray-600 mb-1">Estimated Estate Duty</p>
                  <p className="text-gray-900">{formatCurrency(estimatedEstateDuty)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                  <p className="text-xs text-gray-600 mb-1">Dependants</p>
                  <p className="text-gray-900">{dependants.length}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                  <p className="text-xs text-gray-600 mb-1">Will Status</p>
                  <p className="text-gray-900 capitalize">
                    {(willInfo as Record<string, unknown>).hasValidWill === 'yes' ? 'Valid' : 
                     (willInfo as Record<string, unknown>).hasValidWill === 'no' ? 'None' : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Family Information */}
      {familyInfo && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-600">
                <Users className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Family Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Full Name</p>
                <p className="text-gray-900">{familyInfo.fullName}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Age</p>
                <p className="text-gray-900">{familyInfo.age} years</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Marital Status</p>
                <p className="text-gray-900 capitalize">
                  {familyInfo.maritalStatus?.replace(/_/g, ' ') || 'Not specified'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Tax Residency</p>
                <p className="text-gray-900">{familyInfo.taxResidency || 'South Africa'}</p>
              </div>
            </div>

            {familyInfo.spouseName && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-gray-600 mb-1">Spouse</p>
                <p className="text-sm text-gray-900">
                  {familyInfo.spouseName} {familyInfo.spouseAge ? `(Age ${familyInfo.spouseAge})` : ''}
                </p>
              </div>
            )}

            {dependants.length > 0 && (
              <div className="contents">
                <Separator />
                <div>
                  <p className="text-xs text-gray-700 mb-2"><strong>Dependants:</strong></p>
                  <div className="space-y-2">
                    {dependants.map((dep: EstateDependant, index: number) => (
                      <div key={index} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-gray-900">{dep.name}</p>
                          <p className="text-gray-600 capitalize">{dep.relationship} - Age {dep.age}</p>
                        </div>
                        {dep.specialNeeds && (
                          <Badge variant="outline" className="text-xs">Special Needs</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estate Valuation */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base">Estate Valuation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-gray-600 mb-1">Total Assets</p>
              <p className="text-xl text-gray-900">{formatCurrency(totalAssets)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-gray-600 mb-1">Total Liabilities</p>
              <p className="text-xl text-gray-900">{formatCurrency(totalLiabilities)}</p>
            </div>
          </div>

          {/* Assets Breakdown */}
          {assets.length > 0 && (
            <div className="contents">
              <Separator />
              <div>
                <p className="text-xs text-gray-700 mb-3"><strong>Assets:</strong></p>
                <div className="space-y-2">
                  {assets.map((asset: EstateAsset, index: number) => (
                    <div key={index} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-gray-900">{asset.description || asset.name || 'Asset'}</p>
                        {asset.type && (
                          <p className="text-gray-600 text-xs capitalize">{asset.type} {asset.subType ? `- ${asset.subType}` : ''}</p>
                        )}
                      </div>
                      <p className="text-gray-900">{formatCurrency(asset.currentValue || asset.value || 0)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Liabilities Breakdown */}
          {liabilities.length > 0 && (
            <div className="contents">
              <Separator />
              <div>
                <p className="text-xs text-gray-700 mb-3"><strong>Liabilities:</strong></p>
                <div className="space-y-2">
                  {liabilities.map((liability: EstateLiability, index: number) => (
                    <div key={index} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-gray-900">{liability.description || liability.name || 'Liability'}</p>
                        {liability.type && (
                          <p className="text-gray-600 text-xs capitalize">{liability.type}</p>
                        )}
                      </div>
                      <p className="text-gray-900">{formatCurrency(liability.outstandingBalance || liability.amount || 0)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex justify-between items-center pt-2 bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <p className="text-sm text-gray-900"><strong>Net Estate Value</strong></p>
            <p className="text-2xl text-gray-900">{formatCurrency(estateValue)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Estate Duty Calculation */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-600">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base">Estate Duty Calculation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Dutiable Estate</p>
              <p className="text-lg text-gray-900">{formatCurrency(estateValue)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Estate Duty Abatement</p>
              <p className="text-lg text-gray-900">{formatCurrency(estateDutyAbatement)}</p>
              <p className="text-xs text-gray-600 mt-1">
                {assumptions?.spousalBequest ? 'Spousal bequest exemption applies' : 'Standard R3.5M abatement'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-900">
                <strong>Estimated Estate Duty ({(estateDutyRate * 100).toFixed(0)}%)</strong>
              </p>
              <p className="text-2xl text-red-700">{formatCurrency(estimatedEstateDuty)}</p>
            </div>
            <p className="text-xs text-gray-600">
              Calculated at {(estateDutyRate * 100).toFixed(0)}% on the dutiable amount above the abatement threshold
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Liquidity Requirements */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-600">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Estate Liquidity Needs</CardTitle>
            </div>
            {liquidityShortfall > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Shortfall
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-gray-700"><strong>Liquidity Components:</strong></p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Estate Duty</span>
                <span className="text-gray-900">{formatCurrency(estimatedEstateDuty)}</span>
              </div>
              <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Executor Fees ({assumptions?.executorFeePercentage || 3.5}%)</span>
                <span className="text-gray-900">{formatCurrency(executorFees)}</span>
              </div>
              <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Master of High Court Fees</span>
                <span className="text-gray-900">{formatCurrency(masterFees)}</span>
              </div>
              <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Funeral Costs</span>
                <span className="text-gray-900">{formatCurrency(funeralCosts)}</span>
              </div>
              {numProperties > 0 && (
                <div className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Conveyancing Fees ({numProperties} propert{numProperties === 1 ? 'y' : 'ies'})</span>
                  <span className="text-gray-900">{formatCurrency(conveyancingFees * numProperties)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xs p-2 bg-orange-50 rounded font-semibold">
                <span className="text-gray-900">Total Liquidity Required</span>
                <span className="text-orange-700">{formatCurrency(totalLiquidityNeeds)}</span>
              </div>
            </div>
          </div>

          {totalLifeCoverToEstate > 0 && (
            <div className="contents">
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-xs p-2 bg-green-50 rounded">
                  <span className="text-gray-600">Life Cover Payable to Estate</span>
                  <span className="text-green-700">{formatCurrency(totalLifeCoverToEstate)}</span>
                </div>
                <div className={`flex justify-between text-xs p-2 rounded font-semibold ${liquidityShortfall > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <span className="text-gray-900">{liquidityShortfall > 0 ? 'Liquidity Shortfall' : 'Liquidity Surplus'}</span>
                  <span className={liquidityShortfall > 0 ? 'text-red-700' : 'text-green-700'}>
                    {formatCurrency(Math.abs(liquidityShortfall))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {liquidityShortfall > 0 && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-900 mb-1"><strong>Liquidity Shortfall Identified</strong></p>
                  <p className="text-xs text-gray-600">
                    Your estate may need to sell assets to cover the {formatCurrency(liquidityShortfall)} shortfall. 
                    Consider additional life cover with the estate as beneficiary to address this gap.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Life Policies */}
      {lifePolicies.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Life Policies in Estate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lifePolicies.map((policy: LifePolicy, index: number) => (
                <div key={index} className="flex justify-between items-center text-xs p-3 bg-teal-50 rounded-lg border border-teal-100">
                  <div>
                    <p className="text-gray-900 capitalize">{(policy.policyType || 'Life Cover').replace(/_/g, ' ')}</p>
                    <p className="text-gray-600">
                      {policy.payableToEstate ? 'Payable to Estate' : 'Nominated Beneficiary'}
                      {policy.cededTo ? ` (Ceded to ${policy.cededTo})` : ''}
                    </p>
                  </div>
                  <p className="text-gray-900">{formatCurrency(policy.sumAssured || 0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trust Structures */}
      {inputs?.hasTrusts && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-600">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Trust Structures</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <p className="text-sm text-gray-900 mb-1">Trust structures exist in this estate</p>
              {inputs.trustDetails && (
                <p className="text-xs text-gray-600">{inputs.trustDetails}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Will Status Warning */}
      {willInfo.hasValidWill !== 'yes' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-900">
                <p className="mb-2">
                  <strong>
                    {willInfo.hasValidWill === 'no' ? 'No Valid Will on Record' : 'Will Status Unknown'}
                  </strong>
                </p>
                <p className="text-xs mb-3">
                  Without a valid will, your estate will be distributed according to the Intestate Succession Act, 
                  which may not align with your wishes. This can also significantly delay the estate administration process.
                </p>
                <p className="text-xs">
                  <strong>Action Required:</strong> Consult with your financial adviser or estate planning 
                  attorney to draft a will that reflects your distribution wishes.
                </p>
              </div>
            </div>
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

      {/* Backend Results (if available) */}
      {results && Array.isArray(resultsRecord.recommendations) && (resultsRecord.recommendations as EstateRecommendation[]).length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-600">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Estate Planning Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(resultsRecord.recommendations as EstateRecommendation[]).map((recommendation: EstateRecommendation, index: number) => (
              <div key={index} className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 mb-1">
                      {recommendation.title || recommendation.recommendation}
                    </p>
                    {recommendation.description && (
                      <p className="text-xs text-gray-600 mb-2">{recommendation.description}</p>
                    )}
                    {recommendation.priority && (
                      <Badge 
                        variant={recommendation.priority === 'high' ? 'destructive' : 'default'}
                        className="text-xs capitalize"
                      >
                        {recommendation.priority} Priority
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                <li>- Estate duty is levied at 20% on estates up to R30M and 25% above that threshold.</li>
                <li>- This analysis assumes death occurs today and uses current asset valuations.</li>
                <li>- Regular reviews are essential, especially after major life events (marriage, divorce, births, etc.).</li>
                <li>- Ensure your will is updated, signed, and stored securely with copies held by executors.</li>
                <li>- Consider life insurance to cover estate duty and liquidity needs.</li>
                <li>- Consult with an estate planning attorney for comprehensive estate planning advice.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}