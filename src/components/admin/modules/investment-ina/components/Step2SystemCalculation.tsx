/**
 * Investment INA — Step 2: System Auto-Calculation (read only)
 */

import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { FNAStepNavigation } from '../../fna';
import type { InvestmentINAResults } from '../types';
import { INAResultsSummary } from './INAResultsSummary';

interface Step2Props {
  results: InvestmentINAResults;
  onNext: () => void;
  onBack: () => void;
}

export function Step2SystemCalculation({ results, onNext, onBack }: Step2Props) {
  return (
    <div className="space-y-6">
      <INAResultsSummary
        results={results}
        title="System Calculation"
        description="Goal funding projected with the client's risk profile and the standard economic assumptions"
      />

      {results.recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">System recommendations</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {results.recommendations.map((rec) => (
              <li key={`${rec.goalId}-${rec.action}`}>
                <span className="font-medium text-foreground">{rec.goalName}:</span> {rec.action}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          These results are formula-driven and cannot be edited here. If the client&apos;s risk
          profile or the economic assumptions do not suit them, override them in the next step.
        </AlertDescription>
      </Alert>

      <FNAStepNavigation step={2} onBack={onBack} onNext={onNext} />
    </div>
  );
}
