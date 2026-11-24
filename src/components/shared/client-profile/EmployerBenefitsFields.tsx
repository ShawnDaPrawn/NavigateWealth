/**
 * Group benefits through one employer: edited inside an employer card, and
 * summarised when the card is closed. Used by the Employment section of both
 * profile editors.
 */
import { CurrencyInputField } from '../../ui/currency-input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import {
  EMPLOYER_BENEFIT_AMOUNT_FIELDS as AMOUNT_FIELDS,
  RETIREMENT_FUND_TYPE_OPTIONS,
  employerBenefitLines as benefitLines,
  normalizeEmployerBenefits,
  type BenefitYesNo,
  type EmployerBenefits,
  type RetirementFundType,
} from '../../../shared/client-profile';
import { formatCurrency } from '../../../utils/currencyFormatter';

export function EmployerBenefitsFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: EmployerBenefits | undefined;
  onChange: (next: EmployerBenefits) => void;
}) {
  const benefits = normalizeEmployerBenefits(value);
  const update = (patch: Partial<EmployerBenefits>) => onChange({ ...benefits, ...patch });

  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <h5 className="text-sm font-medium text-gray-900">Employer benefits</h5>
        <p className="text-xs text-gray-500">
          From the benefit statement or payslip. Leave blank if not provided.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-retirementFund`}>Retirement fund</Label>
          <Select
            value={benefits.retirementFund}
            onValueChange={(v) => update({ retirementFund: v as RetirementFundType })}
          >
            <SelectTrigger id={`${idPrefix}-retirementFund`} className="mt-1.5">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {RETIREMENT_FUND_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-medicalAidSubsidy`}>Medical aid subsidy</Label>
          <Select
            value={benefits.medicalAidSubsidy}
            onValueChange={(v) => update({ medicalAidSubsidy: v as BenefitYesNo })}
          >
            <SelectTrigger id={`${idPrefix}-medicalAidSubsidy`} className="mt-1.5">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {AMOUNT_FIELDS.map(({ field, label }) => (
          <div key={field}>
            <Label htmlFor={`${idPrefix}-${field}`}>{label}</Label>
            <CurrencyInputField
              id={`${idPrefix}-${field}`}
              value={benefits[field]}
              onValueChange={(v) => update({ [field]: v ?? 0 })}
              className="mt-1.5"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmployerBenefitsSummary({ value }: { value: EmployerBenefits | undefined }) {
  const lines = benefitLines(value, formatCurrency);
  if (lines.length === 0) return null;
  return (
    <div className="sm:col-span-2">
      <p className="text-gray-600 text-[14px]">Employer benefits</p>
      <ul className="mt-1 space-y-0.5 text-gray-900">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
