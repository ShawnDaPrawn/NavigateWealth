/**
 * Client-Side Risk Planning FNA Results Display
 * Professional client-facing view of published Risk Planning analysis
 * Comprehensive report including all calculations, assumptions, and compliance information
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { Alert, AlertDescription } from '../../ui/alert';
import { 
  Shield, 
  Info,
  AlertTriangle,
  FileText
} from 'lucide-react';

// Import types from the admin module
interface FinalRiskNeed {
  riskType: string;
  label: string;
  grossNeed: number;
  existingCoverPersonal: number;
  existingCoverGroup: number;
  existingCoverTotal: number;
  netShortfall: number;
  isOverinsured?: boolean;
  overinsuredAmount?: number;
  advisorOverride?: {
    originalValue: number;
    overrideValue: number;
    reason: string;
    classification: string;
  };
  finalRecommendedCover: number;
  assumptions: string[];
  riskNotes: string[];
}

interface PublishedFNA {
  id: string;
  clientId: string;
  clientName: string;
  status: string;
  inputData: Record<string, unknown>;
  calculations: Record<string, unknown>;
  adjustments: Record<string, unknown>;
  finalNeeds: FinalRiskNeed[];
  complianceDisclaimers: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  createdBy: string;
  publishedBy?: string;
  version: number;
}

interface RiskPlanningResultsProps {
  fna: PublishedFNA;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export function RiskPlanningResults({ fna }: RiskPlanningResultsProps) {
  const { finalNeeds, inputData, calculations, complianceDisclaimers, publishedAt } = fna;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg p-8 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Risk Planning Analysis Report</h1>
            <p className="text-blue-100 text-lg mb-4">
              Comprehensive Financial Needs Analysis
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-blue-200 mb-1">Client Name</p>
                <p className="font-semibold">{fna.clientName}</p>
              </div>
              {publishedAt && (
                <div>
                  <p className="text-blue-200 mb-1">Report Date</p>
                  <p className="font-semibold">{formatDate(publishedAt)}</p>
                </div>
              )}
              <div>
                <p className="text-blue-200 mb-1">Version</p>
                <p className="font-semibold">{fna.version}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Executive Summary
          </CardTitle>
          <CardDescription>
            Overview of your financial protection needs and recommended cover
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-700 leading-relaxed">
            This comprehensive Risk Planning Analysis has been prepared to assess your life insurance and risk 
            protection requirements. The analysis considers your current financial situation, dependants, 
            income, debts, and existing insurance cover to determine appropriate protection levels for you and your family.
          </p>
          
          {/* Key Client Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Your Financial Profile</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {inputData?.currentAge && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Age</p>
                  <p className="text-lg font-semibold text-gray-900">{inputData.currentAge} years</p>
                </div>
              )}
              {inputData?.retirementAge && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Retirement Age</p>
                  <p className="text-lg font-semibold text-gray-900">{inputData.retirementAge} years</p>
                </div>
              )}
              {inputData?.dependants && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Dependants</p>
                  <p className="text-lg font-semibold text-gray-900">{inputData.dependants.length}</p>
                </div>
              )}
              {inputData?.netMonthlyIncome && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Monthly Income</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(inputData.netMonthlyIncome)}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Cover Amounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Recommended Insurance Cover</CardTitle>
          <CardDescription>
            Comprehensive breakdown of your insurance protection needs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {finalNeeds && finalNeeds.length > 0 ? (
            finalNeeds.map((need, index) => {
              const isMonthly = need.riskType.includes('incomeProtection');
              const isOverinsured = need.isOverinsured ?? false;
              const hasOverride = !!need.advisorOverride;
              
              return (
                <div key={need.riskType}>
                  <div className={`rounded-lg border-2 p-6 ${isOverinsured ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                    {/* Cover Type Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-gray-900">{need.label}</h3>
                      <div className="flex gap-2">
                        {isOverinsured && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-400">
                            Overinsured
                          </Badge>
                        )}
                        {need.netShortfall > 0 && !isOverinsured && (
                          <Badge variant="destructive">Shortfall</Badge>
                        )}
                        {need.netShortfall === 0 && !isOverinsured && (
                          <Badge className="bg-green-600">Adequate</Badge>
                        )}
                      </div>
                    </div>

                    {/* Main Figures */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Calculated Need</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(need.grossNeed)}{isMonthly && '/mo'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Existing Cover</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(need.existingCoverTotal)}{isMonthly && '/mo'}
                        </p>
                      </div>
                      {isOverinsured ? (
                        <div className="bg-amber-100 p-4 rounded-lg">
                          <p className="text-sm text-amber-800 mb-1">Excess Cover</p>
                          <p className="text-lg font-bold text-amber-900">
                            {formatCurrency(need.overinsuredAmount ?? 0)}{isMonthly && '/mo'}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Shortfall</p>
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(need.netShortfall)}{isMonthly && '/mo'}
                          </p>
                        </div>
                      )}
                      <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                        <p className="text-sm text-blue-700 mb-1 font-medium">Recommended Cover</p>
                        <p className="text-xl font-bold text-blue-900">
                          {formatCurrency(need.finalRecommendedCover)}{isMonthly && '/mo'}
                        </p>
                      </div>
                    </div>

                    {/* Overinsurance Warning */}
                    {isOverinsured && (
                      <Alert className="mb-4 border-amber-400 bg-amber-50">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-900">
                          <strong>Overinsurance Identified:</strong> Your existing cover of {formatCurrency(need.existingCoverTotal)}{isMonthly && '/mo'} 
                          {' '}exceeds your calculated need by {formatCurrency(need.overinsuredAmount ?? 0)}{isMonthly && '/mo'}. 
                          You may wish to consider reducing this cover to avoid unnecessary premium expenditure.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Existing Cover Breakdown */}
                    {(need.existingCoverPersonal > 0 || need.existingCoverGroup > 0) && (
                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Existing Cover Breakdown</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Personal Cover</p>
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(need.existingCoverPersonal)}{isMonthly && '/mo'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Group Scheme Cover</p>
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(need.existingCoverGroup)}{isMonthly && '/mo'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Total Existing</p>
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(need.existingCoverTotal)}{isMonthly && '/mo'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assumptions */}
                    {need.assumptions && need.assumptions.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Key Assumptions</p>
                        <ul className="space-y-1">
                          {need.assumptions.map((assumption, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex gap-2">
                              <span className="text-blue-600 font-bold">•</span>
                              <span>{assumption}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risk Notes */}
                    {need.riskNotes && need.riskNotes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Important Considerations</p>
                        <ul className="space-y-1">
                          {need.riskNotes.map((note, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex gap-2">
                              <span className="text-blue-600 font-bold">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  {index < finalNeeds.length - 1 && <Separator className="my-6" />}
                </div>
              );
            })
          ) : (
            <p className="text-gray-500 text-center py-8">No cover recommendations available.</p>
          )}
        </CardContent>
      </Card>

      {/* Analysis Methodology */}
      {calculations?.metadata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Analysis Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Calculated On</p>
                <p className="font-medium text-gray-900">
                  {formatDate(calculations.metadata.calculatedAt)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Analysis Version</p>
                <p className="font-medium text-gray-900">{calculations.metadata.systemVersion}</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Report Version</p>
                <p className="font-medium text-gray-900">v{fna.version}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAIS Compliance Disclaimers */}
      {complianceDisclaimers && complianceDisclaimers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
              <Info className="h-5 w-5" />
              Important Legal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {complianceDisclaimers.map((disclaimer, idx) => (
                <li key={idx} className="text-sm text-amber-900 flex gap-3">
                  <span className="font-bold mt-0.5">•</span>
                  <span>{disclaimer}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Important Notes for Clients */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-3">Please Note:</p>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>This analysis is based on your current financial situation and the information provided at the time of assessment.</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Your insurance needs may change as your circumstances evolve (marriage, children, career changes, etc.).</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>We recommend reviewing your risk protection annually or when significant life events occur.</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Please consult with your financial adviser to discuss the implementation of these recommendations and to understand all terms, conditions, and exclusions of any insurance products.</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>The final insurance cover amounts and premiums are subject to underwriting approval by the relevant insurance providers.</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pb-8 border-t pt-6">
        <p>This Financial Needs Analysis report was prepared by Navigate Wealth</p>
        <p className="mt-1">Licensed Financial Services Provider</p>
        {publishedAt && (
          <p className="mt-2">Report generated on {formatDate(publishedAt)}</p>
        )}
      </div>
    </div>
  );
}