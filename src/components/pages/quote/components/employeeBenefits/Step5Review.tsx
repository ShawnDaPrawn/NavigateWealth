/**
 * Step5Review of the employee benefits quote wizard. One step slice —
 * see EmployeeBenefitsQuoteWizard.tsx for the state machine.
 */
import { Pencil } from 'lucide-react';
import {
  AGE_BAND_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
  COMPULSORY_OPTIONS,
  CONTRIBUTION_STRUCTURE_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  WORKFORCE_TYPE_OPTIONS,
  type BudgetState,
  type BusinessState,
  type WorkforceState,
} from './model';

export function Step5Review({
  business,
  benefitType,
  budget,
  workforce,
  onEditStep,
}: {
  business: BusinessState;
  benefitType: string;
  budget: BudgetState;
  workforce: WorkforceState;
  onEditStep: (step: number) => void;
}) {
  const benefitLabel = BENEFIT_TYPE_OPTIONS.find((b) => b.id === benefitType)?.label ?? benefitType;
  const contribLabel =
    CONTRIBUTION_STRUCTURE_OPTIONS.find((c) => c.value === budget.contribution_structure)?.label ??
    '';
  const compulsoryLabel =
    COMPULSORY_OPTIONS.find((c) => c.value === budget.compulsory_for_all)?.label ?? '';
  const ageBandLabel =
    AGE_BAND_OPTIONS.find((a) => a.value === workforce.average_age_band)?.label ?? '';
  const workforceTypeLabel =
    WORKFORCE_TYPE_OPTIONS.find((w) => w.value === workforce.workforce_type)?.label ?? '';
  const empCountLabel =
    EMPLOYEE_COUNT_OPTIONS.find((e) => e.value === business.employee_count)?.label ?? '';

  function SectionHeader({ title, step }: { title: string; step: number }) {
    return (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <button
          type="button"
          onClick={() => onEditStep(step)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
    );
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between py-1.5 text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900 font-medium text-right max-w-[60%]">{value || '—'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Review & submit</h2>
        <p className="text-sm text-gray-500">
          Please review your details before submitting your employee benefits quote request.
        </p>
      </div>

      {/* Business */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Business Details" step={1} />
        <Row label="Company name" value={business.company_name} />
        {business.trading_name && <Row label="Trading name" value={business.trading_name} />}
        <Row label="Industry sector" value={business.industry_sector} />
        <Row label="Number of employees" value={empCountLabel} />
        <Row label="Province" value={business.province} />
      </div>

      {/* Benefit type */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Benefit Type" step={2} />
        <Row label="Selected benefit type" value={benefitLabel} />
      </div>

      {/* Budget */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Budget & Contribution" step={3} />
        <Row
          label="Monthly budget"
          value={
            budget.budget_adviser_assist
              ? 'Adviser guidance requested'
              : budget.monthly_budget
                ? `R ${budget.monthly_budget} /month`
                : '—'
          }
        />
        <Row label="Contribution structure" value={contribLabel} />
        <Row label="Compulsory for all staff" value={compulsoryLabel} />
      </div>

      {/* Workforce */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Workforce Overview" step={4} />
        <Row label="Average age band" value={ageBandLabel} />
        <Row label="Workforce type" value={workforceTypeLabel} />
        <Row
          label="Existing benefits"
          value={
            workforce.has_existing_benefits === null
              ? '—'
              : workforce.has_existing_benefits
                ? 'Yes'
                : 'No'
          }
        />
        {workforce.has_existing_benefits && workforce.existing_benefits_description && (
          <Row label="Current arrangement" value={workforce.existing_benefits_description} />
        )}
      </div>
    </div>
  );
}
