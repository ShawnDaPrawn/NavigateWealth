/**
 * ProductQuoteRisk — the risk management quote, in the board's four steps:
 * the covers and their amounts, about you, chronic conditions, and the
 * review. The questions, options, checks, saved progress and request are the
 * live RiskQuoteWizard's (risk/model.ts); the board's look is kept.
 *
 * Where the board differs from the live wizard, the live wizard's questions
 * are drawn in the board's controls: each cover keeps its own "adviser
 * assistance" tick (the board has one for all covers), and each cover's
 * one-line explanation sits under its name.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CHRONIC_PRESETS,
  COVER_OPTIONS,
  MARITAL_OPTIONS,
  QUALIFICATION_OPTIONS,
  SMOKER_OPTIONS,
  WIZARD_STEPS,
  clearDraft,
  getInitialHealthDisclosures,
  getInitialPersonalDetails,
  getInitialRiskNeeds,
  loadDraft,
  needsSpouseIncome,
  parseCurrencyToNumber,
  saveDraft,
  type HealthDisclosures,
  type PersonalDetails,
  type RiskNeeds,
} from '../../components/pages/quote/components/risk/model';
import {
  ChipsMulti,
  Field,
  FieldGrid,
  MoneyInput,
  Note,
  Panel,
  Review,
  ReviewList,
  ReviewRows,
  ReviewSection,
  ReviewText,
  SelectInput,
  Step,
  TextArea,
  TextInput,
} from './ProductQuoteFields';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import { riskProductDetails, dash } from './ProductQuoteModel';
import { ProductQuoteWizard } from './ProductQuoteWizard';
import { COMPLETE_FIELDS, useQuoteSend, type WizardProps } from './ProductQuoteSend';

const NOT_SPECIFIED = 'Not specified';

/** The board's hints beside a disabled Next, step by step. */
const HINTS: Record<number, string> = {
  1: 'Select a cover or request adviser assistance',
  2: COMPLETE_FIELDS,
  3: 'Choose None or Yes to continue',
};

function labelOf(options: readonly { value: string; label: string }[], value: string) {
  return options.find((o) => o.value === value)?.label;
}

export function ProductQuoteRisk({ contact, parentSubmissionId, onSuccess }: WizardProps) {
  const [draft] = useState(loadDraft);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [riskNeeds, setRiskNeeds] = useState<RiskNeeds>(draft?.risk_needs ?? getInitialRiskNeeds());
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>(
    draft?.personal_details ?? getInitialPersonalDetails(),
  );
  const [healthDisclosures, setHealthDisclosures] = useState<HealthDisclosures>(
    draft?.health_disclosures ?? getInitialHealthDisclosures(),
  );

  useEffect(() => {
    saveDraft({
      risk_needs: riskNeeds,
      personal_details: personalDetails,
      health_disclosures: healthDisclosures,
      currentStep,
    });
  }, [riskNeeds, personalDetails, healthDisclosures, currentStep]);

  const step1Valid = useMemo(() => {
    const selected = COVER_OPTIONS.filter((c) => riskNeeds[c.id].selected);
    if (selected.length === 0) return false;
    return selected.every((c) => {
      const entry = riskNeeds[c.id];
      return entry.adviser_assist || parseCurrencyToNumber(entry.amount) > 0;
    });
  }, [riskNeeds]);

  const step2Valid = useMemo(() => {
    const d = personalDetails;
    if (!d.occupation.trim()) return false;
    if (!d.income_gross_monthly.trim()) return false;
    if (!d.income_net_monthly.trim()) return false;
    if (!d.smoker_status) return false;
    if (!d.marital_status) return false;
    if (needsSpouseIncome(d.marital_status) && !d.spouse_income_monthly.trim()) return false;
    return true;
  }, [personalDetails]);

  const step3Valid = healthDisclosures.has_conditions !== null;

  const canProceed =
    currentStep === 1
      ? step1Valid
      : currentStep === 2
        ? step2Valid
        : currentStep === 3
          ? step3Valid
          : true;

  const { submitting, failure, send } = useQuoteSend({
    contact,
    parentSubmissionId,
    onSuccess,
    service: 'risk-management',
    productName: 'Risk Management',
    logName: 'Risk',
    successMessage: 'Your risk quote request has been submitted!',
    clearDraft,
  });

  const submit = useCallback(() => {
    void send(() => riskProductDetails(riskNeeds, personalDetails, healthDisclosures));
  }, [send, riskNeeds, personalDetails, healthDisclosures]);

  return (
    <ProductQuoteWizard
      steps={WIZARD_STEPS.map((s) => s.label)}
      step={currentStep}
      onStep={setCurrentStep}
      valid={canProceed}
      hint={HINTS[currentStep] ?? ''}
      backHref="/get-quote/risk-management/contact"
      submitting={submitting}
      failure={failure}
      onSubmit={submit}
    >
      {currentStep === 1 ? <CoversStep riskNeeds={riskNeeds} onChange={setRiskNeeds} /> : null}
      {currentStep === 2 ? (
        <AboutStep details={personalDetails} onChange={setPersonalDetails} />
      ) : null}
      {currentStep === 3 ? (
        <HealthStep disclosures={healthDisclosures} onChange={setHealthDisclosures} />
      ) : null}
      {currentStep === 4 ? (
        <ReviewStep
          contact={contact}
          riskNeeds={riskNeeds}
          personalDetails={personalDetails}
          healthDisclosures={healthDisclosures}
          onEdit={setCurrentStep}
        />
      ) : null}
    </ProductQuoteWizard>
  );
}

