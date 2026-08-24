/**
 * Step2Contributions of the investment quote wizard. One step slice —
 * see InvestmentQuoteWizard.tsx for the state machine.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { TrendingUp, HelpCircle } from 'lucide-react';
import {
  CONTRIBUTION_TYPES,
  formatCurrency,
  needsLumpSum,
  needsMonthly,
  getLabelForType,
  getInitialContribution,
  type ContributionEntry,
} from './model';

export function Step2Contributions({
  selectedTypes,
  contributions,
  onChange,
}: {
  selectedTypes: string[];
  contributions: Record<string, ContributionEntry>;
  onChange: (c: Record<string, ContributionEntry>) => void;
}) {
  const updateEntry = (typeId: string, partial: Partial<ContributionEntry>) => {
    const current = contributions[typeId] || getInitialContribution();
    const next = { ...current, ...partial };

    // Reset amounts when switching contribution type
    if (partial.contribution_type !== undefined) {
      if (!needsLumpSum(partial.contribution_type)) {
        next.lump_sum_amount = '';
        next.lump_sum_adviser_assist = false;
      }
      if (!needsMonthly(partial.contribution_type)) {
        next.monthly_amount = '';
        next.monthly_adviser_assist = false;
      }
    }

    onChange({ ...contributions, [typeId]: next });
  };

  // Filter to actual investment types (skip 'not_sure')
  const typesToShow = selectedTypes.filter((t) => t !== 'not_sure');
  const onlyAdviserAssist = selectedTypes.length === 1 && selectedTypes[0] === 'not_sure';

  if (onlyAdviserAssist) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            How would you like to contribute?
          </h2>
          <p className="text-sm text-gray-500">
            You've selected adviser assistance for the investment type. Our adviser will recommend
            contribution structures based on your profile.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-primary/[0.03] border border-primary/20 text-sm text-gray-700 flex items-start gap-2">
          <HelpCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <span>No contribution details required — your adviser will discuss this with you.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">How would you like to contribute?</h2>
        <p className="text-sm text-gray-500">
          For each selected investment, choose your contribution method and amount.
        </p>
      </div>

      {typesToShow.map((typeId) => {
        const entry = contributions[typeId] || getInitialContribution();
        const label = getLabelForType(typeId);
        const isAdviser = entry.contribution_type === 'not_sure';
        const showLump = needsLumpSum(entry.contribution_type);
        const showMonthly = needsMonthly(entry.contribution_type);

        return (
          <div key={typeId} className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {label}
            </h3>

            {/* Contribution type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">
                Contribution type <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {CONTRIBUTION_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => updateEntry(typeId, { contribution_type: ct.value })}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                      entry.contribution_type === ct.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lump sum amount */}
            {showLump && !isAdviser && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Lump sum amount (ZAR)</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      R
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 50,000"
                      value={entry.lump_sum_amount}
                      onChange={(e) =>
                        updateEntry(typeId, { lump_sum_amount: formatCurrency(e.target.value) })
                      }
                      disabled={entry.lump_sum_adviser_assist}
                      className="bg-white border-gray-300 h-10 pl-7"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateEntry(typeId, {
                        lump_sum_adviser_assist: !entry.lump_sum_adviser_assist,
                        lump_sum_amount: !entry.lump_sum_adviser_assist
                          ? ''
                          : entry.lump_sum_amount,
                      })
                    }
                    className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                      entry.lump_sum_adviser_assist
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

            {/* Monthly amount */}
            {showMonthly && !isAdviser && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  Monthly amount (ZAR /month)
                </Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      R
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 2,000"
                      value={entry.monthly_amount}
                      onChange={(e) =>
                        updateEntry(typeId, { monthly_amount: formatCurrency(e.target.value) })
                      }
                      disabled={entry.monthly_adviser_assist}
                      className="bg-white border-gray-300 h-10 pl-7"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateEntry(typeId, {
                        monthly_adviser_assist: !entry.monthly_adviser_assist,
                        monthly_amount: !entry.monthly_adviser_assist ? '' : entry.monthly_amount,
                      })
                    }
                    className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                      entry.monthly_adviser_assist
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
                Your adviser will recommend the best contribution structure for this investment.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 3: Objective & Time Horizon ────────────────────────────────────────────
