/**
 * Step 5 — review before submitting.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines) on the same pattern as
 * the medical aid wizard: each step was already a self-contained function with
 * its own props; only its address changed.
 */
import { Pencil } from 'lucide-react';
import {
  type FinancialState,
  type NotSureState,
  PRODUCT_OPTIONS,
  type PreservationState,
  type RAContributionState,
  RA_CONTRIBUTION_TYPES,
  TAX_BRACKET_OPTIONS,
  type TimelineState,
  needsLumpSum,
  needsMonthly,
} from './model';

export function Step5Review({
  selectedProduct,
  raContribution,
  preservation,
  notSureContext,
  timeline,
  financial,
  onEditStep,
}: {
  selectedProduct: string;
  raContribution: RAContributionState;
  preservation: PreservationState;
  notSureContext: NotSureState;
  timeline: TimelineState;
  financial: FinancialState;
  onEditStep: (step: number) => void;
}) {
  const productLabel =
    PRODUCT_OPTIONS.find((p) => p.id === selectedProduct)?.label ?? selectedProduct;
  const taxLabel = TAX_BRACKET_OPTIONS.find((o) => o.value === financial.tax_bracket)?.label ?? '';

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
          Please review your details before submitting your retirement planning quote request.
        </p>
      </div>

      {/* Product */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Retirement Product" step={1} />
        <Row label="Selected product" value={productLabel} />
      </div>

      {/* Funding */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Funding" step={2} />
        {selectedProduct === 'ra' && (
          <div className="contents">
            <Row
              label="Contribution type"
              value={
                RA_CONTRIBUTION_TYPES.find((c) => c.value === raContribution.contribution_type)
                  ?.label ?? '—'
              }
            />
            {needsMonthly(raContribution.contribution_type) && (
              <Row
                label="Monthly amount"
                value={
                  raContribution.monthly_adviser_assist
                    ? 'Adviser assist'
                    : raContribution.monthly_amount
                      ? `R ${raContribution.monthly_amount}`
                      : '—'
                }
              />
            )}
            {needsLumpSum(raContribution.contribution_type) && (
              <Row
                label="Lump sum amount"
                value={
                  raContribution.lump_sum_adviser_assist
                    ? 'Adviser assist'
                    : raContribution.lump_sum_amount
                      ? `R ${raContribution.lump_sum_amount}`
                      : '—'
                }
              />
            )}
          </div>
        )}
        {(selectedProduct === 'provident_preservation' ||
          selectedProduct === 'pension_preservation') && (
          <div className="contents">
            <Row
              label="Transferring from employer fund"
              value={
                preservation.is_transferring === null
                  ? '—'
                  : preservation.is_transferring
                    ? 'Yes'
                    : 'No'
              }
            />
            <Row
              label="Estimated transfer amount"
              value={
                preservation.transfer_not_sure
                  ? 'Not sure'
                  : preservation.transfer_amount
                    ? `R ${preservation.transfer_amount}`
                    : '—'
              }
            />
          </div>
        )}
        {selectedProduct === 'not_sure' && (
          <div className="contents">
            <Row
              label="Currently employed"
              value={
                notSureContext.currently_employed === null
                  ? '—'
                  : notSureContext.currently_employed
                    ? 'Yes'
                    : 'No'
              }
            />
            <Row
              label="Leaving employer fund"
              value={
                notSureContext.leaving_employer_fund === null
                  ? '—'
                  : notSureContext.leaving_employer_fund
                    ? 'Yes'
                    : 'No'
              }
            />
            <Row
              label="Want monthly contributions"
              value={
                notSureContext.want_monthly_contributions === 'yes'
                  ? 'Yes'
                  : notSureContext.want_monthly_contributions === 'no'
                    ? 'No'
                    : notSureContext.want_monthly_contributions === 'not_sure'
                      ? 'Not sure'
                      : '—'
              }
            />
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Retirement Timeline" step={3} />
        <Row
          label="Current age"
          value={timeline.current_age ? `${timeline.current_age} years` : '—'}
        />
        <Row
          label="Planned retirement age"
          value={timeline.planned_retirement_age ? `${timeline.planned_retirement_age} years` : '—'}
        />
        <Row
          label="Current retirement fund member"
          value={
            timeline.member_of_retirement_fund === null
              ? '—'
              : timeline.member_of_retirement_fund
                ? 'Yes'
                : 'No'
          }
        />
        {timeline.member_of_retirement_fund && timeline.fund_details && (
          <Row label="Fund(s)" value={timeline.fund_details} />
        )}
      </div>

      {/* Financial */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Financial Snapshot" step={4} />
        <Row
          label="Gross monthly income"
          value={financial.income_gross_monthly ? `R ${financial.income_gross_monthly}` : '—'}
        />
        <Row
          label="Net monthly income"
          value={financial.income_net_monthly ? `R ${financial.income_net_monthly}` : '—'}
        />
        <Row
          label="Current retirement savings"
          value={
            financial.current_retirement_savings ? `R ${financial.current_retirement_savings}` : '—'
          }
        />
        {taxLabel && <Row label="Tax bracket" value={taxLabel} />}
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────