// ── Step 1: covers ────────────────────────────────────────────────────────────

function CoversStep({
  riskNeeds,
  onChange,
}: {
  riskNeeds: RiskNeeds;
  onChange: (needs: RiskNeeds) => void;
}) {
  const patch = (id: string, change: Partial<RiskNeeds[string]>) =>
    onChange({ ...riskNeeds, [id]: { ...riskNeeds[id], ...change } });

  return (
    <Step
      title="What cover do you want to quote?"
      lead="Select one or more covers and enter amounts, or request adviser assistance."
    >
      <div className="nwpq-covers">
        {COVER_OPTIONS.map((cover) => {
          const entry = riskNeeds[cover.id];
          return (
            <div
              key={cover.id}
              className={`nwpq-opt nwpq-cover${entry.selected ? ' nwpq-cover--on' : ''}`}
            >
              <button
                type="button"
                className="nwpq-cover-btn"
                aria-pressed={entry.selected}
                onClick={() => patch(cover.id, { selected: !entry.selected })}
              >
                <span className="nwpq-box" aria-hidden="true">
                  {entry.selected ? <ProductQuoteIcon name="check" size={12} /> : null}
                </span>
                <span className="nwpq-opt-text">
                  <span className="nwpq-opt-title">{cover.label}</span>
                  <span className="nwpq-opt-info">{dash(cover.infoBlip)}</span>
                </span>
              </button>
              {entry.selected ? (
                <div className="nwpq-cover-more">
                  <Field
                    small
                    label={
                      cover.isMonthly
                        ? 'Monthly amount (ZAR / month, real value)'
                        : 'Cover amount (ZAR)'
                    }
                  >
                    {(id) => (
                      <MoneyInput
                        id={id}
                        compact
                        placeholder={cover.isMonthly ? '35,000' : '2,000,000'}
                        value={entry.amount}
                        disabled={entry.adviser_assist}
                        onChange={(amount) => patch(cover.id, { amount })}
                      />
                    )}
                  </Field>
                  <button
                    type="button"
                    className="nwpq-tick"
                    aria-pressed={entry.adviser_assist}
                    onClick={() => patch(cover.id, { adviser_assist: !entry.adviser_assist })}
                  >
                    <span className="nwpq-box" aria-hidden="true">
                      {entry.adviser_assist ? <ProductQuoteIcon name="check" size={12} /> : null}
                    </span>
                    Require adviser assistance determining my cover amount
                  </button>
                  {!entry.adviser_assist && !entry.amount ? (
                    <Note>
                      {"Not sure? Choose adviser assistance and we'll calculate this with you."}
                    </Note>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Step>
  );
}

// ── Step 2: about you ─────────────────────────────────────────────────────────

function AboutStep({
  details,
  onChange,
}: {
  details: PersonalDetails;
  onChange: (d: PersonalDetails) => void;
}) {
  const update = (field: keyof PersonalDetails, value: string) =>
    onChange({ ...details, [field]: value });
  const grossNum = parseCurrencyToNumber(details.income_gross_monthly);
  const netNum = parseCurrencyToNumber(details.income_net_monthly);
  const showNetWarning = grossNum > 0 && netNum > 0 && netNum > grossNum;

  return (
    <Step title="Tell us a bit about you" lead="These details help us provide an accurate quote.">
      <FieldGrid>
        <Field label="Occupation" required>
          {(id) => (
            <TextInput
              id={id}
              required
              placeholder="e.g. Project Manager"
              value={details.occupation}
              onChange={(v) => update('occupation', v)}
            />
          )}
        </Field>
        <Field label="Smoker status" required>
          {(id) => (
            <SelectInput
              id={id}
              required
              placeholder="Select..."
              options={SMOKER_OPTIONS}
              value={details.smoker_status}
              onChange={(v) => update('smoker_status', v)}
            />
          )}
        </Field>
        <Field label="Gross monthly income" required>
          {(id) => (
            <MoneyInput
              id={id}
              required
              placeholder="85,000"
              value={details.income_gross_monthly}
              onChange={(v) => update('income_gross_monthly', v)}
            />
          )}
        </Field>
        <Field label="Net monthly income" required>
          {(id) => (
            <>
              <MoneyInput
                id={id}
                required
                placeholder="62,000"
                value={details.income_net_monthly}
                onChange={(v) => update('income_net_monthly', v)}
              />
              {showNetWarning ? (
                <span role="alert" className="nwpq-warn">
                  Net income is usually lower than gross — please double-check.
                </span>
              ) : null}
            </>
          )}
        </Field>
        <Field label="Highest qualification">
          {(id) => (
            <SelectInput
              id={id}
              placeholder="Select..."
              options={QUALIFICATION_OPTIONS}
              value={details.highest_qualification}
              onChange={(v) => update('highest_qualification', v)}
            />
          )}
        </Field>
        <Field label="Marital status" required>
          {(id) => (
            <SelectInput
              id={id}
              required
              placeholder="Select..."
              options={MARITAL_OPTIONS}
              value={details.marital_status}
              onChange={(v) => update('marital_status', v)}
            />
          )}
        </Field>
        {needsSpouseIncome(details.marital_status) ? (
          <Field label="Spouse / partner monthly income" required className="nw-in">
            {(id) => (
              <MoneyInput
                id={id}
                required
                placeholder="45,000"
                value={details.spouse_income_monthly}
                onChange={(v) => update('spouse_income_monthly', v)}
              />
            )}
          </Field>
        ) : null}
      </FieldGrid>
    </Step>
  );
}

// ── Step 3: chronic conditions ────────────────────────────────────────────────

function HealthStep({
  disclosures,
  onChange,
}: {
  disclosures: HealthDisclosures;
  onChange: (d: HealthDisclosures) => void;
}) {
  const toggleCondition = (condition: string) => {
    const current = disclosures.selected_conditions;
    const updated = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    onChange({
      ...disclosures,
      has_conditions:
        updated.length > 0 || disclosures.free_text.trim().length > 0
          ? true
          : disclosures.has_conditions,
      selected_conditions: updated,
    });
  };

  return (
    <Step
      title="Any ongoing or chronic conditions?"
      lead="This helps us pre-screen underwriting options. It's not a medical form — just a light-touch disclosure."
    >
      <div role="radiogroup" aria-label="Chronic conditions" className="nwpq-pair">
        <button
          type="button"
          role="radio"
          aria-checked={disclosures.has_conditions === false}
          className="nwpq-opt nwpq-pair-btn"
          onClick={() =>
            onChange({ has_conditions: false, selected_conditions: [], free_text: '' })
          }
        >
          None
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={disclosures.has_conditions === true}
          className="nwpq-opt nwpq-pair-btn"
          onClick={() => onChange({ ...disclosures, has_conditions: true })}
        >
          Yes, I have conditions
        </button>
      </div>
      {disclosures.has_conditions === true ? (
        <Panel>
          <ChipsMulti
            small
            label="Quick select (optional)"
            options={CHRONIC_PRESETS}
            values={disclosures.selected_conditions}
            onToggle={toggleCondition}
          />
          <Field small label="Additional details or other conditions">
            {(id) => (
              <TextArea
                id={id}
                placeholder="e.g., high blood pressure, cholesterol, hyperthyroid..."
                value={disclosures.free_text}
                onChange={(v) => onChange({ ...disclosures, free_text: v })}
              />
            )}
          </Field>
        </Panel>
      ) : null}
    </Step>
  );
}

// ── Step 4: review ────────────────────────────────────────────────────────────

function ReviewStep({
  contact,
  riskNeeds,
  personalDetails: p,
  healthDisclosures: h,
  onEdit,
}: {
  contact: WizardProps['contact'];
  riskNeeds: RiskNeeds;
  personalDetails: PersonalDetails;
  healthDisclosures: HealthDisclosures;
  onEdit: (step: number) => void;
}) {
  const selectedCovers = COVER_OPTIONS.filter((c) => riskNeeds[c.id].selected);
  const health =
    h.has_conditions === false
      ? 'No chronic conditions declared'
      : h.has_conditions === true
        ? h.selected_conditions.length || h.free_text
          ? [...h.selected_conditions, ...(h.free_text ? [h.free_text] : [])].join(', ')
          : 'Conditions indicated but none specified'
        : 'Not answered';

  const personal: [string, string][] = [
    ['Occupation', p.occupation || NOT_SPECIFIED],
    [
      'Gross monthly income',
      p.income_gross_monthly ? `R ${p.income_gross_monthly}` : NOT_SPECIFIED,
    ],
    ['Net monthly income', p.income_net_monthly ? `R ${p.income_net_monthly}` : NOT_SPECIFIED],
    ['Smoker status', labelOf(SMOKER_OPTIONS, p.smoker_status) || p.smoker_status || NOT_SPECIFIED],
    [
      'Qualification',
      labelOf(QUALIFICATION_OPTIONS, p.highest_qualification) ||
        p.highest_qualification ||
        NOT_SPECIFIED,
    ],
    [
      'Marital status',
      labelOf(MARITAL_OPTIONS, p.marital_status) || p.marital_status || NOT_SPECIFIED,
    ],
  ];
  if (needsSpouseIncome(p.marital_status)) {
    personal.push([
      'Spouse income',
      p.spouse_income_monthly ? `R ${p.spouse_income_monthly} /month` : NOT_SPECIFIED,
    ]);
  }

  return (
    <Step title="Review & Submit" lead="Please review your details before submitting.">
      <Review>
        <ReviewSection title="Contact">
          <ReviewRows
            narrow
            plain
            rows={[
              ['Name', `${contact.firstName} ${contact.lastName}`],
              ['Email', contact.email],
              ['Phone', contact.phone],
            ]}
          />
        </ReviewSection>
        <ReviewSection title="Cover" onEdit={() => onEdit(1)}>
          {selectedCovers.length === 0 ? (
            <ReviewText muted>No covers selected</ReviewText>
          ) : (
            <ReviewList
              items={selectedCovers.map((cover) => {
                const entry = riskNeeds[cover.id];
                return [
                  cover.label,
                  entry.adviser_assist
                    ? 'Adviser assistance requested'
                    : entry.amount
                      ? `R ${entry.amount}${cover.isMonthly ? ' /month' : ''}`
                      : 'Amount not specified',
                ] as const;
              })}
            />
          )}
        </ReviewSection>
        <ReviewSection title="About you" onEdit={() => onEdit(2)}>
          <ReviewRows rows={personal} />
        </ReviewSection>
        <ReviewSection title="Health" onEdit={() => onEdit(3)}>
          <ReviewText>{health}</ReviewText>
        </ReviewSection>
      </Review>
    </Step>
  );
}
