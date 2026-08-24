/**
 * Step4Financial of the investment quote wizard. One step slice —
 * see InvestmentQuoteWizard.tsx for the state machine.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { TAX_BRACKET_OPTIONS, formatCurrency, type FinancialState } from './model';

export function Step4Financial({
  financial,
  onChange,
}: {
  financial: FinancialState;
  onChange: (f: FinancialState) => void;
}) {
  const update = (field: keyof FinancialState, value: unknown) => {
    onChange({ ...financial, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">A few quick financial details</h2>
        <p className="text-sm text-gray-500">
          This helps us assess suitability and recommend the right investment structure.
        </p>
      </div>

      {/* Gross monthly income */}
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
            onChange={(e) => update('income_gross_monthly', formatCurrency(e.target.value))}
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      {/* Net monthly income */}
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
            onChange={(e) => update('income_net_monthly', formatCurrency(e.target.value))}
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      {/* Existing investments */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Existing investments (optional)</Label>
        <Input
          type="text"
          placeholder="e.g. Unit trust with Allan Gray, TFSA with Sygnia"
          value={financial.existing_investments}
          onChange={(e) => update('existing_investments', e.target.value)}
          className="bg-white border-gray-300 h-11"
        />
      </div>

      {/* Retirement annuity */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you currently have a retirement annuity?
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => update('has_retirement_annuity', opt.value)}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                financial.has_retirement_annuity === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tax bracket */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Tax bracket (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {TAX_BRACKET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('tax_bracket', opt.value)}
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

// ── Step 5: Review & Submit ─────────────────────────────────────────────────────
