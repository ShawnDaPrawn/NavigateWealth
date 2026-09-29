/**
 * Estate Planning — Step 4: Finalise & Publish
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { FNAStepNavigation } from '../../fna';
import type {
  EstateAdjustableAssumptions,
  EstatePlanningAdviserAdjustments,
  EstatePlanningResults,
} from '../types';
import { formatCurrency } from '../utils';
import { EstateResultsSummary } from './EstateResultsSummary';

const OVERRIDE_LABELS: Record<keyof EstateAdjustableAssumptions, string> = {
  executorFeePercentage: 'Executor fee',
  conveyancingFeesPerProperty: 'Conveyancing per property',
  masterFeesEstimate: "Master's fees",
  funeralCostsEstimate: 'Funeral costs',
  spousalBequest: 'Estate passes to spouse',
};

function describeOverride(key: keyof EstateAdjustableAssumptions, value: unknown): string {
  if (key === 'spousalBequest') return `${OVERRIDE_LABELS[key]}: ${value ? 'Yes' : 'No'}`;
  if (key === 'executorFeePercentage') return `${OVERRIDE_LABELS[key]}: ${value}%`;
  return `${OVERRIDE_LABELS[key]}: R${formatCurrency(Number(value))}`;
}

interface Step4Props {
  results: EstatePlanningResults;
  adjustments?: EstatePlanningAdviserAdjustments;
  initialNotes?: string;
  onPublish: (adviserNotes: string) => void;
  onBack: () => void;
  isPublishing?: boolean;
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
  const overrides = Object.entries(adjustments?.overrides ?? {}) as [
    keyof EstateAdjustableAssumptions,
    unknown,
  ][];

  return (
    <div className="space-y-6">
      <EstateResultsSummary
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
                {overrides.map(([key, value]) => (
                  <li key={key}>{describeOverride(key, value)}</li>
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
        <Label htmlFor="estate-adviser-notes">Adviser notes</Label>
        <Textarea
          id="estate-adviser-notes"
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
