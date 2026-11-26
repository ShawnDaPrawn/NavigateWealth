/**
 * How the client's working time at one employer splits across Admin, Travel,
 * Supervision and Manual duties: edited inside an employer card, summarised
 * when the card is closed. Used by the Employment section of both profile
 * editors.
 */
import { NumberInputField } from '../../ui/number-input';
import { Label } from '../../ui/label';
import {
  OCCUPATIONAL_DUTY_FIELDS,
  normalizeOccupationalDuties,
  occupationalDutiesError,
  occupationalDutiesLine,
  occupationalDutiesTotal,
  type OccupationalDuties,
} from '../../../shared/client-profile';

const BAR_COLOURS: Record<keyof OccupationalDuties, string> = {
  admin: 'bg-[#6d28d9]',
  travel: 'bg-sky-500',
  supervision: 'bg-amber-500',
  manual: 'bg-emerald-500',
};

export function OccupationalDutiesFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: OccupationalDuties | undefined;
  onChange: (next: OccupationalDuties) => void;
}) {
  const duties = normalizeOccupationalDuties(value);
  const total = occupationalDutiesTotal(duties);
  const error = occupationalDutiesError(duties);

  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <h5 className="text-sm font-medium text-gray-900">Occupational duties</h5>
        <p className="text-xs text-gray-500">
          Share of working time spent on each type of duty. The four must add up to 100%.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {OCCUPATIONAL_DUTY_FIELDS.map(({ field, label, hint }) => (
          <div key={field}>
            <Label htmlFor={`${idPrefix}-duty-${field}`}>{label} (%)</Label>
            <NumberInputField
              id={`${idPrefix}-duty-${field}`}
              value={duties[field]}
              onValueChange={(v) => onChange({ ...duties, [field]: Math.min(100, v ?? 0) })}
              aria-describedby={`${idPrefix}-duty-${field}-hint`}
              className="mt-1.5 bg-white"
            />
            <p id={`${idPrefix}-duty-${field}-hint`} className="mt-1 text-[11px] text-gray-500">
              {hint}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200"
          aria-hidden="true"
        >
          {OCCUPATIONAL_DUTY_FIELDS.map(({ field }) =>
            duties[field] > 0 ? (
              <div
                key={field}
                className={BAR_COLOURS[field]}
                style={{ width: `${(duties[field] / Math.max(100, total)) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <p
          className={`text-xs ${error ? 'text-amber-600' : total === 100 ? 'text-green-700' : 'text-gray-500'}`}
          role={error ? 'alert' : undefined}
        >
          Total: {total}%{error ? ' — must add up to 100%' : ''}
        </p>
      </div>
    </div>
  );
}

export function OccupationalDutiesSummary({ value }: { value: OccupationalDuties | undefined }) {
  const line = occupationalDutiesLine(value);
  if (!line) return null;
  return (
    <div className="sm:col-span-2">
      <p className="text-gray-600 text-[14px]">Occupational duties</p>
      <p className="mt-0.5 text-gray-900">{line}</p>
    </div>
  );
}
