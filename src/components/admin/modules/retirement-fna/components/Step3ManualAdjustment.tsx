/**
 * Step 3: Adviser Manual Adjustment
 *
 * Behaviour Rules:
 * - Adviser may override economic assumptions
 * - Override reason/justification is recommended
 * - All adjustments must be documented
 * - Display warnings if adjustments significantly differ from standard assumptions
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { NumberInputField } from '../../../../ui/number-input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Alert, AlertDescription } from '../../../../ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../ui/accordion';
import { Settings, Info, AlertTriangle } from 'lucide-react';
import {
  RetirementFNAInputs,
  RetirementFNAAdjustments,
  RetirementCalculationResults,
} from '../types';
import { FNAStepNavigation } from '../../fna';

interface Step3ManualAdjustmentProps {
  inputs: Partial<RetirementFNAInputs>;
  calculations: RetirementCalculationResults;
  initialAdjustments: RetirementFNAAdjustments;
  onNext: (adjustments: RetirementFNAAdjustments) => void;
  onBack: () => void;
}

export function Step3ManualAdjustment({
  inputs,
  initialAdjustments,
  onNext,
  onBack,
}: Step3ManualAdjustmentProps) {
  const [adjustments, setAdjustments] = useState<RetirementFNAAdjustments>(initialAdjustments);
  const [hasChanges, setHasChanges] = useState(false);

  // Standard assumptions
  const STANDARD_ASSUMPTIONS = {
    inflationRate: 0.06,
    preRetirementReturn: 0.1,
    postRetirementReturn: 0.08,
    replacementRatio: 0.75,
    yearsInRetirement: 25,
    premiumEscalation: 0.06,
  };

  // Percentages are typed as 6.5 and stored as 0.065.
  const handlePercentChange = (field: keyof RetirementFNAAdjustments, value?: number) => {
    if (value !== undefined && value >= 0 && value <= 100) {
      setAdjustments((prev) => ({ ...prev, [field]: value / 100 }));
      setHasChanges(true);
    }
  };

  const handleNumberChange = (field: keyof RetirementFNAAdjustments, value?: number) => {
    if (value !== undefined && value > 0) {
      setAdjustments((prev) => ({ ...prev, [field]: value }));
      setHasChanges(true);
    }
  };

  const getPercent = (field: keyof RetirementFNAAdjustments, fallback: number) => {
    const val = adjustments[field] !== undefined ? adjustments[field] : fallback;
    return Math.round(Number(val) * 10000) / 100;
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAdjustments((prev) => ({ ...prev, adviserNotes: e.target.value }));
    if (e.target.value.trim()) setHasChanges(true);
  };

  // Check if value differs significantly from standard
  const isDifferent = (field: keyof typeof STANDARD_ASSUMPTIONS, threshold = 0.02) => {
    const currentValue = adjustments[field] || STANDARD_ASSUMPTIONS[field];
    return Math.abs(currentValue - STANDARD_ASSUMPTIONS[field]) > threshold;
  };

  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          You may adjust economic assumptions if standard rates don't apply to this client's
          situation. All adjustments should be documented with justification.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Adjust Economic Assumptions
          </CardTitle>
          <CardDescription>
            Adjust the standard assumptions if specific circumstances warrant different rates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Core Assumptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inflationRate" className="font-medium">
                Inflation Rate (CPI)
              </Label>
              <div className="relative">
                <NumberInputField
                  id="inflationRate"
                  decimals={2}
                  value={getPercent('inflationRate', STANDARD_ASSUMPTIONS.inflationRate)}
                  onValueChange={(v) => handlePercentChange('inflationRate', v)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Standard: {(STANDARD_ASSUMPTIONS.inflationRate * 100).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preRetirementReturn" className="font-medium">
                Pre-Retirement Growth (Nominal)
              </Label>
              <div className="relative">
                <NumberInputField
                  id="preRetirementReturn"
                  decimals={2}
                  value={getPercent(
                    'preRetirementReturn',
                    STANDARD_ASSUMPTIONS.preRetirementReturn,
                  )}
                  onValueChange={(v) => handlePercentChange('preRetirementReturn', v)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Standard: {(STANDARD_ASSUMPTIONS.preRetirementReturn * 100).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postRetirementReturn" className="font-medium">
                Post-Retirement Growth (Nominal)
              </Label>
              <div className="relative">
                <NumberInputField
                  id="postRetirementReturn"
                  decimals={2}
                  value={getPercent(
                    'postRetirementReturn',
                    STANDARD_ASSUMPTIONS.postRetirementReturn,
                  )}
                  onValueChange={(v) => handlePercentChange('postRetirementReturn', v)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Standard: {(STANDARD_ASSUMPTIONS.postRetirementReturn * 100).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="replacementRatio" className="font-medium">
                Income Replacement Ratio
              </Label>
              <div className="relative">
                <NumberInputField
                  id="replacementRatio"
                  value={getPercent('replacementRatio', STANDARD_ASSUMPTIONS.replacementRatio)}
                  onValueChange={(v) => handlePercentChange('replacementRatio', v)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Standard: {(STANDARD_ASSUMPTIONS.replacementRatio * 100).toFixed(0)}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="premiumEscalation" className="font-medium">
                Premium Escalation (Annual)
              </Label>
              <div className="relative">
                <NumberInputField
                  id="premiumEscalation"
                  decimals={2}
                  value={getPercent('premiumEscalation', STANDARD_ASSUMPTIONS.premiumEscalation)}
                  onValueChange={(v) => handlePercentChange('premiumEscalation', v)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Standard: {(STANDARD_ASSUMPTIONS.premiumEscalation * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Additional Parameters */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium">Additional Parameters</span>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="retirementAge" className="font-medium">
                      Target Retirement Age
                    </Label>
                    <NumberInputField
                      id="retirementAge"
                      placeholder="Use default from Step 1"
                      value={adjustments.retirementAge}
                      onValueChange={(v) => handleNumberChange('retirementAge', v)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Original plan: {inputs.retirementAge || 65} years
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearsInRetirement" className="font-medium">
                      Years in Retirement
                    </Label>
                    <NumberInputField
                      id="yearsInRetirement"
                      value={
                        adjustments.yearsInRetirement || STANDARD_ASSUMPTIONS.yearsInRetirement
                      }
                      onValueChange={(v) => handleNumberChange('yearsInRetirement', v)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Standard: {STANDARD_ASSUMPTIONS.yearsInRetirement} years
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Warnings for significant deviations */}
          {(isDifferent('inflationRate') ||
            isDifferent('preRetirementReturn') ||
            isDifferent('postRetirementReturn') ||
            isDifferent('premiumEscalation')) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                One or more assumptions differ significantly from standard rates. Please ensure this
                is justified and documented in the notes below.
              </AlertDescription>
            </Alert>
          )}

          {/* Justification Notes */}
          <div className="space-y-2">
            <Label htmlFor="adviserNotes" className="font-medium">
              Adviser Notes / Justification{' '}
              {hasChanges && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="adviserNotes"
              className="h-24"
              placeholder="Document the rationale for any adjustments made to standard assumptions..."
              value={adjustments.adviserNotes || ''}
              onChange={handleNotesChange}
            />
            <p className="text-xs text-muted-foreground">
              {hasChanges
                ? 'Recommended: Explain why non-standard assumptions were applied'
                : 'Leave blank if using standard assumptions'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Next Step Preview */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Next Step:</strong> Review the recalculated results with your adjustments and
          finalize the analysis for publication.
        </AlertDescription>
      </Alert>

      <FNAStepNavigation step={3} onBack={onBack} onNext={() => onNext(adjustments)} />
    </div>
  );
}
