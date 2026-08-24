/**
 * Step5Review of the investment quote wizard. One step slice —
 * see InvestmentQuoteWizard.tsx for the state machine.
 */
import { Pencil } from 'lucide-react';
import {
  CONTRIBUTION_TYPES,
  OBJECTIVE_OPTIONS,
  TIME_HORIZON_OPTIONS,
  RISK_COMFORT_OPTIONS,
  TAX_BRACKET_OPTIONS,
  needsLumpSum,
  needsMonthly,
  getLabelForType,
  type ContributionEntry,
  getInitialContribution,
  type ObjectiveState,
  type FinancialState,
} from './model';

export function Step5Review({
  selectedTypes,
  contributions,
  objective,
  financial,
  onEditStep,
}: {
  selectedTypes: string[];
  contributions: Record<string, ContributionEntry>;
  objective: ObjectiveState;
  financial: FinancialState;
  onEditStep: (step: number) => void;
}) {
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

  const objectiveLabel =
    OBJECTIVE_OPTIONS.find((o) => o.value === objective.primary_objective)?.label ??
    objective.primary_objective;
  const horizonLabel =
    TIME_HORIZON_OPTIONS.find((o) => o.value === objective.time_horizon)?.label ??
    objective.time_horizon;
  const riskLabel =
    RISK_COMFORT_OPTIONS.find((o) => o.value === objective.risk_comfort)?.label ??
    objective.risk_comfort;
  const taxLabel = TAX_BRACKET_OPTIONS.find((o) => o.value === financial.tax_bracket)?.label ?? '';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Review & submit</h2>
        <p className="text-sm text-gray-500">
          Please review your details before submitting your investment quote request.
        </p>
      </div>

      {/* Investment types */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Investment Types" step={1} />
        <Row label="Selected" value={selectedTypes.map(getLabelForType).join(', ')} />
      </div>

      {/* Contributions */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Contributions" step={2} />
        {selectedTypes
          .filter((t) => t !== 'not_sure')
          .map((typeId) => {
            const entry = contributions[typeId] || getInitialContribution();
            const ctLabel =
              CONTRIBUTION_TYPES.find((c) => c.value === entry.contribution_type)?.label ?? '—';

            const parts: string[] = [ctLabel];
            if (needsLumpSum(entry.contribution_type)) {
              parts.push(
                entry.lump_sum_adviser_assist
                  ? 'Lump sum: adviser assist'
                  : entry.lump_sum_amount
                    ? `Lump sum: R ${entry.lump_sum_amount}`
                    : 'Lump sum: not specified',
              );
            }
            if (needsMonthly(entry.contribution_type)) {
              parts.push(
                entry.monthly_adviser_assist
                  ? 'Monthly: adviser assist'
                  : entry.monthly_amount
                    ? `Monthly: R ${entry.monthly_amount}`
                    : 'Monthly: not specified',
              );
            }

            return <Row key={typeId} label={getLabelForType(typeId)} value={parts.join(' · ')} />;
          })}
        {selectedTypes.includes('not_sure') && selectedTypes.length === 1 && (
          <Row label="Adviser assistance" value="Full adviser guidance requested" />
        )}
      </div>

      {/* Objective */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Objective & Horizon" step={3} />
        <Row label="Primary objective" value={objectiveLabel} />
        <Row label="Time horizon" value={horizonLabel} />
        <Row label="Risk comfort" value={riskLabel} />
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
        <Row label="Existing investments" value={financial.existing_investments || '—'} />
        <Row
          label="Retirement annuity"
          value={
            financial.has_retirement_annuity === null
              ? '—'
              : financial.has_retirement_annuity
                ? 'Yes'
                : 'No'
          }
        />
        {taxLabel && <Row label="Tax bracket" value={taxLabel} />}
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────
