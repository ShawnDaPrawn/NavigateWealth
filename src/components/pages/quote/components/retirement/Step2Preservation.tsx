/**
 * Step 2 (preservation) — the fund being transferred.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines) on the same pattern as
 * the medical aid wizard: each step was already a self-contained function with
 * its own props; only its address changed.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { type PreservationState, formatCurrency } from './model';

export function Step2Preservation({
  fundType,
  state,
  onChange,
}: {
  fundType: 'provident' | 'pension';
  state: PreservationState;
  onChange: (s: PreservationState) => void;
}) {
  const fundLabel = fundType === 'provident' ? 'provident' : 'pension';

  return (
    <div className="space-y-4">
      {/* Transferring? */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you transferring from a previous employer's {fundLabel} fund?{' '}
          <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange({ ...state, is_transferring: opt.value })}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                state.is_transferring === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transfer amount */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Estimated transfer amount</Label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              R
            </span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 250,000"
              value={state.transfer_amount}
              onChange={(e) =>
                onChange({ ...state, transfer_amount: formatCurrency(e.target.value) })
              }
              disabled={state.transfer_not_sure}
              className="bg-white border-gray-300 h-10 pl-7"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...state,
                transfer_not_sure: !state.transfer_not_sure,
                transfer_amount: !state.transfer_not_sure ? '' : state.transfer_amount,
              })
            }
            className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
              state.transfer_not_sure
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            Not sure
          </button>
        </div>
        <p className="text-xs text-gray-400">
          No new contributions are allowed on preservation funds.
        </p>
      </div>
    </div>
  );
}
