/**
 * Step 4 — income, savings and existing provisions.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines) on the same pattern as
 * the medical aid wizard: each step was already a self-contained function with
 * its own props; only its address changed.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { type FinancialState, TAX_BRACKET_OPTIONS, formatCurrency } from './model';

export function Step4Financial({
  financial,
  onChange,
}: {
  financial: FinancialState;
  onChange: (f: FinancialState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">A few quick details</h2>
        <p className="text-sm text-gray-500">
          Basic financial context to help your adviser prepare a suitable recommendation.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Gross monthly income <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 45,000"
            value={financial.income_gross_monthly}
            onChange={(e) =>
              onChange({ ...financial, income_gross_monthly: formatCurrency(e.target.value) })
            }
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Net monthly income <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 32,000"
            value={financial.income_net_monthly}
            onChange={(e) =>
              onChange({ ...financial, income_net_monthly: formatCurrency(e.target.value) })
            }
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Current total retirement savings (optional)
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 500,000"
            value={financial.current_retirement_savings}
            onChange={(e) =>
              onChange({ ...financial, current_retirement_savings: formatCurrency(e.target.value) })
            }
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Tax bracket (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {TAX_BRACKET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...financial, tax_bracket: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                financial.tax_bracket === opt.value
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

// ── Step 5: Review ──────────────────────────────────────────────────────────────
