import { MapPin, Globe } from 'lucide-react';
import {
  ReviewSection,
  ViewField,
  EditField,
  EditSelect,
  SyncIndicator,
  SectionProps,
  PROVINCES,
} from './shared';

export function AddressSection({ isEditing, fv, updateField, data }: SectionProps) {
  const addressParts = [
    data?.residentialAddressLine1,
    data?.residentialAddressLine2,
    data?.residentialSuburb,
    data?.residentialCity,
    data?.residentialProvince,
    data?.residentialPostalCode,
  ].filter(Boolean);

  return (
    <ReviewSection icon={MapPin} title="Residential Address">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <EditField
              label="Address Line 1"
              value={fv('residentialAddressLine1')}
              onChange={(v) => updateField('residentialAddressLine1', v)}
              placeholder="Street address"
            />
            <EditField
              label="Address Line 2"
              value={fv('residentialAddressLine2')}
              onChange={(v) => updateField('residentialAddressLine2', v)}
              placeholder="Apartment, suite, etc."
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <EditField
              label="Suburb"
              value={fv('residentialSuburb')}
              onChange={(v) => updateField('residentialSuburb', v)}
            />
            <EditField
              label="City"
              value={fv('residentialCity')}
              onChange={(v) => updateField('residentialCity', v)}
            />
            <EditSelect
              label="Province"
              value={fv('residentialProvince')}
              onChange={(v) => updateField('residentialProvince', v)}
              options={PROVINCES}
            />
            <EditField
              label="Postal Code"
              value={fv('residentialPostalCode')}
              onChange={(v) => updateField('residentialPostalCode', v)}
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <EditField
              label="Country"
              value={fv('residentialCountry')}
              onChange={(v) => updateField('residentialCountry', v)}
              icon={Globe}
            />
          </div>
        </div>
      ) : (
        <div className="contents">
          {addressParts.length > 0 ? (
            <div className="space-y-0.5">
              {data?.residentialAddressLine1 && (
                <div className="text-sm font-medium text-gray-900">
                  {data.residentialAddressLine1}
                </div>
              )}
              {data?.residentialAddressLine2 && (
                <div className="text-sm text-gray-700">{data.residentialAddressLine2}</div>
              )}
              <div className="text-sm text-gray-700">
                {[
                  data?.residentialSuburb,
                  data?.residentialCity,
                  data?.residentialProvince,
                  data?.residentialPostalCode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
              {data?.residentialCountry && (
                <div className="flex items-center gap-1.5 text-sm text-gray-700 mt-1">
                  <Globe className="h-3.5 w-3.5 text-gray-400" />
                  {data.residentialCountry}
                </div>
              )}
              <div className="flex items-center gap-1 mt-2">
                <SyncIndicator field="residentialAddressLine1" />
                <span className="text-[10px] text-gray-400">
                  All address fields sync to client profile
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-300 italic">No address provided</div>
          )}
        </div>
      )}
    </ReviewSection>
  );
}
