/**
 * Medical FNA Results View Component
 * Displays the published Medical Aid Needs Analysis results
 * Matches the layout of Step 4 (Finalise & Publish)
 */

import React from 'react';
import { 
  Shield, 
  Users, 
  Wallet, 
  Clock, 
  Check, 
  ArrowDown, 
  ArrowUp,
  AlertTriangle 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import type { MedicalFNAResults, MedicalFNAInputs, MedicalFNAAdjustments, MedicalFNAFinalNeeds } from '../types';

export interface MedicalFNAResultsViewProps {
  results?: MedicalFNAResults | { inputs?: MedicalFNAInputs; calculations?: MedicalFNAResults; results?: MedicalFNAResults; adjustments?: MedicalFNAAdjustments; rationale?: string; [key: string]: unknown };
  fna?: { inputs?: MedicalFNAInputs; calculations?: MedicalFNAResults; results?: MedicalFNAResults; adjustments?: MedicalFNAAdjustments; [key: string]: unknown };
}

export function MedicalFNAResultsView({ results: propResults, fna }: MedicalFNAResultsViewProps) {
  // 1. Resolve Data Sources
  // The 'fna' prop is the most reliable source for the full session (inputs, calculations, adjustments)
  // 'propResults' might be the session object (if passed as results={data}) or just the calculations
  
  const session = fna || (propResults?.inputs ? propResults : null);
  
  const inputs: MedicalFNAInputs | undefined = session?.inputs;
  const calculations: MedicalFNAResults | undefined = session?.calculations || session?.results || (propResults?.rationale ? propResults : null);
  const adjustments: MedicalFNAAdjustments = session?.adjustments || { notes: '' };
  
  // If we don't have calculations, we can't show anything meaningful
  if (!calculations || !calculations.rationale) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No Medical FNA results available
        </CardContent>
      </Card>
    );
  }

  // 2. Reconstruct Final Needs (Same logic as Step4Finalise)
  const finalNeeds: MedicalFNAFinalNeeds = {
    hospitalCover: adjustments.hospitalCoverOverride || calculations.recommendedInHospitalCover,
    msa: adjustments.msaOverride !== undefined ? adjustments.msaOverride : calculations.msaRecommended,
    dependents: adjustments.dependentsOverride || calculations.recommendedDependents,
    ljpBand: adjustments.ljpBandOverride || calculations.ljpBand
  };

  // 3. Gap Analysis Logic (Same logic as Step4Finalise)
  const getHospitalGap = () => {
    // If inputs are missing, we can't calculate gap
    if (!inputs) return { status: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-100', icon: Check };

    const existing = inputs.existingHospitalCover;
    const recommended = finalNeeds.hospitalCover;

    if (!existing || existing === 'Other' || existing === '') return { status: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-100', icon: Check };

    const parseRate = (val: string) => val.includes('200') ? 200 : val.includes('100') ? 100 : 0;
    const existingRate = parseRate(existing);
    const recommendedRate = parseRate(recommended);

    if (existingRate === 0) return { status: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-100', icon: Check };

    if (existingRate < recommendedRate) {
      return { status: 'Under Insured', color: 'text-red-600', bg: 'bg-red-50', icon: ArrowUp };
    }
    if (existingRate > recommendedRate) {
      return { status: 'Over Insured', color: 'text-amber-600', bg: 'bg-amber-50', icon: ArrowDown };
    }
    return { status: 'Appropriate', color: 'text-green-600', bg: 'bg-green-50', icon: Check };
  };

  const getMsaGap = () => {
    // If inputs are missing, we can't calculate gap
    if (!inputs) return { status: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-100', icon: Check, msg: '' };

    const existingMsa = inputs.existingMSA || 0;
    const recommendedMsa = finalNeeds.msa;

    if (existingMsa === 0 && recommendedMsa) {
      return { status: 'Under Insured', color: 'text-red-600', bg: 'bg-red-50', icon: ArrowUp, msg: 'No MSA but Savings Recommended' };
    }
    if (existingMsa > 0 && !recommendedMsa) {
      return { status: 'Over Insured', color: 'text-amber-600', bg: 'bg-amber-50', icon: ArrowDown, msg: 'Paying for MSA not recommended' };
    }
    return { status: 'Appropriate', color: 'text-green-600', bg: 'bg-green-50', icon: Check, msg: 'MSA Aligned with Needs' };
  };

  const hospitalGap = getHospitalGap();
  const msaGap = getMsaGap();

  const FinalCard = ({ title, icon: Icon, value, isOverridden, rationale }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string | boolean;
    isOverridden: boolean;
    rationale?: string;
  }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          {isOverridden && (
            <Badge variant="secondary" className="text-xs">
              Adjusted
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
           <span className="text-2xl font-bold text-primary">{value}</span>
           <div className="text-xs text-muted-foreground">
             {isOverridden ? "Manual override applied" : "System recommendation accepted"}
           </div>
        </div>
        {/* Added rationale here for context in read-only view */}
        {rationale && !isOverridden && (
           <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border italic">
            "{rationale}"
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  return (
    <div className="space-y-6">
      {/* Gap Analysis Section */}
      {inputs && (
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              Gap Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Hospital Cover Analysis */}
            <div className={`p-4 rounded-lg border ${hospitalGap.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-gray-700">Hospital Cover Analysis</span>
                <Badge variant="outline" className={`${hospitalGap.color} border-current`}>
                  {hospitalGap.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-white shadow-sm ${hospitalGap.color}`}>
                  <hospitalGap.icon className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <div className="text-gray-600">Existing: <span className="font-medium text-gray-900">{inputs.existingHospitalCover || 'None'}</span></div>
                  <div className="text-gray-600">Recommended: <span className="font-medium text-gray-900">{finalNeeds.hospitalCover}</span></div>
                </div>
              </div>
            </div>

            {/* MSA Analysis */}
            <div className={`p-4 rounded-lg border ${msaGap.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-gray-700">MSA Efficiency Analysis</span>
                <Badge variant="outline" className={`${msaGap.color} border-current`}>
                  {msaGap.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-white shadow-sm ${msaGap.color}`}>
                  <msaGap.icon className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <div className="text-gray-600">Existing MSA: <span className="font-medium text-gray-900">R {inputs.existingMSA || 0}</span></div>
                  <div className="text-gray-600">Need Savings? <span className="font-medium text-gray-900">{finalNeeds.msa ? 'Yes' : 'No'}</span></div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FinalCard
          title="In-Hospital Cover"
          icon={Shield}
          value={finalNeeds.hospitalCover}
          isOverridden={!!adjustments.hospitalCoverOverride}
          rationale={calculations.rationale.hospital}
        />
        <FinalCard
          title="Medical Savings Account"
          icon={Wallet}
          value={finalNeeds.msa ? "Yes" : "No"}
          isOverridden={adjustments.msaOverride !== undefined}
          rationale={calculations.rationale.msa}
        />
        <FinalCard
          title="Dependents"
          icon={Users}
          value={finalNeeds.dependents}
          isOverridden={!!adjustments.dependentsOverride}
          rationale={calculations.rationale.dependents}
        />
        <FinalCard
          title="Late Joiner Penalty"
          icon={Clock}
          value={finalNeeds.ljpBand}
          isOverridden={!!adjustments.ljpBandOverride}
          rationale={calculations.rationale.ljp}
        />
      </div>

      {/* Adviser Notes */}
      {adjustments.notes && (
        <Card>
          <CardHeader>
             <CardTitle className="text-base">Adviser Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{adjustments.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}