/**
 * Step3Budget of the employee benefits quote wizard. One step slice —
 * see EmployeeBenefitsQuoteWizard.tsx for the state machine.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { HelpCircle } from 'lucide-react';
import {
  COMPULSORY_OPTIONS,
  CONTRIBUTION_STRUCTURE_OPTIONS,
  formatCurrency,
  type BudgetState,
} from './model';

export function Step3Budget({
  budget,
  onChange,
}: {
  budget: BudgetState;
  onChange: (b: BudgetState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          What is your intended monthly budget?
        </h2>
        <p className="text-sm text-gray-500">
          An estimate helps your adviser right-size the proposal.
        </p>
      </div>

      {/* Monthly budget */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Estimated total monthly budget for employee benefits{' '}
          <span className="text-red-500">*</span>
        </Label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              R
            </span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 25,000"
              value={budget.monthly_budget}
              onChange={(e) =>
                onChange({ ...budget, monthly_budget: formatCurrency(e.target.value) })
              }
              disabled={budget.budget_adviser_assist}
              className="bg-white border-gray-300 h-11 pl-7"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...budget,
                budget_adviser_assist: !budget.budget_adviser_assist,
                monthly_budget: !budget.budget_adviser_assist ? '' : budget.monthly_budget,
              })
            }
            className={`text-xs px-3 py-2.5 rounded-lg border font-medium whitespace-nowrap transition-all ${
              budget.budget_adviser_assist
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <HelpCircle className="h-3 w-3 inline mr-1" />
            Adviser guidance
          </button>
        </div>
      </div>

      {/* Contribution structure */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Contribution structure preference <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {CONTRIBUTION_STRUCTURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...budget, contribution_structure: opt.value })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                budget.contribution_structure === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  budget.contribution_structure === opt.value ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {budget.contribution_structure === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compulsory */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are benefits compulsory for all staff? <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {COMPULSORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...budget, compulsory_for_all: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                budget.compulsory_for_all === opt.value
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
