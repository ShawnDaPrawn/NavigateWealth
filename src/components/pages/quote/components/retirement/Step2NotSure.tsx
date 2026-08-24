/**
 * Step 2 (unsure) — what the client wants help deciding.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines) on the same pattern as
 * the medical aid wizard: each step was already a self-contained function with
 * its own props; only its address changed.
 */
import { Label } from '../../../../ui/label';
import { type NotSureState } from './model';

export function Step2NotSure({
  state,
  onChange,
}: {
  state: NotSureState;
  onChange: (s: NotSureState) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Currently employed */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you currently employed? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange({ ...state, currently_employed: val })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                state.currently_employed === val
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Leaving employer fund */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you leaving an employer fund? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange({ ...state, leaving_employer_fund: val })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                state.leaving_employer_fund === val
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly contributions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Would you like to make new contributions monthly? <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'not_sure', label: 'Not sure' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...state, want_monthly_contributions: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                state.want_monthly_contributions === opt.value
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
