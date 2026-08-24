/**
 * Renders a single form field of a risk-assessment template. Pure view —
 * the panel owns the values and change handling.
 */
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import { CheckCircle } from 'lucide-react';

import type { FormField } from './riskAssessmentModel';

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Renders a single form field */
export function FormFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === 'section') {
    return (
      <div className="border-b border-gray-200 pb-1 pt-2">
        <h4 className="text-sm font-semibold text-gray-800">{field.label}</h4>
        {field.description && <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={field.id}
        className="text-sm font-medium text-gray-700 flex items-center gap-1"
      >
        {field.label}
        {field.required && <span className="text-red-500 text-xs">*</span>}
      </Label>
      {field.description && <p className="text-xs text-gray-400">{field.description}</p>}

      {/* Text Input */}
      {field.type === 'text' && (
        <Input
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="h-9 text-sm"
        />
      )}

      {/* Number Input */}
      {field.type === 'number' && (
        <Input
          id={field.id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="h-9 text-sm max-w-[200px]"
        />
      )}

      {/* Textarea */}
      {field.type === 'textarea' && (
        <textarea
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          rows={3}
        />
      )}

      {/* Select */}
      {field.type === 'select' && field.options && (
        <select
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Select...</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* Radio Buttons */}
      {field.type === 'radio' && field.options && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                value === opt.value
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium ring-1 ring-purple-200'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Rating (1-5 or 1-10 scale) */}
      {field.type === 'rating' && (
        <div className="flex gap-1 pt-0.5">
          {(
            field.options || [
              { label: '1', value: '1' },
              { label: '2', value: '2' },
              { label: '3', value: '3' },
              { label: '4', value: '4' },
              { label: '5', value: '5' },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`w-10 h-10 rounded-lg border text-sm font-medium transition-all ${
                value === opt.value
                  ? 'border-purple-500 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Checkbox (multi-select) */}
      {field.type === 'checkbox' && field.options && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {field.options.map((opt) => {
            const selected = value.split(',').includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = value ? value.split(',') : [];
                  const next = selected
                    ? current.filter((v) => v !== opt.value)
                    : [...current, opt.value];
                  onChange(next.filter(Boolean).join(','));
                }}
                className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                  selected
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {selected && <CheckCircle className="h-3 w-3 mr-1 inline" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
