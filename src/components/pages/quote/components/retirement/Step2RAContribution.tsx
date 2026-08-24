/**
 * Step 2 (RA) — contribution type and amounts.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines) on the same pattern as
 * the medical aid wizard: each step was already a self-contained function with
 * its own props; only its address changed.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { HelpCircle } from 'lucide-react';
import {
  type RAContributionState,
  RA_CONTRIBUTION_TYPES,
  formatCurrency,
  needsLumpSum,
  needsMonthly,
} from './model';

export function Step2RAContribution({
  state,
  onChange,
}: {
  state: RAContributionState;
  onChange: (s: RAContributionState) => void;
}) {
  const setCT = (ct: string) => {
    const next = { ...state, contribution_type: ct };
    if (!needsMonthly(ct)) {
      next.monthly_amount = '';
      next.monthly_adviser_assist = false;
    }
    if (!needsLumpSum(ct)) {
      next.lump_sum_amount = '';
      next.lump_sum_adviser_assist = false;
    }
    onChange(next);
  };

  const isAdviser = state.contribution_type === 'not_sure';
  const showMonthly = needsMonthly(state.contribution_type);
  const showLump = needsLumpSum(state.contribution_type);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Contribution type <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {RA_CONTRIBUTION_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => setCT(ct.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                state.contribution_type === ct.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {showMonthly && !isAdviser && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">
            Monthly contribution amount (ZAR)
          </Label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                R
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 3,000"
                value={state.monthly_amount}
                onChange={(e) =>
                  onChange({ ...state, monthly_amount: formatCurrency(e.target.value) })
                }
                disabled={state.monthly_adviser_assist}
                className="bg-white border-gray-300 h-10 pl-7"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...state,
                  monthly_adviser_assist: !state.monthly_adviser_assist,
                  monthly_amount: !state.monthly_adviser_assist ? '' : state.monthly_amount,
                })
              }
              className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                state.monthly_adviser_assist
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <HelpCircle className="h-3 w-3 inline mr-1" />
              Adviser assist
            </button>
          </div>
        </div>
      )}

      {showLump && !isAdviser && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">
            Lump sum contribution amount (ZAR)
          </Label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                R
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 100,000"
                value={state.lump_sum_amount}
                onChange={(e) =>
                  onChange({ ...state, lump_sum_amount: formatCurrency(e.target.value) })
                }
                disabled={state.lump_sum_adviser_assist}
                className="bg-white border-gray-300 h-10 pl-7"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...state,
                  lump_sum_adviser_assist: !state.lump_sum_adviser_assist,
                  lump_sum_amount: !state.lump_sum_adviser_assist ? '' : state.lump_sum_amount,
                })
              }
              className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                state.lump_sum_adviser_assist
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <HelpCircle className="h-3 w-3 inline mr-1" />
              Adviser assist
            </button>
          </div>
        </div>
      )}

      {isAdviser && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          Your adviser will recommend the best contribution structure for your situation.
        </p>
      )}
    </div>
  );
}
