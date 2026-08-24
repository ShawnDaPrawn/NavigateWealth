/**
 * Step4Review of the risk quote wizard, with its ReviewSection/ReviewField
 * atoms. One step slice — see RiskQuoteWizard.tsx for the state machine.
 */
import React from 'react';
import { Badge } from '../../../../ui/badge';
import { Pencil } from 'lucide-react';
import {
  COVER_OPTIONS,
  MARITAL_OPTIONS,
  QUALIFICATION_OPTIONS,
  SMOKER_OPTIONS,
  needsSpouseIncome,
  type HealthDisclosures,
  type PersonalDetails,
  type RiskNeeds,
} from './model';

export function Step4Review({
  riskNeeds,
  personalDetails,
  healthDisclosures,
  firstName,
  lastName,
  email,
  phone,
  onEdit,
}: {
  riskNeeds: RiskNeeds;
  personalDetails: PersonalDetails;
  healthDisclosures: HealthDisclosures;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  onEdit: (step: number) => void;
}) {
  const selectedCovers = COVER_OPTIONS.filter((c) => riskNeeds[c.id].selected);
  const maritalLabel =
    MARITAL_OPTIONS.find((o) => o.value === personalDetails.marital_status)?.label ||
    personalDetails.marital_status;
  const smokerLabel =
    SMOKER_OPTIONS.find((o) => o.value === personalDetails.smoker_status)?.label ||
    personalDetails.smoker_status;
  const qualLabel =
    QUALIFICATION_OPTIONS.find((o) => o.value === personalDetails.highest_qualification)?.label ||
    personalDetails.highest_qualification ||
    'Not specified';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Review & Submit</h2>
        <p className="text-sm text-gray-500">Please review your details before submitting.</p>
      </div>

      {/* Contact */}
      <ReviewSection title="Contact Details" onEdit={() => {}}>
        <ReviewField label="Name" value={`${firstName} ${lastName}`} />
        <ReviewField label="Email" value={email} />
        <ReviewField label="Phone" value={phone} />
      </ReviewSection>

      {/* Covers */}
      <ReviewSection title="Risk Cover Requirements" onEdit={() => onEdit(1)}>
        {selectedCovers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No covers selected</p>
        ) : (
          selectedCovers.map((cover) => {
            const entry = riskNeeds[cover.id];
            return (
              <ReviewField
                key={cover.id}
                label={cover.label}
                value={
                  entry.adviser_assist
                    ? 'Adviser assistance requested'
                    : entry.amount
                      ? `R ${entry.amount}${cover.isMonthly ? ' /month' : ''}`
                      : 'Amount not specified'
                }
              />
            );
          })
        )}
      </ReviewSection>

      {/* Personal */}
      <ReviewSection title="Personal & Financial Details" onEdit={() => onEdit(2)}>
        <ReviewField label="Occupation" value={personalDetails.occupation || 'Not specified'} />
        <ReviewField
          label="Gross monthly income"
          value={
            personalDetails.income_gross_monthly
              ? `R ${personalDetails.income_gross_monthly}`
              : 'Not specified'
          }
        />
        <ReviewField
          label="Net monthly income"
          value={
            personalDetails.income_net_monthly
              ? `R ${personalDetails.income_net_monthly}`
              : 'Not specified'
          }
        />
        <ReviewField label="Smoker status" value={smokerLabel || 'Not specified'} />
        <ReviewField label="Qualification" value={qualLabel} />
        <ReviewField label="Marital status" value={maritalLabel || 'Not specified'} />
        {needsSpouseIncome(personalDetails.marital_status) && (
          <ReviewField
            label="Spouse income"
            value={
              personalDetails.spouse_income_monthly
                ? `R ${personalDetails.spouse_income_monthly} /month`
                : 'Not specified'
            }
          />
        )}
      </ReviewSection>

      {/* Health */}
      <ReviewSection title="Chronic Conditions" onEdit={() => onEdit(3)}>
        {healthDisclosures.has_conditions === false ? (
          <p className="text-sm text-green-600 font-medium">No chronic conditions declared</p>
        ) : healthDisclosures.has_conditions === true ? (
          <div className="space-y-1">
            {healthDisclosures.selected_conditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {healthDisclosures.selected_conditions.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
            {healthDisclosures.free_text && (
              <p className="text-sm text-gray-600 italic">"{healthDisclosures.free_text}"</p>
            )}
            {healthDisclosures.selected_conditions.length === 0 && !healthDisclosures.free_text && (
              <p className="text-sm text-gray-400 italic">
                Conditions indicated but none specified
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Not answered</p>
        )}
      </ReviewSection>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right ml-4">{value}</span>
    </div>
  );
}
