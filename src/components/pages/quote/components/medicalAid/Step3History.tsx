/**
 * Step 3 — existing and previous medical aid.
 *
 * Split out of `MedicalAidQuoteWizard.tsx` (1,534 lines), where all five steps
 * shared one file with the wizard itself. It was already a self-contained
 * function with its own props; only its address changed.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Info } from 'lucide-react';
import {
  COMMON_SCHEMES,
  LPJ_OPTIONS,
  type MedicalAidHistoryState,
  TENURE_OFF_OPTIONS,
  TENURE_ON_OPTIONS,
} from './model';

export function Step3History({
  history,
  mainMemberAge,
  onChange,
}: {
  history: MedicalAidHistoryState;
  mainMemberAge: number | null;
  onChange: (h: MedicalAidHistoryState) => void;
}) {
  const update = (field: keyof MedicalAidHistoryState, value: string) => {
    onChange({ ...history, [field]: value });
  };

  const setStatus = (status: string) => {
    // Reset dependent fields when switching
    const next = { ...history, current_status: status };
    if (status === 'currently_on') {
      next.time_without_sa_medical_aid = '';
    } else {
      next.current_scheme = '';
      next.current_plan = '';
      next.current_tenure_band = '';
    }
    onChange(next);
  };

  const isCurrentlyOn = history.current_status === 'currently_on';
  const isNotCurrentlyOn = history.current_status === 'not_currently_on';
  const showLpj = mainMemberAge !== null && mainMemberAge >= 35;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Current medical aid history</h2>
        <p className="text-sm text-gray-500">
          This helps us determine the best options and any applicable waiting periods.
        </p>
      </div>

      {/* Current status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Current cover status <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {[
            { value: 'currently_on', label: 'I am currently on a South African medical aid' },
            {
              value: 'not_currently_on',
              label: 'I am not currently on a South African medical aid',
            },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                history.current_status === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  history.current_status === opt.value ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {history.current_status === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* If currently on */}
      {isCurrentlyOn && (
        <div className="space-y-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Current scheme name <span className="text-red-500">*</span>
            </Label>
            <Select
              value={history.current_scheme}
              onValueChange={(v) => update('current_scheme', v)}
            >
              <SelectTrigger className="bg-white border-gray-300 h-11">
                <SelectValue placeholder="Select your scheme" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_SCHEMES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Current plan name <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g. Classic Saver"
              value={history.current_plan}
              onChange={(e) => update('current_plan', e.target.value)}
              className="bg-white border-gray-300 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              How long have you been on this scheme? <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {TENURE_ON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('current_tenure_band', opt.value)}
                  className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                    history.current_tenure_band === opt.value
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
      )}

      {/* If not currently on */}
      {isNotCurrentlyOn && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <Label className="text-sm font-medium text-gray-700">
            How long have you been without a South African medical aid?{' '}
            <span className="text-red-500">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {TENURE_OFF_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('time_without_sa_medical_aid', opt.value)}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  history.time_without_sa_medical_aid === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LPJ question — only if main member age >= 35 */}
      {showLpj && history.current_status && (
        <div className="space-y-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200/60">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <Label className="text-sm font-medium text-gray-900">
                Since turning 35, how long in total have you been without a South African medical
                aid? <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-amber-700 mt-1">
                Some schemes apply late-joiner penalties if you join later in life after being
                without cover.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {LPJ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('lpj_time_off_since_35', opt.value)}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  history.lpj_time_off_since_35 === opt.value
                    ? 'border-amber-500 bg-amber-100 text-amber-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Health & Chronic Conditions ──────────────────────────────────────────
