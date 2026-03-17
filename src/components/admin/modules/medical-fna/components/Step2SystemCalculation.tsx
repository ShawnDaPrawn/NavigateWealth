/**
 * Step 2: System Auto-Calculation
 * 
 * Behaviour Rules:
 * - NO MANUAL EDITING IN THIS STEP
 * - Display all calculated values from Step 1 input
 * - Show formulas and assumptions used
 * - Navigation: Back to Step 1, Next to Step 3
 */

import React from 'react';
import { ArrowLeft, ArrowRight, Shield, Users, Wallet, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Separator } from '../../../../ui/separator';
import { MedicalFNAInputs, MedicalFNAResults } from '../types';

interface Step2Props {
  inputs: Partial<MedicalFNAInputs>;
  calculations: MedicalFNAResults;
  onNext: () => void;
  onBack: () => void;
}

export function Step2SystemCalculation({ inputs, calculations, onNext, onBack }: Step2Props) {
  
  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          All calculations below are system-generated and cannot be edited in this step. 
          You will have the opportunity to apply manual overrides in Step 3.
        </AlertDescription>
      </Alert>

      {/* In-Hospital Cover */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">In-Hospital Cover</CardTitle>
          </div>
          <CardDescription>Hospital benefit level recommendation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputs.existingHospitalCover && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Current Cover</p>
                <p className="text-lg font-medium">{inputs.existingHospitalCover}</p>
              </div>
            )}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">System Recommendation</p>
              <p className="text-lg font-bold text-primary">{calculations.recommendedInHospitalCover}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border italic">
            "{calculations.rationale.hospital}"
          </div>
        </CardContent>
      </Card>

      {/* Medical Savings Account */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Medical Savings Account</CardTitle>
          </div>
          <CardDescription>MSA necessity assessment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputs.existingMSA !== undefined && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Current MSA</p>
                <p className="text-lg font-medium">R {inputs.existingMSA.toLocaleString()}</p>
              </div>
            )}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">System Recommendation</p>
              <p className="text-lg font-bold text-primary">{calculations.msaRecommended ? "Recommended" : "Not Recommended"}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border italic">
            "{calculations.rationale.msa}"
          </div>
        </CardContent>
      </Card>

      {/* Dependents Coverage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Dependents Coverage</CardTitle>
          </div>
          <CardDescription>Recommended policy members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputs.existingDependents !== undefined && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Current Dependents</p>
                <p className="text-lg font-medium">{inputs.existingDependents}</p>
              </div>
            )}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">System Recommendation</p>
              <p className="text-lg font-bold text-primary">{calculations.recommendedDependents}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border italic">
            "{calculations.rationale.dependents}"
          </div>
        </CardContent>
      </Card>

      {/* Late Joiner Penalty */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Late Joiner Penalty</CardTitle>
          </div>
          <CardDescription>Permanent premium increase assessment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputs.existingLJP !== undefined && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Current Penalty</p>
                <p className="text-lg font-medium">R {inputs.existingLJP.toLocaleString()}</p>
              </div>
            )}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Applicable Penalty Band</p>
              <p className={`text-2xl font-bold ${calculations.ljpBand !== '0%' ? 'text-destructive' : 'text-primary'}`}>
                {calculations.ljpBand}
              </p>
              {calculations.ljpBand !== '0%' && (
                <p className="text-xs text-muted-foreground mt-1">
                  This is a permanent monthly premium increase
                </p>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border italic">
            "{calculations.rationale.ljp}"
          </div>
        </CardContent>
      </Card>

      {/* Next Step Preview */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Next Step:</strong> You can apply manual overrides to any calculated values in Step 3. 
          All overrides must include a reason for compliance purposes.
        </AlertDescription>
      </Alert>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Step 1
        </Button>
        <Button type="button" onClick={onNext} size="lg">
          Continue to Adjustments
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}