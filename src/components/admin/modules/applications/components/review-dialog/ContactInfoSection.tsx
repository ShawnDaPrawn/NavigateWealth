import { Mail, Phone, MessageSquare, Clock } from 'lucide-react';
import { ReviewSection, ViewField, EditField, EditSelect, SectionProps } from './shared';

export function ContactInfoSection({
  isEditing,
  fv,
  updateField,
  amendedFields,
  data,
}: SectionProps) {
  return (
    <ReviewSection icon={Mail} title="Contact Information">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <EditField
              label="Email Address"
              value={fv('emailAddress')}
              onChange={(v) => updateField('emailAddress', v)}
              icon={Mail}
              type="email"
              placeholder="client@example.com"
            />
            <EditField
              label="Cellphone"
              value={fv('cellphoneNumber')}
              onChange={(v) => updateField('cellphoneNumber', v)}
              icon={Phone}
              placeholder="+27 82 123 4567"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <EditField
              label="Alternative Email"
              value={fv('alternativeEmail')}
              onChange={(v) => updateField('alternativeEmail', v)}
              type="email"
            />
            <EditField
              label="WhatsApp Number"
              value={fv('whatsappNumber')}
              onChange={(v) => updateField('whatsappNumber', v)}
              icon={MessageSquare}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <EditField
              label="Alternative Cellphone"
              value={fv('alternativeCellphone')}
              onChange={(v) => updateField('alternativeCellphone', v)}
            />
            <EditSelect
              label="Preferred Contact Method"
              value={fv('preferredContactMethod')}
              onChange={(v) => updateField('preferredContactMethod', v)}
              options={['Email', 'Phone', 'WhatsApp', 'SMS']}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <ViewField
            label="Email Address"
            value={data?.emailAddress}
            icon={Mail}
            amended={amendedFields.has('emailAddress')}
            syncField="emailAddress"
          />
          {data?.alternativeEmail && (
            <ViewField
              label="Alternative Email"
              value={data.alternativeEmail}
              syncField="alternativeEmail"
            />
          )}
          <ViewField
            label="Cellphone"
            value={data?.cellphoneNumber}
            icon={Phone}
            amended={amendedFields.has('cellphoneNumber')}
            syncField="cellphoneNumber"
          />
          {data?.alternativeCellphone && (
            <ViewField
              label="Alt. Cellphone"
              value={data.alternativeCellphone}
              syncField="alternativeCellphone"
            />
          )}
          {data?.whatsappNumber && (
            <ViewField label="WhatsApp" value={data.whatsappNumber} icon={MessageSquare} />
          )}
          {data?.preferredContactMethod && (
            <ViewField
              label="Preferred Contact Method"
              value={data.preferredContactMethod}
              syncField="preferredContactMethod"
            />
          )}
          {data?.bestTimeToContact && (
            <ViewField label="Best Time to Contact" value={data.bestTimeToContact} icon={Clock} />
          )}
        </div>
      )}
    </ReviewSection>
  );
}
