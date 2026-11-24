/**
 * Smoking history and alcohol use, replacing the single "Smoker" switch in the
 * Health section of both profile editors. `smokerStatus` keeps its meaning
 * (smokes now) because quotes, reports and the overview PDF read it; a former
 * smoker is recorded alongside it, which is what insurers underwrite on.
 */
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { ALCOHOL_CONSUMPTION_OPTIONS } from '../../../shared/client-profile';
import { type Audience, says } from './fieldHelpers';

type SmokingStatus = 'never' | 'former' | 'current';

export interface SmokingAlcoholValue {
  smokerStatus: boolean;
  formerSmoker: boolean;
  quitSmokingYear: string;
  alcoholConsumption: string;
}

export function SmokingAlcoholFields({
  value,
  onChange,
  audience,
}: {
  value: SmokingAlcoholValue;
  onChange: (field: keyof SmokingAlcoholValue, value: string | boolean) => void;
  audience: Audience;
}) {
  const status: SmokingStatus = value.smokerStatus
    ? 'current'
    : value.formerSmoker
      ? 'former'
      : 'never';

  const setStatus = (next: SmokingStatus) => {
    onChange('smokerStatus', next === 'current');
    onChange('formerSmoker', next === 'former');
    if (next !== 'former') onChange('quitSmokingYear', '');
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="smokingStatus">Smoking (including vaping and other nicotine)</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as SmokingStatus)}>
          <SelectTrigger id="smokingStatus" className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="never">Never smoked</SelectItem>
            <SelectItem value="former">Former smoker</SelectItem>
            <SelectItem value="current">Current smoker</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {status === 'former' && (
        <div>
          <Label htmlFor="quitSmokingYear">Year stopped</Label>
          <Input
            id="quitSmokingYear"
            inputMode="numeric"
            maxLength={4}
            value={value.quitSmokingYear}
            onChange={(e) => onChange('quitSmokingYear', e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 2019"
            className="mt-1.5"
          />
        </div>
      )}
      <div className={status === 'former' ? 'sm:col-span-2' : ''}>
        <Label htmlFor="alcoholConsumption">
          {says(audience, 'How often do you drink alcohol?', 'Alcohol consumption')}
        </Label>
        <Select
          value={value.alcoholConsumption}
          onValueChange={(v) => onChange('alcoholConsumption', v)}
        >
          <SelectTrigger id="alcoholConsumption" className="mt-1.5">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {ALCOHOL_CONSUMPTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
