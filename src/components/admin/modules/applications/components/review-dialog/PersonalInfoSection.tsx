import { User } from 'lucide-react';
import { ReviewSection, ViewField, EditField, EditSelect, SectionProps } from './shared';
import { TITLES, GENDERS } from './reviewDialogOptions';

export function PersonalInfoSection({
  isEditing,
  fv,
  updateField,
  amendedFields,
  data,
}: SectionProps) {
  const fullName = [data?.title, data?.firstName, data?.middleName, data?.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <ReviewSection icon={User} title="Personal Information">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <EditSelect
              label="Title"
              value={fv('title')}
              onChange={(v) => updateField('title', v)}
              options={TITLES}
            />
            <EditField
              label="First Name"
              value={fv('firstName')}
              onChange={(v) => updateField('firstName', v)}
              placeholder="First name"
            />
            <EditField
              label="Middle Name"
              value={fv('middleName')}
              onChange={(v) => updateField('middleName', v)}
            />
            <EditField
              label="Last Name"
              value={fv('lastName')}
              onChange={(v) => updateField('lastName', v)}
              placeholder="Last name"
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <EditField
              label="Preferred Name"
              value={fv('preferredName')}
              onChange={(v) => updateField('preferredName', v)}
            />
            <EditField
              label="Date of Birth"
              value={fv('dateOfBirth')}
              onChange={(v) => updateField('dateOfBirth', v)}
              type="date"
            />
            <EditSelect
              label="Gender"
              value={fv('gender')}
              onChange={(v) => updateField('gender', v)}
              options={GENDERS}
            />
            <EditField
              label="Nationality"
              value={fv('nationality')}
              onChange={(v) => updateField('nationality', v)}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <ViewField
            label="Full Name"
            value={fullName}
            amended={amendedFields.has('firstName') || amendedFields.has('lastName')}
            syncField="firstName"
          />
          {data?.preferredName && data.preferredName !== data.firstName && (
            <ViewField label="Known As" value={data.preferredName} />
          )}
          <ViewField
            label="Date of Birth"
            value={
              data?.dateOfBirth
                ? new Date(data.dateOfBirth).toLocaleDateString('en-ZA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : undefined
            }
            syncField="dateOfBirth"
          />
          <ViewField label="Gender" value={data?.gender} syncField="gender" />
          <ViewField label="Nationality" value={data?.nationality} syncField="nationality" />
          <ViewField
            label="SA Tax Resident"
            value={
              data?.isSATaxResident === true
                ? 'Yes'
                : data?.isSATaxResident === false
                  ? 'No'
                  : undefined
            }
          />
        </div>
      )}
    </ReviewSection>
  );
}
