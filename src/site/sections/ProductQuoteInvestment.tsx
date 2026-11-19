/**
 * ProductQuoteInvestment — the investment management quote in the board's
 * frame: what to invest in, how to contribute to each, the objective, a
 * financial snapshot, and the review. The questions, options, checks, saved
 * progress and request are the live InvestmentQuoteWizard's
 * (investment/model.ts), drawn in the board's controls.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CONTRIBUTION_TYPES,
  INVESTMENT_OPTIONS,
  OBJECTIVE_OPTIONS,
  RISK_COMFORT_OPTIONS,
  TAX_BRACKET_OPTIONS,
  TIME_HORIZON_OPTIONS,
  WIZARD_STEPS,
  clearDraft,
  getInitialContribution,
  getInitialFinancial,
  getInitialObjective,
  getLabelForType,
  loadDraft,
  needsLumpSum,
  needsMonthly,
  saveDraft,
  type ContributionEntry,
  type FinancialState,
  type ObjectiveState,
} from '../../components/pages/quote/components/investment/model';
import {
  AmountWithToggle,
  Checks,
  Chips,
  Choices,
  Field,
  FieldGrid,
  MoneyInput,
  Note,
  Pair,
  Panel,
  Review,
  ReviewRows,
  ReviewSection,
  Step,
  TextInput,
} from './ProductQuoteFields';
import { investmentProductDetails, YES_NO_BOOL } from './ProductQuoteModel';
import { ProductQuoteWizard } from './ProductQuoteWizard';
import { COMPLETE_FIELDS, useQuoteSend, type WizardProps } from './ProductQuoteSend';

const labelOf = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label;

export function ProductQuoteInvestment({ contact, parentSubmissionId, onSuccess }: WizardProps) {
  const [draft] = useState(loadDraft);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(draft?.selected_types ?? []);
  const [contributions, setContributions] = useState<Record<string, ContributionEntry>>(
    draft?.contributions ?? {},
  );
  const [objective, setObjective] = useState<ObjectiveState>(
    draft?.objective ?? getInitialObjective(),
  );
  const [financial, setFinancial] = useState<FinancialState>(
    draft?.financial ?? getInitialFinancial(),
  );

  useEffect(() => {
    saveDraft({ selected_types: selectedTypes, contributions, objective, financial, currentStep });
  }, [selectedTypes, contributions, objective, financial, currentStep]);

  const step1Valid = selectedTypes.length > 0;

  const step2Valid = useMemo(() => {
    if (selectedTypes.length === 1 && selectedTypes[0] === 'not_sure') return true;
    return selectedTypes
      .filter((t) => t !== 'not_sure')
      .every((typeId) => {
        const entry = contributions[typeId];
        if (!entry || !entry.contribution_type) return false;
        if (entry.contribution_type === 'not_sure') return true;
        if (needsLumpSum(entry.contribution_type)) {
          if (!entry.lump_sum_amount && !entry.lump_sum_adviser_assist) return false;
        }
        if (needsMonthly(entry.contribution_type)) {
          if (!entry.monthly_amount && !entry.monthly_adviser_assist) return false;
        }
        return true;
      });
  }, [selectedTypes, contributions]);

  const step3Valid = Boolean(
    objective.primary_objective && objective.time_horizon && objective.risk_comfort,
  );
  const step4Valid = Boolean(financial.income_gross_monthly && financial.income_net_monthly);
  const canProceed =
    [true, step1Valid, step2Valid, step3Valid, step4Valid, true][currentStep] ?? false;

  const { submitting, failure, send } = useQuoteSend({
    contact,
    parentSubmissionId,
    onSuccess,
    service: 'investment-management',
    productName: 'Investment Management',
    logName: 'Investment',
    successMessage: 'Your investment quote request has been submitted!',
    clearDraft,
  });

  const submit = useCallback(() => {
    void send(() => investmentProductDetails(selectedTypes, contributions, objective, financial));
  }, [send, selectedTypes, contributions, objective, financial]);

  return (
    <ProductQuoteWizard
      steps={WIZARD_STEPS.map((s) => s.label)}
      step={currentStep}
      onStep={setCurrentStep}
      valid={canProceed}
      hint={COMPLETE_FIELDS}
      backHref="/get-quote/investment-management/contact"
      submitting={submitting}
      failure={failure}
      onSubmit={submit}
    >
      {currentStep === 1 ? (
        <Step
          title="What would you like to invest in?"
          lead="Select one or more investment types. You can choose multiple."
        >
          <Checks
            label="Investment types"
            options={INVESTMENT_OPTIONS.map((o) => ({ value: o.id, label: o.label, info: o.info }))}
            values={selectedTypes}
            onToggle={(id) =>
              setSelectedTypes(
                selectedTypes.includes(id)
                  ? selectedTypes.filter((t) => t !== id)
                  : [...selectedTypes, id],
              )
            }
          />
        </Step>
      ) : null}
      {currentStep === 2 ? (
        <ContributionsStep
          selectedTypes={selectedTypes}
          contributions={contributions}
          onChange={setContributions}
        />
      ) : null}
      {currentStep === 3 ? (
        <Step
          title="What is this investment for?"
          lead="Help us understand your goals so we can recommend the right approach."
        >
          <Choices
            label="Primary objective"
            required
            options={OBJECTIVE_OPTIONS}
            value={objective.primary_objective}
            onChange={(v) => setObjective({ ...objective, primary_objective: v })}
          />
          <Chips
            label="Time horizon"
            required
            options={TIME_HORIZON_OPTIONS}
            value={objective.time_horizon}
            onChange={(v) => setObjective({ ...objective, time_horizon: v })}
          />
          <Chips
            label="Risk comfort level"
            required
            options={RISK_COMFORT_OPTIONS}
            value={objective.risk_comfort}
            onChange={(v) => setObjective({ ...objective, risk_comfort: v })}
          />
        </Step>
      ) : null}
      {currentStep === 4 ? <FinancialStep financial={financial} onChange={setFinancial} /> : null}
      {currentStep === 5 ? (
        <Step
          title="Review & submit"
          lead="Please review your details before submitting your investment quote request."
        >
          <Review>
            <ReviewSection title="Investment Types" onEdit={() => setCurrentStep(1)}>
              <ReviewRows
                rows={[['Selected', selectedTypes.map(getLabelForType).join(', ') || '—']]}
              />
            </ReviewSection>
            <ReviewSection title="Contributions" onEdit={() => setCurrentStep(2)}>
              <ReviewRows rows={contributionRows(selectedTypes, contributions)} />
            </ReviewSection>
            <ReviewSection title="Objective & Horizon" onEdit={() => setCurrentStep(3)}>
              <ReviewRows
                rows={[
                  [
                    'Primary objective',
                    (labelOf(OBJECTIVE_OPTIONS, objective.primary_objective) ??
                      objective.primary_objective) ||
                      '—',
                  ],
                  [
                    'Time horizon',
                    (labelOf(TIME_HORIZON_OPTIONS, objective.time_horizon) ??
                      objective.time_horizon) ||
                      '—',
                  ],
                  [
                    'Risk comfort',
                    (labelOf(RISK_COMFORT_OPTIONS, objective.risk_comfort) ??
                      objective.risk_comfort) ||
                      '—',
                  ],
                ]}
              />
            </ReviewSection>
            <ReviewSection title="Financial Snapshot" onEdit={() => setCurrentStep(4)}>
              <ReviewRows rows={financialRows(financial)} />
            </ReviewSection>
          </Review>
        </Step>
      ) : null}
    </ProductQuoteWizard>
  );
}

function contributionRows(
  selectedTypes: string[],
  contributions: Record<string, ContributionEntry>,
): [string, string][] {
  const rows: [string, string][] = selectedTypes
    .filter((t) => t !== 'not_sure')
    .map((typeId) => {
      const entry = contributions[typeId] || getInitialContribution();
      const parts: string[] = [labelOf(CONTRIBUTION_TYPES, entry.contribution_type) ?? '—'];
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
      return [getLabelForType(typeId), parts.join(' · ')];
    });
  if (selectedTypes.includes('not_sure') && selectedTypes.length === 1) {
    rows.push(['Adviser assistance', 'Full adviser guidance requested']);
  }
  return rows;
}

function financialRows(financial: FinancialState): [string, string][] {
  const rows: [string, string][] = [
    [
      'Gross monthly income',
      financial.income_gross_monthly ? `R ${financial.income_gross_monthly}` : '—',
    ],
    [
      'Net monthly income',
      financial.income_net_monthly ? `R ${financial.income_net_monthly}` : '—',
    ],
    ['Existing investments', financial.existing_investments || '—'],
    [
      'Retirement annuity',
      financial.has_retirement_annuity === null
        ? '—'
        : financial.has_retirement_annuity
          ? 'Yes'
          : 'No',
    ],
  ];
  const tax = labelOf(TAX_BRACKET_OPTIONS, financial.tax_bracket);
  if (tax) rows.push(['Tax bracket', tax]);
  return rows;
}

// ── Step 2: contributions ─────────────────────────────────────────────────────

function ContributionsStep({
  selectedTypes,
  contributions,
  onChange,
}: {
  selectedTypes: string[];
  contributions: Record<string, ContributionEntry>;
  onChange: (c: Record<string, ContributionEntry>) => void;
}) {
  const updateEntry = (typeId: string, partial: Partial<ContributionEntry>) => {
    const current = contributions[typeId] || getInitialContribution();
    const next = { ...current, ...partial };
    if (partial.contribution_type !== undefined) {
      if (!needsLumpSum(partial.contribution_type)) {
        next.lump_sum_amount = '';
        next.lump_sum_adviser_assist = false;
      }
      if (!needsMonthly(partial.contribution_type)) {
        next.monthly_amount = '';
        next.monthly_adviser_assist = false;
      }
    }
    onChange({ ...contributions, [typeId]: next });
  };

  if (selectedTypes.length === 1 && selectedTypes[0] === 'not_sure') {
    return (
      <Step
        title="How would you like to contribute?"
        lead="You've selected adviser assistance for the investment type. Our adviser will recommend contribution structures based on your profile."
      >
        <Panel>
          <p className="nwpq-panel-text">
            No contribution details required — your adviser will discuss this with you.
          </p>
        </Panel>
      </Step>
    );
  }

  return (
    <Step
      title="How would you like to contribute?"
      lead="For each selected investment, choose your contribution method and amount."
    >
      {selectedTypes
        .filter((t) => t !== 'not_sure')
        .map((typeId) => {
          const entry = contributions[typeId] || getInitialContribution();
          const isAdviser = entry.contribution_type === 'not_sure';
          return (
            <Panel key={typeId} title={getLabelForType(typeId)}>
              <Chips
                small
                label="Contribution type"
                required
                options={CONTRIBUTION_TYPES}
                value={entry.contribution_type}
                onChange={(v) => updateEntry(typeId, { contribution_type: v })}
              />
              {needsLumpSum(entry.contribution_type) && !isAdviser ? (
                <AmountWithToggle
                  label="Lump sum amount (ZAR)"
                  placeholder="50,000"
                  value={entry.lump_sum_amount}
                  onChange={(v) => updateEntry(typeId, { lump_sum_amount: v })}
                  toggleLabel="Adviser assist"
                  toggled={entry.lump_sum_adviser_assist}
                  onToggle={() =>
                    updateEntry(typeId, {
                      lump_sum_adviser_assist: !entry.lump_sum_adviser_assist,
                      lump_sum_amount: !entry.lump_sum_adviser_assist ? '' : entry.lump_sum_amount,
                    })
                  }
                />
              ) : null}
              {needsMonthly(entry.contribution_type) && !isAdviser ? (
                <AmountWithToggle
                  label="Monthly amount (ZAR /month)"
                  placeholder="2,000"
                  value={entry.monthly_amount}
                  onChange={(v) => updateEntry(typeId, { monthly_amount: v })}
                  toggleLabel="Adviser assist"
                  toggled={entry.monthly_adviser_assist}
                  onToggle={() =>
                    updateEntry(typeId, {
                      monthly_adviser_assist: !entry.monthly_adviser_assist,
                      monthly_amount: !entry.monthly_adviser_assist ? '' : entry.monthly_amount,
                    })
                  }
                />
              ) : null}
              {isAdviser ? (
                <Note>
                  Your adviser will recommend the best contribution structure for this investment.
                </Note>
              ) : null}
            </Panel>
          );
        })}
    </Step>
  );
}

// ── Step 4: financial snapshot ────────────────────────────────────────────────

function FinancialStep({
  financial,
  onChange,
}: {
  financial: FinancialState;
  onChange: (f: FinancialState) => void;
}) {
  return (
    <Step
      title="A few quick financial details"
      lead="This helps us assess suitability and recommend the right investment structure."
    >
      <FieldGrid>
        <Field label="Gross monthly income" required>
          {(id) => (
            <MoneyInput
              id={id}
              required
              placeholder="45,000"
              value={financial.income_gross_monthly}
              onChange={(v) => onChange({ ...financial, income_gross_monthly: v })}
            />
          )}
        </Field>
        <Field label="Net monthly income" required>
          {(id) => (
            <MoneyInput
              id={id}
              required
              placeholder="32,000"
              value={financial.income_net_monthly}
              onChange={(v) => onChange({ ...financial, income_net_monthly: v })}
            />
          )}
        </Field>
      </FieldGrid>
      <Field label="Existing investments (optional)">
        {(id) => (
          <TextInput
            id={id}
            placeholder="e.g. Unit trust with Allan Gray, TFSA with Sygnia"
            value={financial.existing_investments}
            onChange={(v) => onChange({ ...financial, existing_investments: v })}
          />
        )}
      </Field>
      <Pair
        label="Do you currently have a retirement annuity?"
        options={YES_NO_BOOL}
        value={financial.has_retirement_annuity}
        onChange={(v) => onChange({ ...financial, has_retirement_annuity: v })}
      />
      <Chips
        label="Tax bracket (optional)"
        options={TAX_BRACKET_OPTIONS}
        value={financial.tax_bracket}
        onChange={(v) => onChange({ ...financial, tax_bracket: v })}
      />
    </Step>
  );
}
