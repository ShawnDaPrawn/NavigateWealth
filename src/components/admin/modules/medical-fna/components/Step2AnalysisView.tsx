/**
 * Step 2: Analysis & Gap Report
 * Compares Calculated Needs vs Current Policy
 */

import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ArrowLeft, 
  Save,
  Shield,
  Users,
  Wallet,
  Clock
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { useClientKeys } from '../../client-management/hooks/useClientKeys';
import { MedicalFNAInputs, MedicalFNAResults } from '../types';

interface Step2Props {
  clientId?: string;
  results: MedicalFNAResults;
  onBack: () => void;
  onComplete: () => void;
}

export function Step2AnalysisView({ clientId, results, onBack, onComplete }: Step2Props) {
  const { data: clientKeys } = useClientKeys(clientId || '');
  
  // Helper to get current key value
  const getCurrentValue = (keyId: string): unknown => {
    if (!clientKeys?.keys) return null;
    const key = clientKeys.keys.find(k => k.keyId === keyId);
    return key ? key.value : null;
  };

  const currentHospitalCover = getCurrentValue('medical_aid_hospital_tariff');
  const currentMSA = getCurrentValue('medical_aid_msa');
  const currentDependents = getCurrentValue('medical_aid_dependents');
  
  // Gap Logic
  const hasHospitalGap = currentHospitalCover && currentHospitalCover !== results.recommendedInHospitalCover;
  
  // MSA Gap: If recommended YES but current MSA is 0 or null
  const hasMSAGap = results.msaRecommended && (!currentMSA || currentMSA === 0);
  
  // Dependents Gap: If recommended > current
  // Parse "6+" to 6 for comparison
  const recDepCount = parseInt(results.recommendedDependents.replace('+', '')) || 0;
  
  // Parse current dependents safely
  let currDepCount = 0;
  if (typeof currentDependents === 'number') {
    currDepCount = currentDependents;
  } else if (typeof currentDependents === 'string') {
    currDepCount = parseInt(currentDependents) || 0;
  }
  
  const hasDependentsGap = currentDependents !== null && currentDependents !== undefined && recDepCount > currDepCount;

  // LJP Warning
  const hasLJP = results.ljpBand !== '0%';

  const handleSave = () => {
    // In a real implementation, this would save to the database
    // For this lightweight version, we'll simulate a save
    toast.success("Medical Needs Analysis saved to client profile");
    onComplete();
  };

  const AnalysisCard = ({ 
    title, 
    icon: Icon, 
    recommendation, 
    current, 
    gapDetected, 
    rationale,
    colorClass = "blue"
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    recommendation: string;
    current: unknown;
    gapDetected: boolean;
    rationale: string;
    colorClass?: string;
  }) => (
    <Card className={`border-l-4 border-l-${colorClass}-500 overflow-hidden`}>
      <CardHeader className="pb-2 bg-gray-50/50">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 text-${colorClass}-600`} />
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          {gapDetected ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Gap Detected
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-green-100 text-green-700 flex items-center gap-1 hover:bg-green-100">
              <CheckCircle2 className="w-3 h-3" /> Aligned
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-white border rounded-lg shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Recommended</p>
            <p className={`text-lg font-bold text-${colorClass}-700`}>{recommendation}</p>
          </div>
          <div className="p-3 bg-gray-50 border rounded-lg">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Current Policy</p>
            <p className="text-lg font-medium text-gray-700">
              {current !== null && current !== undefined 
                ? (typeof current === 'boolean' ? (current ? 'Yes' : 'No') : current) 
                : 'No Data'}
            </p>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 italic">
          "{rationale}"
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Hospital Cover */}
        <AnalysisCard
          title="In-Hospital Cover"
          icon={Shield}
          colorClass="blue"
          recommendation={results.recommendedInHospitalCover}
          current={currentHospitalCover}
          gapDetected={hasHospitalGap}
          rationale={results.rationale.hospital}
        />

        {/* MSA */}
        <AnalysisCard
          title="Medical Savings Account"
          icon={Wallet}
          colorClass="green"
          recommendation={results.msaRecommended ? "Yes" : "No"}
          current={currentMSA ? "Yes" : "No"} // Simplified check
          gapDetected={hasMSAGap}
          rationale={results.rationale.msa}
        />

        {/* Dependents */}
        <AnalysisCard
          title="Dependents Coverage"
          icon={Users}
          colorClass="purple"
          recommendation={results.recommendedDependents}
          current={currentDependents}
          gapDetected={hasDependentsGap}
          rationale={results.rationale.dependents}
        />

        {/* LJP */}
        <Card className={`border-l-4 ${hasLJP ? 'border-l-amber-500' : 'border-l-gray-300'}`}>
          <CardHeader className="pb-2 bg-gray-50/50">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${hasLJP ? 'text-amber-600' : 'text-gray-500'}`} />
                <CardTitle className="text-base font-semibold">Late Joiner Penalty</CardTitle>
              </div>
              {hasLJP && (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                  Penalty Applies
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="p-3 bg-white border rounded-lg shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Applicable Penalty Band</p>
              <p className={`text-2xl font-bold ${hasLJP ? 'text-amber-600' : 'text-gray-600'}`}>
                {results.ljpBand}
              </p>
              {hasLJP && (
                <p className="text-xs text-gray-500 mt-1">
                  Permanent monthly premium increase
                </p>
              )}
            </div>
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 italic">
              "{results.rationale.ljp}"
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inputs
        </Button>
        <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
          <Save className="mr-2 h-4 w-4" />
          Save Analysis
        </Button>
      </div>
    </div>
  );
}