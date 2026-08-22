/**
 * Step 2 — cover type, network and budget.
 *
 * Split out of `MedicalAidQuoteWizard.tsx` (1,534 lines), where all five steps
 * shared one file with the wizard itself. It was already a self-contained
 * function with its own props; only its address changed.
 */
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
  BUDGET_BANDS,
  COVER_TYPES,
  NETWORK_OPTIONS,
  type PreferencesState,
  SA_PROVINCES,
} from './model';

export function Step2Preferences({
  preferences,
  onChange,
}: {
  preferences: PreferencesState;
  onChange: (p: PreferencesState) => void;
}) {
  const update = (field: keyof PreferencesState, value: string) => {
    onChange({ ...preferences, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What kind of cover do you want?</h2>
        <p className="text-sm text-gray-500">Help us narrow down the best options for you.</p>
      </div>

      {/* Cover type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Cover type <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {COVER_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => update('cover_type', ct.value)}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                preferences.cover_type === ct.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                  preferences.cover_type === ct.value ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {preferences.cover_type === ct.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900">{ct.label}</span>
                <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                  {ct.info}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Network */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Network preference <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {NETWORK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('network', opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                preferences.network === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  preferences.network === opt.value ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {preferences.network === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Monthly budget <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {BUDGET_BANDS.map((band) => (
            <button
              key={band.value}
              type="button"
              onClick={() => update('budget_band', band.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                preferences.budget_band === band.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {band.label}
            </button>
          ))}
        </div>
      </div>

      {/* Province */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Province <span className="text-red-500">*</span>
        </Label>
        <Select value={preferences.province} onValueChange={(v) => update('province', v)}>
          <SelectTrigger className="bg-white border-gray-300 h-11">
            <SelectValue placeholder="Select your province" />
          </SelectTrigger>
          <SelectContent>
            {SA_PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── Step 3: Medical Aid History + LPJ ───────────────────────────────────────────
