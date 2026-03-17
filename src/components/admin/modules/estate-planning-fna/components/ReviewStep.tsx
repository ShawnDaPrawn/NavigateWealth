/**
 * Estate Planning Review Step
 * Displays auto-populated data and assumptions before calculation
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { FileText } from 'lucide-react';
import type { EstatePlanningInputs } from '../types';

interface ReviewStepProps {
  inputs: EstatePlanningInputs | null;
}

export function ReviewStep({ inputs }: ReviewStepProps) {
  if (!inputs) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Failed to load client data</p>
      </div>
    );
  }

  return (
    <div className="contents">
      {/* Summary of auto-populated data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Auto-Populated</CardTitle>
          <CardDescription>
            The following data has been loaded from the client profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Client Name:</span>
              <p className="font-medium">{inputs.familyInfo.fullName || 'Not set'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Marital Status:</span>
              <p className="font-medium capitalize">
                {inputs.familyInfo.maritalStatus.replace('_', ' ')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Assets:</span>
              <p className="font-medium">{inputs.assets.length} asset(s)</p>
            </div>
            <div>
              <span className="text-muted-foreground">Liabilities:</span>
              <p className="font-medium">{inputs.liabilities.length} liability/ies</p>
            </div>
            <div>
              <span className="text-muted-foreground">Life Policies:</span>
              <p className="font-medium">{inputs.lifePolicies.length} policy/ies</p>
            </div>
            <div>
              <span className="text-muted-foreground">Dependants:</span>
              <p className="font-medium">{inputs.dependants.length} dependant(s)</p>
            </div>
          </div>

          {inputs.assets.length === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ No assets found. Please add assets in the Assets section before running this FNA.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estate Duty Assumptions */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Estate Duty Assumptions</CardTitle>
          <CardDescription>
            Current South African estate planning parameters (2024/2025)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estate Duty Rate:</span>
            <span className="font-medium">{inputs.assumptions.estateDutyRate * 100}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estate Duty Abatement:</span>
            <span className="font-medium">
              R{inputs.assumptions.estateDutyAbatement.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Executor Fee:</span>
            <span className="font-medium">{inputs.assumptions.executorFeePercentage}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CGT Inclusion Rate:</span>
            <span className="font-medium">{inputs.assumptions.cgtInclusionRate * 100}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}