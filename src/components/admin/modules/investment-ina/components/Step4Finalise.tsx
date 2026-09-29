/**
 * Investment INA — Step 4: Finalise & Publish
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { FNAStepNavigation } from '../../fna';
import { RISK_PROFILE_LABELS } from '../constants';
import type { InvestmentINAAdviserAdjustments, InvestmentINAResults, RiskProfile } from '../types';
import { formatPercentage } from '../services/investmentINACalculationService';
import { INAResultsSummary } from './INAResultsSummary';

interface Step4Props {
  results: InvestmentINAResults;
  adjustments?: InvestmentINAAdviserAdjustments;
  initialNotes?: string;
  onPublish: (adviserNotes: string) => void;
  onBack: () => void;
  isPublishing?: boolean;
}

function describeOverrides(adjustments?: InvestmentINAAdviserAdjustments): string[] {
  const overrides = adjustments?.overrides ?? {};
  const lines: string[] = [];
  if (overrides.clientRiskProfile) {
    lines.push(`Risk profile: ${RISK_PROFILE_LABELS[overrides.clientRiskProfile as RiskProfile]}`);
  }
  if (overrides.longTermInflationRate !== undefined) {
    lines.push(`Inflation: ${formatPercentage(overrides.longTermInflationRate)}`);
  }
  if (overrides.expectedRealReturns) {
    lines.push('Expected real returns by risk profile');
  }
  return lines;
}

export function Step4Finalise({
  results,
  adjustments,
  initialNotes = '',
  onPublish,
  onBack,
  isPublishing = false,
}: Step4Props) {
  const [notes, setNotes] = useState(initialNotes);
  const overrides = describeOverrides(adjustments);

  return (
    <div className="space-y-6">
      <INAResultsSummary
        results={results}
        title="Final Analysis"
        description={
          overrides.length > 0
            ? 'Recalculated with the adviser overrides below'
            : 'The system calculation, carried forward without overrides'
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Adviser Adjustments</CardTitle>
          <CardDescription>Recorded with the published analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {overrides.length === 0 ? (
            <p className="text-muted-foreground">No overrides were applied.</p>
          ) : (
            <>
              <ul className="list-disc list-inside space-y-1">
                {overrides.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>
                <span className="font-medium">Reason:</span> {adjustments?.reason}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="ina-adviser-notes">Adviser notes</Label>
        <Textarea
          id="ina-adviser-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context for the client record (optional)"
        />
      </div>

      <FNAStepNavigation
        step={4}
        onBack={onBack}
        onNext={() => onPublish(notes.trim())}
        isBusy={isPublishing}
      />
    </div>
  );
}
