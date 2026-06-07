import { Fingerprint } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { ReviewSection, ViewField, EditField, EditSelect, SectionProps } from './shared';

export function IdentificationSection({
  isEditing,
  fv,
  updateField,
  amendedFields,
  data,
}: SectionProps) {
  return (
    <ReviewSection
      icon={Fingerprint}
      title="Identification"
      badge={
        data?.idType ? (
          <Badge variant="outline" className="text-[10px] font-medium ml-2">
            {data.idType === 'sa_id' ? 'SA ID' : 'Passport'}
          </Badge>
        ) : undefined
      }
    >
      {isEditing ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <EditSelect
            label="ID Type"
            value={fv('idType')}
            onChange={(v) => updateField('idType', v)}
            options={[
              { value: 'sa_id', label: 'SA ID Number' },
              { value: 'passport', label: 'Passport' },
            ]}
          />
          <EditField
            label="ID / Passport Number"
            value={fv('idNumber')}
            onChange={(v) => updateField('idNumber', v)}
            placeholder="ID number"
          />
          <EditField
            label="Tax Number"
            value={fv('taxNumber')}
            onChange={(v) => updateField('taxNumber', v)}
            placeholder="10-digit number"
          />
          <EditField
            label="Number of Dependants"
            value={fv('numberOfDependants')}
            onChange={(v) => updateField('numberOfDependants', v)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <ViewField
            label="ID Type"
            value={
              data?.idType === 'sa_id'
                ? 'South African ID Number'
                : data?.idType === 'passport'
                  ? 'Passport Number'
                  : undefined
            }
            amended={amendedFields.has('idType')}
          />
          <ViewField
            label="ID / Passport Number"
            value={data?.idNumber}
            amended={amendedFields.has('idNumber')}
            syncField="idNumber"
          />
          <ViewField
            label="Tax Number"
            value={data?.taxNumber}
            amended={amendedFields.has('taxNumber')}
            syncField="taxNumber"
          />
          <ViewField label="Number of Dependants" value={data?.numberOfDependants} />
        </div>
      )}
    </ReviewSection>
  );
}
