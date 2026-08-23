/**
 * Step1Covers of the risk quote wizard. One step slice —
 * see RiskQuoteWizard.tsx for the state machine.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import { CheckCircle, HelpCircle, Info } from 'lucide-react';
import { COVER_OPTIONS, formatCurrency, type RiskNeeds } from './model';

export function Step1Covers({
  riskNeeds,
  onChange,
}: {
  riskNeeds: RiskNeeds;
  onChange: (needs: RiskNeeds) => void;
}) {
  const toggleCover = (id: string) => {
    onChange({
      ...riskNeeds,
      [id]: { ...riskNeeds[id], selected: !riskNeeds[id].selected },
    });
  };

  const setAmount = (id: string, value: string) => {
    onChange({
      ...riskNeeds,
      [id]: { ...riskNeeds[id], amount: formatCurrency(value) },
    });
  };

  const toggleAdviser = (id: string) => {
    onChange({
      ...riskNeeds,
      [id]: { ...riskNeeds[id], adviser_assist: !riskNeeds[id].adviser_assist },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What cover do you want to quote?</h2>
        <p className="text-sm text-gray-500">
          Select one or more covers and enter amounts, or request adviser assistance.
        </p>
      </div>

      <div className="space-y-3">
        {COVER_OPTIONS.map((cover) => {
          const entry = riskNeeds[cover.id];
          return (
            <div
              key={cover.id}
              className={`rounded-xl border-2 transition-all ${
                entry.selected
                  ? 'border-primary/50 bg-primary/[0.02] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Header row */}
              <button
                type="button"
                onClick={() => toggleCover(cover.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    entry.selected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                  }`}
                >
                  {entry.selected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-gray-900 text-sm">{cover.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                    {cover.infoBlip}
                  </p>
                </div>
              </button>

              {/* Expanded inputs */}
              {entry.selected && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      {cover.isMonthly
                        ? 'Monthly amount (ZAR / month, real value)'
                        : 'Cover amount (ZAR)'}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        R
                      </span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder={cover.isMonthly ? 'e.g. 35 000' : 'e.g. 2 000 000'}
                        value={entry.amount}
                        onChange={(e) => setAmount(cover.id, e.target.value)}
                        disabled={entry.adviser_assist}
                        className={`pl-8 h-10 bg-white border-gray-300 ${entry.adviser_assist ? 'opacity-50' : ''}`}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <Checkbox
                      checked={entry.adviser_assist}
                      onCheckedChange={() => toggleAdviser(cover.id)}
                    />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900 transition-colors">
                      Require adviser assistance determining my cover amount
                    </span>
                  </label>

                  {!entry.adviser_assist && !entry.amount && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      Not sure? Choose adviser assistance and we'll calculate this with you.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
