/**
 * Step 2: System Auto-Calculation
 * 
 * Behaviour Rules:
 * - NO MANUAL EDITING IN THIS STEP
 * - Display all calculated values from Step 1 input
 * - Show formulas and assumptions used
 * - Display warnings (e.g., exceeds insurable maximum)
 * - Navigation: Back to Step 1, Next to Step 3
 */

import React from 'react';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Alert, AlertDescription } from '../../../../ui/alert';
import type { RiskCalculations } from '../types';

import { LifeCoverResult } from './step2/LifeCoverResult';
import { DisabilityCoverResult } from './step2/DisabilityCoverResult';
import { SevereIllnessCoverResult } from './step2/SevereIllnessCoverResult';
import { IncomeProtectionResult } from './step2/IncomeProtectionResult';

interface Step2Props {
  calculations: RiskCalculations;
  onNext: () => void;
  onBack: () => void;
}

export function Step2AutoCalculation({ calculations, onNext, onBack }: Step2Props) {
  const { life, disability, severeIllness, incomeProtection, metadata } = calculations;
  
  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          All calculations below are system-generated and cannot be edited in this step. 
          You will have the opportunity to apply manual overrides in Step 3.
        </AlertDescription>
      </Alert>
      
      <LifeCoverResult calculation={life} />
      <DisabilityCoverResult calculation={disability} />
      <SevereIllnessCoverResult calculation={severeIllness} />
      <IncomeProtectionResult calculation={incomeProtection} />
      
      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-right">
        <p>Calculated: {new Date(metadata.calculatedAt).toLocaleString()}</p>
        <p>System Version: {metadata.systemVersion}</p>
      </div>
      
      {/* Next Step Preview */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Next Step:</strong> You can apply manual overrides to any calculated values in Step 3. 
          All overrides must include a reason and classification for compliance purposes.
        </AlertDescription>
      </Alert>
      
      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Step 1
        </Button>
        <Button type="button" onClick={onNext} size="lg" className="bg-primary hover:bg-primary/90">
          Continue to Adjustments
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
