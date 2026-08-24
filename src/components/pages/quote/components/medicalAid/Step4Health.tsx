/**
 * Step 4 — chronic conditions.
 *
 * Split out of `MedicalAidQuoteWizard.tsx` (1,534 lines), where all five steps
 * shared one file with the wizard itself. It was already a self-contained
 * function with its own props; only its address changed.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { CheckCircle } from 'lucide-react';
import { CHRONIC_PRESETS, type HealthState } from './model';

export function Step4Health({
  health,
  memberLabels,
  onChange,
}: {
  health: HealthState;
  memberLabels: string[];
  onChange: (h: HealthState) => void;
}) {
  const toggleCondition = (condition: string) => {
    const selected = health.selected_conditions.includes(condition)
      ? health.selected_conditions.filter((c) => c !== condition)
      : [...health.selected_conditions, condition];
    onChange({ ...health, selected_conditions: selected });
  };

  const toggleMember = (label: string) => {
    const selected = health.applies_to_members.includes(label)
      ? health.applies_to_members.filter((m) => m !== label)
      : [...health.applies_to_members, label];
    onChange({ ...health, applies_to_members: selected });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Health & chronic conditions</h2>
        <p className="text-sm text-gray-500">
          This helps us identify plans that cover chronic medication benefits.
        </p>
      </div>

      {/* Has chronic conditions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Any diagnosed chronic conditions? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: false, label: 'No' },
            { value: true, label: 'Yes' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() =>
                onChange({
                  ...health,
                  has_chronic_conditions: opt.value,
                  // Reset if switching to No
                  ...(opt.value === false
                    ? { selected_conditions: [], applies_to_members: [], notes: '' }
                    : {}),
                })
              }
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                health.has_chronic_conditions === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Condition chips + member selection (only if Yes) */}
      {health.has_chronic_conditions === true && (
        <div className="space-y-4">
          {/* Condition chips */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Select conditions</Label>
            <div className="flex flex-wrap gap-2">
              {CHRONIC_PRESETS.map((condition) => {
                const isSelected = health.selected_conditions.includes(condition);
                return (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => toggleCondition(condition)}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle className="h-3 w-3 inline mr-1.5" />}
                    {condition}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free text */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Add details (optional)</Label>
            <Input
              type="text"
              placeholder="e.g. Controlled with medication"
              value={health.notes}
              onChange={(e) => onChange({ ...health, notes: e.target.value })}
              className="bg-white border-gray-300 h-10"
            />
          </div>

          {/* Which members */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Which member(s) does this apply to? <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {memberLabels.map((label) => {
                const isSelected = health.applies_to_members.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleMember(label)}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle className="h-3 w-3 inline mr-1.5" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Review & Submit ─────────────────────────────────────────────────────
