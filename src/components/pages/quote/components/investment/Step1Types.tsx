/**
 * Step1Types of the investment quote wizard. One step slice —
 * see InvestmentQuoteWizard.tsx for the state machine.
 */
import { CheckCircle, Info } from 'lucide-react';
import { INVESTMENT_OPTIONS } from './model';

export function Step1Types({
  selectedTypes,
  onChange,
}: {
  selectedTypes: string[];
  onChange: (types: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selectedTypes.includes(id)) {
      onChange(selectedTypes.filter((t) => t !== id));
    } else {
      onChange([...selectedTypes, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What would you like to invest in?</h2>
        <p className="text-sm text-gray-500">
          Select one or more investment types. You can choose multiple.
        </p>
      </div>

      <div className="space-y-2">
        {INVESTMENT_OPTIONS.map((opt) => {
          const isSelected = selectedTypes.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary/50 bg-primary/[0.03] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                }`}
              >
                {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 text-sm">{opt.label}</span>
                <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                  {opt.info}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Contribution Structure ──────────────────────────────────────────────
