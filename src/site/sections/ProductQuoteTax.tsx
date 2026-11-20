/**
 * ProductQuoteTax — the tax planning quote in the board's frame: the tax
 * submissions needed, the taxpayer, the scope, and the review. The questions,
 * options, checks, saved progress and request are the live
 * TaxPlanningQuoteWizard's (taxPlanning/model.ts), drawn in the board's
 * controls. "Not sure" stays exclusive, as on the live page: choosing it
 * clears the others, and choosing another clears it.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  SUBMISSION_STATUS_OPTIONS,
  TAXPAYER_TYPE_OPTIONS,
  TAX_TYPE_OPTIONS,
  TAX_YEAR_OPTIONS,
  TURNOVER_BAND_OPTIONS,
  WIZARD_STEPS,
  YES_NO,
  YES_NO_NOTSURE,
  clearDraft,
  getInitialFinancialScope,
  getInitialTaxpayerContext,
  loadDraft,
  lookupLabel,
  saveDraft,
  ynsLabel,
  type FinancialScopeState,
  type TaxpayerContextState,
} from '../../components/pages/quote/components/taxPlanning/model';
import {
  Checks,
  Chips,
  Choices,
  Pair,
  Review,
  ReviewList,
  ReviewRows,
  ReviewSection,
  Step,
} from './ProductQuoteFields';
import { taxProductDetails } from './ProductQuoteModel';
import { ProductQuoteWizard } from './ProductQuoteWizard';
import { COMPLETE_FIELDS, useQuoteSend, type WizardProps } from './ProductQuoteSend';

export function ProductQuoteTax({ contact, parentSubmissionId, onSuccess }: WizardProps) {
  const [draft] = useState(loadDraft);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(draft?.selected_types ?? []);
  const [taxpayerContext, setTaxpayerContext] = useState<TaxpayerContextState>(
    draft?.taxpayer_context ?? getInitialTaxpayerContext(),
  );
  const [financialScope, setFinancialScope] = useState<FinancialScopeState>(
    draft?.financial_scope ?? getInitialFinancialScope(),
  );

  useEffect(() => {
    saveDraft({
      selected_types: selectedTypes,
      taxpayer_context: taxpayerContext,
      financial_scope: financialScope,
      currentStep,
    });
  }, [selectedTypes, taxpayerContext, financialScope, currentStep]);

  const step2Valid = Boolean(
    taxpayerContext.taxpayer_type &&
    taxpayerContext.sars_registered &&
    taxpayerContext.submission_status &&
    taxpayerContext.tax_years,
  );
  const step3Valid = Boolean(
    financialScope.turnover_band &&
    financialScope.has_foreign_income &&
    financialScope.under_sars_audit &&
    financialScope.has_penalties,
  );
  const canProceed =
    [true, selectedTypes.length > 0, step2Valid, step3Valid, true][currentStep] ?? false;

  const toggleType = (id: string) => {
    if (id === 'not_sure') {
      setSelectedTypes(selectedTypes.includes('not_sure') ? [] : ['not_sure']);
      return;
    }
    const without = selectedTypes.filter((s) => s !== 'not_sure');
    setSelectedTypes(without.includes(id) ? without.filter((s) => s !== id) : [...without, id]);
  };

  const { submitting, failure, send } = useQuoteSend({
    contact,
    parentSubmissionId,
    onSuccess,
    service: 'tax-planning',
    productName: 'Tax Planning',
    logName: 'Tax planning',
    successMessage: 'Your tax planning quote request has been submitted!',
    clearDraft,
  });

  const submit = useCallback(() => {
    void send(() => taxProductDetails(selectedTypes, taxpayerContext, financialScope));
  }, [send, selectedTypes, taxpayerContext, financialScope]);

  const ctx = (patch: Partial<TaxpayerContextState>) =>
    setTaxpayerContext({ ...taxpayerContext, ...patch });
  const scope = (patch: Partial<FinancialScopeState>) =>
    setFinancialScope({ ...financialScope, ...patch });

  return (
    <ProductQuoteWizard
      steps={WIZARD_STEPS.map((s) => s.label)}
      step={currentStep}
      onStep={setCurrentStep}
      valid={canProceed}
      hint={COMPLETE_FIELDS}
      backHref="/get-quote/tax-planning/contact"
      submitting={submitting}
      failure={failure}
      onSubmit={submit}
    >
      {currentStep === 1 ? (
        <Step
          title="What tax submission do you need help with?"
          lead="Select all that apply. You can choose more than one."
        >
          <Checks
            label="Tax submissions"
            options={TAX_TYPE_OPTIONS.map((o) => ({ value: o.id, label: o.label, info: o.info }))}
            values={selectedTypes}
            onToggle={toggleType}
          />
        </Step>
      ) : null}
      {currentStep === 2 ? (
        <Step
          title="Tell us about the taxpayer"
          lead="Basic details to route your request to the right specialist."
        >
          <Chips
            label="Taxpayer type"
            required
            options={TAXPAYER_TYPE_OPTIONS}
            value={taxpayerContext.taxpayer_type}
            onChange={(v) => ctx({ taxpayer_type: v })}
          />
          <Chips
            label="Are you currently registered with SARS for this tax type?"
            required
            options={YES_NO_NOTSURE}
            value={taxpayerContext.sars_registered}
            onChange={(v) => ctx({ sars_registered: v })}
          />
          <Choices
            label="Is this a new submission or are there outstanding returns?"
            required
            options={SUBMISSION_STATUS_OPTIONS}
            value={taxpayerContext.submission_status}
            onChange={(v) => ctx({ submission_status: v })}
          />
          <Chips
            label="Tax year(s) involved"
            required
            options={TAX_YEAR_OPTIONS}
            value={taxpayerContext.tax_years}
            onChange={(v) => ctx({ tax_years: v })}
          />
        </Step>
      ) : null}
      {currentStep === 3 ? (
        <Step title="Scope overview" lead="High-level information to help us size your engagement.">
          <Chips
            label="Estimated annual turnover or income"
            required
            options={TURNOVER_BAND_OPTIONS}
            value={financialScope.turnover_band}
            onChange={(v) => scope({ turnover_band: v })}
          />
          <Pair
            label="Do you have foreign income or offshore assets?"
            required
            options={YES_NO}
            value={financialScope.has_foreign_income}
            onChange={(v) => scope({ has_foreign_income: v })}
          />
          <Pair
            label="Are you currently under SARS audit or verification?"
            required
            options={YES_NO}
            value={financialScope.under_sars_audit}
            onChange={(v) => scope({ under_sars_audit: v })}
          />
          <Chips
            label="Have penalties or interest been raised?"
            required
            options={YES_NO_NOTSURE}
            value={financialScope.has_penalties}
            onChange={(v) => scope({ has_penalties: v })}
          />
        </Step>
      ) : null}
      {currentStep === 4 ? (
        <Step
          title="Review & submit"
          lead="Please review your details before submitting your tax planning quote request."
        >
          <Review>
            <ReviewSection title="Tax Submission Type(s)" onEdit={() => setCurrentStep(1)}>
              <ReviewList
                items={selectedTypes.map(
                  (id) => [TAX_TYPE_OPTIONS.find((t) => t.id === id)?.label ?? id] as const,
                )}
              />
            </ReviewSection>
            <ReviewSection title="Taxpayer Details" onEdit={() => setCurrentStep(2)}>
              <ReviewRows
                rows={[
                  [
                    'Taxpayer type',
                    lookupLabel(TAXPAYER_TYPE_OPTIONS, taxpayerContext.taxpayer_type) || '—',
                  ],
                  ['Registered with SARS', ynsLabel(taxpayerContext.sars_registered)],
                  [
                    'Submission status',
                    lookupLabel(SUBMISSION_STATUS_OPTIONS, taxpayerContext.submission_status) ||
                      '—',
                  ],
                  ['Tax year(s)', lookupLabel(TAX_YEAR_OPTIONS, taxpayerContext.tax_years) || '—'],
                ]}
              />
            </ReviewSection>
            <ReviewSection title="Financial Scope" onEdit={() => setCurrentStep(3)}>
              <ReviewRows
                rows={[
                  [
                    'Annual turnover / income',
                    lookupLabel(TURNOVER_BAND_OPTIONS, financialScope.turnover_band) || '—',
                  ],
                  ['Foreign income / offshore assets', ynsLabel(financialScope.has_foreign_income)],
                  ['Under SARS audit / verification', ynsLabel(financialScope.under_sars_audit)],
                  ['Penalties or interest raised', ynsLabel(financialScope.has_penalties)],
                ]}
              />
            </ReviewSection>
          </Review>
        </Step>
      ) : null}
    </ProductQuoteWizard>
  );
}
