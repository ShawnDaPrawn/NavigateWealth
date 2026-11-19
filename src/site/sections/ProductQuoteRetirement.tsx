/**
 * ProductQuoteRetirement — the retirement planning quote in the board's
 * frame: which product, how it is funded (contributions to an annuity, a
 * transfer into a preservation fund, or a few questions when unsure), the
 * timeline, a financial snapshot, and the review. The questions, options,
 * checks, saved progress and request are the live RetirementQuoteWizard's
 * (retirement/model.ts), drawn in the board's controls.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PRODUCT_OPTIONS,
  RA_CONTRIBUTION_TYPES,
  TAX_BRACKET_OPTIONS,
  WIZARD_STEPS,
  clearDraft,
  getInitialFinancial,
  getInitialNotSure,
  getInitialPreservation,
  getInitialRA,
  getInitialTimeline,
  loadDraft,
  needsLumpSum,
  needsMonthly,
  saveDraft,
  type FinancialState,
  type NotSureState,
  type PreservationState,
  type RAContributionState,
  type TimelineState,
} from '../../components/pages/quote/components/retirement/model';
import {
  AmountWithToggle,
  Chips,
  Choices,
  Field,
  FieldGrid,
  MoneyInput,
  Note,
  NumberInput,
  Pair,
  Review,
  ReviewRows,
  ReviewSection,
  Step,
  TextInput,
} from './ProductQuoteFields';
import { retirementProductDetails, YES_NO_BOOL } from './ProductQuoteModel';
import { ProductQuoteWizard } from './ProductQuoteWizard';
import { COMPLETE_FIELDS, useQuoteSend, type WizardProps } from './ProductQuoteSend';

const MONTHLY_CHOICES = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

const yesNo = (value: boolean | null) => (value === null ? '—' : value ? 'Yes' : 'No');
const isPreservation = (product: string) =>
  product === 'provident_preservation' || product === 'pension_preservation';

export function ProductQuoteRetirement({ contact, parentSubmissionId, onSuccess }: WizardProps) {
  const [draft] = useState(loadDraft);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedProduct, setSelectedProduct] = useState(draft?.selected_product ?? '');
  const [raContribution, setRAContribution] = useState<RAContributionState>(
    draft?.ra_contribution ?? getInitialRA(),
  );
  const [preservation, setPreservation] = useState<PreservationState>(
    draft?.preservation ?? getInitialPreservation(),
  );
  const [notSureContext, setNotSureContext] = useState<NotSureState>(
    draft?.not_sure_context ?? getInitialNotSure(),
  );
  const [timeline, setTimeline] = useState<TimelineState>(draft?.timeline ?? getInitialTimeline());
  const [financial, setFinancial] = useState<FinancialState>(
    draft?.financial ?? getInitialFinancial(),
  );

  useEffect(() => {
    saveDraft({
      selected_product: selectedProduct,
      ra_contribution: raContribution,
      preservation,
      not_sure_context: notSureContext,
      timeline,
      financial,
      currentStep,
    });
  }, [
    selectedProduct,
    raContribution,
    preservation,
    notSureContext,
    timeline,
    financial,
    currentStep,
  ]);

  const step2Valid = useMemo(() => {
    if (selectedProduct === 'ra') {
      if (!raContribution.contribution_type) return false;
      if (raContribution.contribution_type === 'not_sure') return true;
      if (needsMonthly(raContribution.contribution_type)) {
        if (!raContribution.monthly_amount && !raContribution.monthly_adviser_assist) return false;
      }
      if (needsLumpSum(raContribution.contribution_type)) {
        if (!raContribution.lump_sum_amount && !raContribution.lump_sum_adviser_assist)
          return false;
      }
      return true;
    }
    if (isPreservation(selectedProduct)) {
      return preservation.is_transferring !== null;
    }
    if (selectedProduct === 'not_sure') {
      return (
        notSureContext.currently_employed !== null &&
        notSureContext.leaving_employer_fund !== null &&
        notSureContext.want_monthly_contributions !== ''
      );
    }
    return false;
  }, [selectedProduct, raContribution, preservation, notSureContext]);

  const canProceed =
    [
      true,
      Boolean(selectedProduct),
      step2Valid,
      Boolean(timeline.current_age && timeline.planned_retirement_age),
      Boolean(financial.income_gross_monthly && financial.income_net_monthly),
      true,
    ][currentStep] ?? false;

  const { submitting, failure, send } = useQuoteSend({
    contact,
    parentSubmissionId,
    onSuccess,
    service: 'retirement-planning',
    productName: 'Retirement Planning',
    logName: 'Retirement',
    successMessage: 'Your retirement planning quote request has been submitted!',
    clearDraft,
  });

  const submit = useCallback(() => {
    void send(() =>
      retirementProductDetails(
        selectedProduct,
        raContribution,
        preservation,
        notSureContext,
        timeline,
        financial,
      ),
    );
  }, [send, selectedProduct, raContribution, preservation, notSureContext, timeline, financial]);

  return (
    <ProductQuoteWizard
      steps={WIZARD_STEPS.map((s) => s.label)}
      step={currentStep}
      onStep={setCurrentStep}
      valid={canProceed}
      hint={COMPLETE_FIELDS}
      backHref="/get-quote/retirement-planning/contact"
      submitting={submitting}
      failure={failure}
      onSubmit={submit}
    >
      {currentStep === 1 ? (
        <Step
          title="What retirement product are you looking for?"
          lead="Select the retirement product that best fits your needs."
        >
          <Choices
            ariaLabel="Retirement products"
            options={PRODUCT_OPTIONS.map((o) => ({ value: o.id, label: o.label, info: o.info }))}
            value={selectedProduct}
            onChange={setSelectedProduct}
          />
        </Step>
      ) : null}
      {currentStep === 2 ? (
        <Step
          title="How will this be funded?"
          lead={
            selectedProduct === 'ra'
              ? 'Tell us about your planned contributions.'
              : isPreservation(selectedProduct)
                ? 'Tell us about the transfer from your previous employer fund.'
                : 'A few questions to help your adviser recommend the right approach.'
          }
        >
          {selectedProduct === 'ra' ? (
            <RAFunding state={raContribution} onChange={setRAContribution} />
          ) : null}
          {isPreservation(selectedProduct) ? (
            <PreservationFunding
              fund={selectedProduct === 'provident_preservation' ? 'provident' : 'pension'}
              state={preservation}
              onChange={setPreservation}
            />
          ) : null}
          {selectedProduct === 'not_sure' ? (
            <>
              <Pair
                label="Are you currently employed?"
                required
                options={YES_NO_BOOL}
                value={notSureContext.currently_employed}
                onChange={(v) => setNotSureContext({ ...notSureContext, currently_employed: v })}
              />
              <Pair
                label="Are you leaving an employer fund?"
                required
                options={YES_NO_BOOL}
                value={notSureContext.leaving_employer_fund}
                onChange={(v) => setNotSureContext({ ...notSureContext, leaving_employer_fund: v })}
              />
              <Chips
                label="Would you like to make new contributions monthly?"
                required
                options={MONTHLY_CHOICES}
                value={notSureContext.want_monthly_contributions}
                onChange={(v) =>
                  setNotSureContext({ ...notSureContext, want_monthly_contributions: v })
                }
              />
            </>
          ) : null}
        </Step>
      ) : null}
      {currentStep === 3 ? (
        <Step
          title="When do you plan to retire?"
          lead="This helps your adviser assess time horizon and product suitability."
        >
          <FieldGrid>
            <Field label="Current age" required>
              {(id) => (
                <NumberInput
                  id={id}
                  required
                  placeholder="e.g. 38"
                  value={timeline.current_age}
                  onChange={(v) => setTimeline({ ...timeline, current_age: v })}
                />
              )}
            </Field>
            <Field label="Planned retirement age" required>
              {(id) => (
                <NumberInput
                  id={id}
                  required
                  placeholder="e.g. 65"
                  value={timeline.planned_retirement_age}
                  onChange={(v) => setTimeline({ ...timeline, planned_retirement_age: v })}
                />
              )}
            </Field>
          </FieldGrid>
          <Pair
            label="Are you currently a member of any retirement fund?"
            options={YES_NO_BOOL}
            value={timeline.member_of_retirement_fund}
            onChange={(v) =>
              setTimeline({
                ...timeline,
                member_of_retirement_fund: v,
                fund_details: v ? timeline.fund_details : '',
              })
            }
          />
          {timeline.member_of_retirement_fund === true ? (
            <Field small label="Which fund(s)?" className="nw-in">
              {(id) => (
                <TextInput
                  id={id}
                  placeholder="e.g. Old Mutual RA, Employer pension fund"
                  value={timeline.fund_details}
                  onChange={(v) => setTimeline({ ...timeline, fund_details: v })}
                />
              )}
            </Field>
          ) : null}
        </Step>
      ) : null}
      {currentStep === 4 ? (
        <Step
          title="A few quick details"
          lead="Basic financial context to help your adviser prepare a suitable recommendation."
        >
          <FieldGrid>
            <Field label="Gross monthly income" required>
              {(id) => (
                <MoneyInput
                  id={id}
                  required
                  placeholder="45,000"
                  value={financial.income_gross_monthly}
                  onChange={(v) => setFinancial({ ...financial, income_gross_monthly: v })}
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
                  onChange={(v) => setFinancial({ ...financial, income_net_monthly: v })}
                />
              )}
            </Field>
          </FieldGrid>
          <Field label="Current total retirement savings (optional)">
            {(id) => (
              <MoneyInput
                id={id}
                placeholder="500,000"
                value={financial.current_retirement_savings}
                onChange={(v) => setFinancial({ ...financial, current_retirement_savings: v })}
              />
            )}
          </Field>
          <Chips
            label="Tax bracket (optional)"
            options={TAX_BRACKET_OPTIONS}
            value={financial.tax_bracket}
            onChange={(v) => setFinancial({ ...financial, tax_bracket: v })}
          />
        </Step>
      ) : null}
      {currentStep === 5 ? (
        <ReviewStep
          selectedProduct={selectedProduct}
          raContribution={raContribution}
          preservation={preservation}
          notSureContext={notSureContext}
          timeline={timeline}
          financial={financial}
          onEdit={setCurrentStep}
        />
      ) : null}
    </ProductQuoteWizard>
  );
}

// ── Step 2: funding ───────────────────────────────────────────────────────────

function RAFunding({
  state,
  onChange,
}: {
  state: RAContributionState;
  onChange: (s: RAContributionState) => void;
}) {
  const setType = (ct: string) => {
    const next = { ...state, contribution_type: ct };
    if (!needsMonthly(ct)) {
      next.monthly_amount = '';
      next.monthly_adviser_assist = false;
    }
    if (!needsLumpSum(ct)) {
      next.lump_sum_amount = '';
      next.lump_sum_adviser_assist = false;
    }
    onChange(next);
  };
  const isAdviser = state.contribution_type === 'not_sure';
  return (
    <>
      <Chips
        label="Contribution type"
        required
        options={RA_CONTRIBUTION_TYPES}
        value={state.contribution_type}
        onChange={setType}
      />
      {needsMonthly(state.contribution_type) && !isAdviser ? (
        <AmountWithToggle
          label="Monthly contribution amount (ZAR)"
          placeholder="3,000"
          value={state.monthly_amount}
          onChange={(v) => onChange({ ...state, monthly_amount: v })}
          toggleLabel="Adviser assist"
          toggled={state.monthly_adviser_assist}
          onToggle={() =>
            onChange({
              ...state,
              monthly_adviser_assist: !state.monthly_adviser_assist,
              monthly_amount: !state.monthly_adviser_assist ? '' : state.monthly_amount,
            })
          }
        />
      ) : null}
      {needsLumpSum(state.contribution_type) && !isAdviser ? (
        <AmountWithToggle
          label="Lump sum contribution amount (ZAR)"
          placeholder="100,000"
          value={state.lump_sum_amount}
          onChange={(v) => onChange({ ...state, lump_sum_amount: v })}
          toggleLabel="Adviser assist"
          toggled={state.lump_sum_adviser_assist}
          onToggle={() =>
            onChange({
              ...state,
              lump_sum_adviser_assist: !state.lump_sum_adviser_assist,
              lump_sum_amount: !state.lump_sum_adviser_assist ? '' : state.lump_sum_amount,
            })
          }
        />
      ) : null}
      {isAdviser ? (
        <Note>Your adviser will recommend the best contribution structure for your situation.</Note>
      ) : null}
    </>
  );
}

function PreservationFunding({
  fund,
  state,
  onChange,
}: {
  fund: 'provident' | 'pension';
  state: PreservationState;
  onChange: (s: PreservationState) => void;
}) {
  return (
    <>
      <Pair
        label={`Are you transferring from a previous employer's ${fund} fund?`}
        required
        options={YES_NO_BOOL}
        value={state.is_transferring}
        onChange={(v) => onChange({ ...state, is_transferring: v })}
      />
      <AmountWithToggle
        label="Estimated transfer amount"
        placeholder="250,000"
        value={state.transfer_amount}
        onChange={(v) => onChange({ ...state, transfer_amount: v })}
        toggleLabel="Not sure"
        toggled={state.transfer_not_sure}
        onToggle={() =>
          onChange({
            ...state,
            transfer_not_sure: !state.transfer_not_sure,
            transfer_amount: !state.transfer_not_sure ? '' : state.transfer_amount,
          })
        }
        note={<Note>No new contributions are allowed on preservation funds.</Note>}
      />
    </>
  );
}

// ── Step 5: review ────────────────────────────────────────────────────────────

function ReviewStep({
  selectedProduct,
  raContribution: ra,
  preservation,
  notSureContext,
  timeline,
  financial,
  onEdit,
}: {
  selectedProduct: string;
  raContribution: RAContributionState;
  preservation: PreservationState;
  notSureContext: NotSureState;
  timeline: TimelineState;
  financial: FinancialState;
  onEdit: (step: number) => void;
}) {
  const productLabel =
    PRODUCT_OPTIONS.find((p) => p.id === selectedProduct)?.label ?? selectedProduct;
  const funding: [string, string][] = [];
  if (selectedProduct === 'ra') {
    funding.push([
      'Contribution type',
      RA_CONTRIBUTION_TYPES.find((c) => c.value === ra.contribution_type)?.label ?? '—',
    ]);
    if (needsMonthly(ra.contribution_type)) {
      funding.push([
        'Monthly amount',
        ra.monthly_adviser_assist
          ? 'Adviser assist'
          : ra.monthly_amount
            ? `R ${ra.monthly_amount}`
            : '—',
      ]);
    }
    if (needsLumpSum(ra.contribution_type)) {
      funding.push([
        'Lump sum amount',
        ra.lump_sum_adviser_assist
          ? 'Adviser assist'
          : ra.lump_sum_amount
            ? `R ${ra.lump_sum_amount}`
            : '—',
      ]);
    }
  }
  if (isPreservation(selectedProduct)) {
    funding.push(
      ['Transferring from employer fund', yesNo(preservation.is_transferring)],
      [
        'Estimated transfer amount',
        preservation.transfer_not_sure
          ? 'Not sure'
          : preservation.transfer_amount
            ? `R ${preservation.transfer_amount}`
            : '—',
      ],
    );
  }
  if (selectedProduct === 'not_sure') {
    funding.push(
      ['Currently employed', yesNo(notSureContext.currently_employed)],
      ['Leaving employer fund', yesNo(notSureContext.leaving_employer_fund)],
      [
        'Want monthly contributions',
        MONTHLY_CHOICES.find((c) => c.value === notSureContext.want_monthly_contributions)?.label ??
          '—',
      ],
    );
  }
  const timelineRows: [string, string][] = [
    ['Current age', timeline.current_age ? `${timeline.current_age} years` : '—'],
    [
      'Planned retirement age',
      timeline.planned_retirement_age ? `${timeline.planned_retirement_age} years` : '—',
    ],
    ['Current retirement fund member', yesNo(timeline.member_of_retirement_fund)],
  ];
  if (timeline.member_of_retirement_fund && timeline.fund_details) {
    timelineRows.push(['Fund(s)', timeline.fund_details]);
  }
  const financialRows: [string, string][] = [
    [
      'Gross monthly income',
      financial.income_gross_monthly ? `R ${financial.income_gross_monthly}` : '—',
    ],
    [
      'Net monthly income',
      financial.income_net_monthly ? `R ${financial.income_net_monthly}` : '—',
    ],
    [
      'Current retirement savings',
      financial.current_retirement_savings ? `R ${financial.current_retirement_savings}` : '—',
    ],
  ];
  const tax = TAX_BRACKET_OPTIONS.find((o) => o.value === financial.tax_bracket)?.label;
  if (tax) financialRows.push(['Tax bracket', tax]);

  return (
    <Step
      title="Review & submit"
      lead="Please review your details before submitting your retirement planning quote request."
    >
      <Review>
        <ReviewSection title="Retirement Product" onEdit={() => onEdit(1)}>
          <ReviewRows rows={[['Selected product', productLabel || '—']]} />
        </ReviewSection>
        <ReviewSection title="Funding" onEdit={() => onEdit(2)}>
          {funding.length > 0 ? <ReviewRows rows={funding} /> : null}
        </ReviewSection>
        <ReviewSection title="Retirement Timeline" onEdit={() => onEdit(3)}>
          <ReviewRows rows={timelineRows} />
        </ReviewSection>
        <ReviewSection title="Financial Snapshot" onEdit={() => onEdit(4)}>
          <ReviewRows rows={financialRows} />
        </ReviewSection>
      </Review>
    </Step>
  );
}
