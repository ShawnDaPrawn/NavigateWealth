/**
 * Step3Objective of the investment quote wizard. One step slice —
 * see InvestmentQuoteWizard.tsx for the state machine.
 */
import { Label } from '../../../../ui/label';
import {
  OBJECTIVE_OPTIONS,
  TIME_HORIZON_OPTIONS,
  RISK_COMFORT_OPTIONS,
  type ObjectiveState,
} from './model';

export function Step3Objective({
  objective,
  onChange,
}: {
  objective: ObjectiveState;
  onChange: (o: ObjectiveState) => void;
}) {
  const update = (field: keyof ObjectiveState, value: string) => {
    onChange({ ...objective, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What is this investment for?</h2>
        <p className="text-sm text-gray-500">
          Help us understand your goals so we can recommend the right approach.
        </p>
      </div>

      {/* Primary objective */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Primary objective <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {OBJECTIVE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('primary_objective', opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                objective.primary_objective === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  objective.primary_objective === opt.value ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {objective.primary_objective === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time horizon */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Time horizon <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {TIME_HORIZON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('time_horizon', opt.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                objective.time_horizon === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Risk comfort */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Risk comfort level <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {RISK_COMFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('risk_comfort', opt.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                objective.risk_comfort === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Financial Snapshot ───────────────────────────────────────────────────
