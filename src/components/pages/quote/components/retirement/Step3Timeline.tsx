/**
 * Step 3 — retirement age and horizon.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines) on the same pattern as
 * the medical aid wizard: each step was already a self-contained function with
 * its own props; only its address changed.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { type TimelineState } from './model';

export function Step3Timeline({
  timeline,
  onChange,
}: {
  timeline: TimelineState;
  onChange: (t: TimelineState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">When do you plan to retire?</h2>
        <p className="text-sm text-gray-500">
          This helps your adviser assess time horizon and product suitability.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Current age <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min={18}
            max={100}
            placeholder="e.g. 38"
            value={timeline.current_age}
            onChange={(e) => onChange({ ...timeline, current_age: e.target.value })}
            className="bg-white border-gray-300 h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Planned retirement age <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min={55}
            max={100}
            placeholder="e.g. 65"
            value={timeline.planned_retirement_age}
            onChange={(e) => onChange({ ...timeline, planned_retirement_age: e.target.value })}
            className="bg-white border-gray-300 h-11"
          />
        </div>
      </div>

      {/* Member of a retirement fund */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you currently a member of any retirement fund?
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() =>
                onChange({
                  ...timeline,
                  member_of_retirement_fund: opt.value,
                  fund_details: opt.value ? timeline.fund_details : '',
                })
              }
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                timeline.member_of_retirement_fund === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {timeline.member_of_retirement_fund === true && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Which fund(s)?</Label>
          <Input
            type="text"
            placeholder="e.g. Old Mutual RA, Employer pension fund"
            value={timeline.fund_details}
            onChange={(e) => onChange({ ...timeline, fund_details: e.target.value })}
            className="bg-white border-gray-300 h-10"
          />
        </div>
      )}
    </div>
  );
}

// ── Step 4: Financial Snapshot ───────────────────────────────────────────────────
