/**
 * Estate Planning — Step 2: System Auto-Calculation (read only)
 */

import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { FNAStepNavigation } from '../../fna';
import type { EstatePlanningResults } from '../types';
import { EstateResultsSummary } from './EstateResultsSummary';

interface Step2Props {
  results: EstatePlanningResults;
  onNext: () => void;
  onBack: () => void;
}

export function Step2SystemCalculation({ results, onNext, onBack }: Step2Props) {
  const recommendations = results.executiveSummary.keyRecommendations;

  return (
    <div className="space-y-6">
      <EstateResultsSummary
        results={results}
        title="System Calculation"
        description="Death balance sheet and liquidity with the standard cost assumptions and current statutory rates"
      />

      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">System recommendations</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          These results are formula-driven and cannot be edited here. If the cost assumptions do not
          suit this estate, override them in the next step.
        </AlertDescription>
      </Alert>

      <FNAStepNavigation step={2} onBack={onBack} onNext={onNext} />
    </div>
  );
}
