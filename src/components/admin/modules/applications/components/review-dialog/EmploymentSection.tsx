import { Briefcase, DollarSign, Building } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import {
  ReviewSection,
  ViewField,
  EditField,
  EditSelect,
  SectionProps,
  EMPLOYMENT_STATUSES,
} from './shared';

export function EmploymentSection({
  isEditing,
  fv,
  updateField,
  amendedFields,
  data,
}: SectionProps) {
  const hasEmploymentDetails = data?.employmentStatus && data.employmentStatus !== '';
  const isSelfEmployed = data?.employmentStatus === 'self-employed';
  const isEmployed = data?.employmentStatus === 'employed' || data?.employmentStatus === 'contract';

  return (
    <ReviewSection
      icon={Briefcase}
      title="Employment"
      badge={
        hasEmploymentDetails ? (
          <Badge variant="outline" className="text-[10px] font-medium capitalize ml-2">
            {data.employmentStatus?.replace('-', ' ')}
          </Badge>
        ) : undefined
      }
    >
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <EditSelect
              label="Employment Status"
              value={fv('employmentStatus')}
              onChange={(v) => updateField('employmentStatus', v)}
              options={EMPLOYMENT_STATUSES}
            />
            <EditField
              label="Job Title"
              value={fv('jobTitle')}
              onChange={(v) => updateField('jobTitle', v)}
              icon={Briefcase}
              placeholder="e.g. Financial Manager"
            />
            <EditField
              label="Employer Name"
              value={fv('employerName')}
              onChange={(v) => updateField('employerName', v)}
              icon={Building}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <EditField
              label="Industry"
              value={fv('industry')}
              onChange={(v) => updateField('industry', v)}
            />
            <EditField
              label="Gross Monthly Income"
              value={fv('grossMonthlyIncome')}
              onChange={(v) => updateField('grossMonthlyIncome', v)}
              icon={DollarSign}
            />
            <EditField
              label="Monthly Expenses Estimate"
              value={fv('monthlyExpensesEstimate')}
              onChange={(v) => updateField('monthlyExpensesEstimate', v)}
            />
          </div>
          {fv('employmentStatus') === 'self-employed' && (
            <div className="grid grid-cols-3 gap-3">
              <EditField
                label="Company / Business Name"
                value={fv('selfEmployedCompanyName')}
                onChange={(v) => updateField('selfEmployedCompanyName', v)}
              />
              <EditField
                label="Business Industry"
                value={fv('selfEmployedIndustry')}
                onChange={(v) => updateField('selfEmployedIndustry', v)}
              />
              <EditField
                label="Business Description"
                value={fv('selfEmployedDescription')}
                onChange={(v) => updateField('selfEmployedDescription', v)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="contents">
          {hasEmploymentDetails ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <ViewField
                label="Employment Status"
                value={
                  data.employmentStatus
                    ? data.employmentStatus.charAt(0).toUpperCase() +
                      data.employmentStatus.slice(1).replace('-', ' ')
                    : undefined
                }
                amended={amendedFields.has('employmentStatus')}
                syncField="employmentStatus"
              />
              {isEmployed && (
                <div className="contents">
                  <ViewField
                    label="Job Title"
                    value={data?.jobTitle}
                    amended={amendedFields.has('jobTitle')}
                    syncField="jobTitle"
                  />
                  <ViewField
                    label="Employer"
                    value={data?.employerName}
                    amended={amendedFields.has('employerName')}
                    syncField="employerName"
                  />
                  <ViewField
                    label="Industry"
                    value={
                      data?.industry === 'Other' && data?.industryOther
                        ? `Other — ${data.industryOther}`
                        : data?.industry
                    }
                    syncField="industry"
                  />
                </div>
              )}
              {isSelfEmployed && (
                <div className="contents">
                  {data?.selfEmployedCompanyName && (
                    <ViewField
                      label="Company / Business Name"
                      value={data.selfEmployedCompanyName}
                      syncField="selfEmployedCompanyName"
                    />
                  )}
                  <ViewField
                    label="Industry"
                    value={
                      data?.selfEmployedIndustry === 'Other' && data?.selfEmployedIndustryOther
                        ? `Other — ${data.selfEmployedIndustryOther}`
                        : data?.selfEmployedIndustry
                    }
                    syncField="selfEmployedIndustry"
                  />
                  {data?.selfEmployedDescription && (
                    <ViewField
                      label="Business Description"
                      value={data.selfEmployedDescription}
                      className="col-span-2 md:col-span-3"
                      syncField="selfEmployedDescription"
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-300 italic">No employment details provided</div>
          )}
        </div>
      )}
    </ReviewSection>
  );
}
