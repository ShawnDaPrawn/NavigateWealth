import { Heart, Users } from 'lucide-react';
import { Label } from '../../../../../ui/label';
import { Separator } from '../../../../../ui/separator';
import {
  ReviewSection,
  ViewField,
  EditField,
  EditSelect,
  SectionProps,
  MARITAL_STATUSES,
  MARITAL_REGIMES,
} from './shared';

export function MaritalStatusSection({
  isEditing,
  fv,
  updateField,
  amendedFields,
  data,
}: SectionProps) {
  const hasSpouseDetails = data?.spouseFirstName;

  return (
    <ReviewSection icon={Heart} title="Marital Status">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <EditSelect
              label="Marital Status"
              value={fv('maritalStatus')}
              onChange={(v) => updateField('maritalStatus', v)}
              options={MARITAL_STATUSES}
            />
            {(fv('maritalStatus') === 'Married' || fv('maritalStatus') === 'Life Partner') && (
              <div className="col-span-2">
                <EditSelect
                  label="Marital Regime"
                  value={fv('maritalRegime')}
                  onChange={(v) => updateField('maritalRegime', v)}
                  options={MARITAL_REGIMES}
                />
              </div>
            )}
          </div>
          {(fv('maritalStatus') === 'Married' || fv('maritalStatus') === 'Life Partner') && (
            <div className="contents">
              <Separator />
              <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Spouse / Partner Details
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <EditField
                  label="Spouse First Name"
                  value={fv('spouseFirstName')}
                  onChange={(v) => updateField('spouseFirstName', v)}
                />
                <EditField
                  label="Spouse Last Name"
                  value={fv('spouseLastName')}
                  onChange={(v) => updateField('spouseLastName', v)}
                />
                <EditField
                  label="Spouse Date of Birth"
                  value={fv('spouseDateOfBirth')}
                  onChange={(v) => updateField('spouseDateOfBirth', v)}
                  type="date"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="contents">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <ViewField
              label="Marital Status"
              value={data?.maritalStatus}
              amended={amendedFields.has('maritalStatus')}
              syncField="maritalStatus"
            />
            {data?.maritalRegime && (
              <ViewField
                label="Marital Regime"
                value={data.maritalRegime}
                amended={amendedFields.has('maritalRegime')}
                syncField="maritalRegime"
              />
            )}
          </div>
          {hasSpouseDetails && (
            <div className="contents">
              <Separator className="my-4" />
              <div>
                <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-3">
                  <Users className="h-3 w-3" /> Spouse / Partner Details
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                  <ViewField
                    label="Spouse Name"
                    value={`${data.spouseFirstName || ''} ${data.spouseLastName || ''}`.trim()}
                  />
                  {data.spouseDateOfBirth && (
                    <ViewField
                      label="Spouse Date of Birth"
                      value={new Date(data.spouseDateOfBirth).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    />
                  )}
                  {data.spouseEmployed && (
                    <ViewField
                      label="Spouse Employed"
                      value={
                        data.spouseEmployed === 'yes'
                          ? 'Yes'
                          : data.spouseEmployed === 'no'
                            ? 'No'
                            : data.spouseEmployed
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ReviewSection>
  );
}
