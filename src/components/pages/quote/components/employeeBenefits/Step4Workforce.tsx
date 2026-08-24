/**
 * Step4Workforce of the employee benefits quote wizard. One step slice —
 * see EmployeeBenefitsQuoteWizard.tsx for the state machine.
 */
import { Label } from '../../../../ui/label';
import { AGE_BAND_OPTIONS, WORKFORCE_TYPE_OPTIONS, type WorkforceState } from './model';

export function Step4Workforce({
  workforce,
  onChange,
}: {
  workforce: WorkforceState;
  onChange: (w: WorkforceState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Workforce overview</h2>
        <p className="text-sm text-gray-500">
          A high-level view of your workforce helps your adviser structure the right solution.
        </p>
      </div>

      {/* Average age band */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Average employee age band <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {AGE_BAND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...workforce, average_age_band: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                workforce.average_age_band === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workforce type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are employees primarily: <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {WORKFORCE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...workforce, workforce_type: opt.value })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                workforce.workforce_type === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Existing benefits */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you currently have any employee benefits in place?{' '}
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
              onClick={() =>
                onChange({
                  ...workforce,
                  has_existing_benefits: opt.value,
                  existing_benefits_description: opt.value
                    ? workforce.existing_benefits_description
                    : '',
                })
              }
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                workforce.has_existing_benefits === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {workforce.has_existing_benefits === true && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">
            Briefly describe current arrangement <span className="text-gray-400">(optional)</span>
          </Label>
          <textarea
            placeholder="e.g. Group RA with Old Mutual, basic group life cover"
            value={workforce.existing_benefits_description}
            onChange={(e) =>
              onChange({ ...workforce, existing_benefits_description: e.target.value })
            }
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
        </div>
      )}
    </div>
  );
}
