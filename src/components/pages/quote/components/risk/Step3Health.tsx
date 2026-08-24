/**
 * Step3Health of the risk quote wizard. One step slice —
 * see RiskQuoteWizard.tsx for the state machine.
 */
import { Label } from '../../../../ui/label';
import { CheckCircle, Stethoscope } from 'lucide-react';
import { CHRONIC_PRESETS, type HealthDisclosures } from './model';

export function Step3Health({
  disclosures,
  onChange,
}: {
  disclosures: HealthDisclosures;
  onChange: (d: HealthDisclosures) => void;
}) {
  const toggleCondition = (condition: string) => {
    const current = disclosures.selected_conditions;
    const updated = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    onChange({
      ...disclosures,
      has_conditions:
        updated.length > 0 || disclosures.free_text.trim().length > 0
          ? true
          : disclosures.has_conditions,
      selected_conditions: updated,
    });
  };

  const setNone = () => {
    onChange({ has_conditions: false, selected_conditions: [], free_text: '' });
  };

  const setHas = () => {
    onChange({ ...disclosures, has_conditions: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Any ongoing or chronic conditions?</h2>
        <p className="text-sm text-gray-500">
          This helps us pre-screen underwriting options. It's not a medical form -- just a
          light-touch disclosure.
        </p>
      </div>

      {/* Yes / No toggle */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={setNone}
          className={`flex-1 rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
            disclosures.has_conditions === false
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <CheckCircle
            className={`h-4 w-4 mx-auto mb-1 ${disclosures.has_conditions === false ? 'text-green-500' : 'text-gray-300'}`}
          />
          None
        </button>
        <button
          type="button"
          onClick={setHas}
          className={`flex-1 rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
            disclosures.has_conditions === true
              ? 'border-primary/50 bg-primary/[0.03] text-primary'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <Stethoscope
            className={`h-4 w-4 mx-auto mb-1 ${disclosures.has_conditions === true ? 'text-primary' : 'text-gray-300'}`}
          />
          Yes, I have conditions
        </button>
      </div>

      {/* Condition chips + free text (shown when has_conditions is true) */}
      {disclosures.has_conditions === true && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-2 block">
              Quick select (optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {CHRONIC_PRESETS.map((condition) => {
                const isSelected = disclosures.selected_conditions.includes(condition);
                return (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => toggleCondition(condition)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {condition}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">
              Additional details or other conditions
            </Label>
            <textarea
              rows={3}
              placeholder="e.g., high blood pressure, cholesterol, hyperthyroid..."
              value={disclosures.free_text}
              onChange={(e) => onChange({ ...disclosures, free_text: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
