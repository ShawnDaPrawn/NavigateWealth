/**
 * Step 4: Finalise & Publish
 * 
 * Behaviour Rules:
 * - Review final values before saving
 * - Indicate which values were overridden
 * - Publish to client record and create _need keys
 * - Display Gap Analysis (Over/Under insurance)
 */

import React from 'react';
import { ArrowLeft, Save, Shield, Users, Wallet, Clock, CheckCircle2, AlertTriangle, Check, ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import { MedicalFNAResults, MedicalFNAAdjustments, MedicalFNAFinalNeeds, MedicalFNAInputs } from '../types';

interface Step4Props {
  inputs: MedicalFNAInputs;
  calculations: MedicalFNAResults;
  adjustments: MedicalFNAAdjustments;
  onPublish: (finalNeeds: MedicalFNAFinalNeeds) => void;
  onBack: () => void;
}

export function Step4Finalise({ inputs, calculations, adjustments, onPublish, onBack }: Step4Props) {
  
  // Calculate final values (System vs Override)
  const finalNeeds: MedicalFNAFinalNeeds = {
    hospitalCover: adjustments.hospitalCoverOverride || calculations.recommendedInHospitalCover,
    msa: adjustments.msaOverride !== undefined ? adjustments.msaOverride : calculations.msaRecommended,
    dependents: adjustments.dependentsOverride || calculations.recommendedDependents,
    ljpBand: adjustments.ljpBandOverride || calculations.ljpBand
  };

  // --- Gap Analysis Logic ---

  const getHospitalGap = () => {
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

  const FinalCard = ({ title, icon: Icon, value, isOverridden }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string | boolean;
    isOverridden: boolean;
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
      <CardContent>
        <div className="flex flex-col gap-2">
           <span className="text-2xl font-bold text-primary">{value}</span>
           <div className="text-xs text-muted-foreground">
             {isOverridden ? "Manual override applied" : "System recommendation accepted"}
           </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          Please review the final agreed values below. Once published, these values will be saved to the client record.
        </AlertDescription>
      </Alert>

      {/* Gap Analysis Section */}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FinalCard
          title="In-Hospital Cover"
          icon={Shield}
          value={finalNeeds.hospitalCover}
          isOverridden={!!adjustments.hospitalCoverOverride}
        />
        <FinalCard
          title="Medical Savings Account"
          icon={Wallet}
          value={finalNeeds.msa ? "Yes" : "No"}
          isOverridden={adjustments.msaOverride !== undefined}
        />
        <FinalCard
          title="Dependents"
          icon={Users}
          value={finalNeeds.dependents}
          isOverridden={!!adjustments.dependentsOverride}
        />
        <FinalCard
          title="Late Joiner Penalty"
          icon={Clock}
          value={finalNeeds.ljpBand}
          isOverridden={!!adjustments.ljpBandOverride}
        />
      </div>

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

      <div className="flex justify-between pt-6 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Step 3
        </Button>
        <Button type="button" onClick={() => onPublish(finalNeeds)} size="lg">
          <Save className="mr-2 h-4 w-4" />
          Publish Analysis
        </Button>
      </div>
    </div>
  );
}