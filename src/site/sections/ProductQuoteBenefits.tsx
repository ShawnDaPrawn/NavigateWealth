/**
 * ProductQuoteBenefits — the employee benefits quote in the board's frame:
 * the business, the benefits wanted, the budget, the workforce, and the
 * review. The questions, options, checks, saved progress and request are the
 * live EmployeeBenefitsQuoteWizard's (employeeBenefits/model.ts), drawn in
 * the board's controls; the live page's custom sector list is the board's
 * drop-down.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AGE_BAND_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
  COMPULSORY_OPTIONS,
  CONTRIBUTION_STRUCTURE_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  INDUSTRY_SECTORS,
  SA_PROVINCES,
  WIZARD_STEPS,
  WORKFORCE_TYPE_OPTIONS,
  clearDraft,
  getInitialBudget,
  getInitialBusiness,
  getInitialWorkforce,
  loadDraft,
  saveDraft,
  type BudgetState,
  type BusinessState,
  type WorkforceState,
} from '../../components/pages/quote/components/employeeBenefits/model';
import {
  AmountWithToggle,
  Chips,
  Choices,
  Field,
  Pair,
  Review,
  ReviewRows,
  ReviewSection,
  SelectInput,
  Step,
  TextArea,
  TextInput,
} from './ProductQuoteFields';
import { benefitsProductDetails, YES_NO_BOOL } from './ProductQuoteModel';
import { ProductQuoteWizard } from './ProductQuoteWizard';
import { COMPLETE_FIELDS, useQuoteSend, type WizardProps } from './ProductQuoteSend';

const labelOf = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? '';

const asOptions = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

export function ProductQuoteBenefits({ contact, parentSubmissionId, onSuccess }: WizardProps) {
  const [draft] = useState(loadDraft);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [business, setBusiness] = useState<BusinessState>(draft?.business ?? getInitialBusiness());
  const [benefitType, setBenefitType] = useState(draft?.benefit_type ?? '');
  const [budget, setBudget] = useState<BudgetState>(draft?.budget ?? getInitialBudget());
  const [workforce, setWorkforce] = useState<WorkforceState>(
    draft?.workforce ?? getInitialWorkforce(),
  );

  useEffect(() => {
    saveDraft({ business, benefit_type: benefitType, budget, workforce, currentStep });
  }, [business, benefitType, budget, workforce, currentStep]);

  const step1Valid = Boolean(
    business.company_name.trim() &&
    business.industry_sector &&
    business.employee_count &&
    business.province,
  );
  const step3Valid =
    (budget.budget_adviser_assist || Boolean(budget.monthly_budget)) &&
    Boolean(budget.contribution_structure) &&
    Boolean(budget.compulsory_for_all);
  const step4Valid = Boolean(
    workforce.average_age_band &&
    workforce.workforce_type &&
    workforce.has_existing_benefits !== null,
  );
  const canProceed =
    [true, step1Valid, Boolean(benefitType), step3Valid, step4Valid, true][currentStep] ?? false;

  const { submitting, failure, send } = useQuoteSend({
    contact,
    parentSubmissionId,
    onSuccess,
    service: 'employee-benefits',
    productName: 'Employee Benefits',
    logName: 'Employee benefits',
    successMessage: 'Your employee benefits quote request has been submitted!',
    clearDraft,
  });

  const submit = useCallback(() => {
    void send(() => benefitsProductDetails(business, benefitType, budget, workforce));
  }, [send, business, benefitType, budget, workforce]);

  return (
    <ProductQuoteWizard
      steps={WIZARD_STEPS.map((s) => s.label)}
      step={currentStep}
      onStep={setCurrentStep}
      valid={canProceed}
      hint={COMPLETE_FIELDS}
      backHref="/get-quote/employee-benefits/contact"
      submitting={submitting}
      failure={failure}
      onSubmit={submit}
    >
      {currentStep === 1 ? (
        <Step
          title="Tell us about your business"
          lead="Basic company information to help us prepare your employee benefits proposal."
        >
          <Field label="Registered company name" required>
            {(id) => (
              <TextInput
                id={id}
                required
                placeholder="e.g. Acme Holdings (Pty) Ltd"
                value={business.company_name}
                onChange={(v) => setBusiness({ ...business, company_name: v })}
              />
            )}
          </Field>
          <Field
            label={
              <>
                Trading name <span className="nwpq-optional">(optional, if different)</span>
              </>
            }
          >
            {(id) => (
              <TextInput
                id={id}
                placeholder="e.g. Acme Solutions"
                value={business.trading_name}
                onChange={(v) => setBusiness({ ...business, trading_name: v })}
              />
            )}
          </Field>
          <Field label="Industry sector" required>
            {(id) => (
              <SelectInput
                id={id}
                required
                placeholder="Select industry sector"
                options={asOptions(INDUSTRY_SECTORS)}
                value={business.industry_sector}
                onChange={(v) => setBusiness({ ...business, industry_sector: v })}
              />
            )}
          </Field>
          <Chips
            label="Number of employees"
            required
            options={EMPLOYEE_COUNT_OPTIONS}
            value={business.employee_count}
            onChange={(v) => setBusiness({ ...business, employee_count: v })}
          />
          <Chips
            label="Location (Province)"
            required
            options={asOptions(SA_PROVINCES)}
            value={business.province}
            onChange={(v) => setBusiness({ ...business, province: v })}
          />
        </Step>
      ) : null}
      {currentStep === 2 ? (
        <Step
          title="What benefits are you looking to implement?"
          lead="Select the type of employee benefits your business needs."
        >
          <Choices
            ariaLabel="Benefit types"
            options={BENEFIT_TYPE_OPTIONS.map((o) => ({
              value: o.id,
              label: o.label,
              info: o.info,
            }))}
            value={benefitType}
            onChange={setBenefitType}
          />
        </Step>
      ) : null}
      {currentStep === 3 ? (
        <Step
          title="What is your intended monthly budget?"
          lead="An estimate helps your adviser right-size the proposal."
        >
          <AmountWithToggle
            label="Estimated total monthly budget for employee benefits"
            required
            placeholder="25,000"
            value={budget.monthly_budget}
            onChange={(v) => setBudget({ ...budget, monthly_budget: v })}
            toggleLabel="Adviser guidance"
            toggled={budget.budget_adviser_assist}
            onToggle={() =>
              setBudget({
                ...budget,
                budget_adviser_assist: !budget.budget_adviser_assist,
                monthly_budget: !budget.budget_adviser_assist ? '' : budget.monthly_budget,
              })
            }
          />
          <Choices
            label="Contribution structure preference"
            required
            options={CONTRIBUTION_STRUCTURE_OPTIONS}
            value={budget.contribution_structure}
            onChange={(v) => setBudget({ ...budget, contribution_structure: v })}
          />
          <Chips
            label="Are benefits compulsory for all staff?"
            required
            options={COMPULSORY_OPTIONS}
            value={budget.compulsory_for_all}
            onChange={(v) => setBudget({ ...budget, compulsory_for_all: v })}
          />
        </Step>
      ) : null}
      {currentStep === 4 ? (
        <Step
          title="Workforce overview"
          lead="A high-level view of your workforce helps your adviser structure the right solution."
        >
          <Chips
            label="Average employee age band"
            required
            options={AGE_BAND_OPTIONS}
            value={workforce.average_age_band}
            onChange={(v) => setWorkforce({ ...workforce, average_age_band: v })}
          />
          <Pair
            label="Are employees primarily:"
            required
            options={WORKFORCE_TYPE_OPTIONS}
            value={workforce.workforce_type}
            onChange={(v) => setWorkforce({ ...workforce, workforce_type: v })}
          />
          <Pair
            label="Do you currently have any employee benefits in place?"
            required
            options={YES_NO_BOOL}
            value={workforce.has_existing_benefits}
            onChange={(v) =>
              setWorkforce({
                ...workforce,
                has_existing_benefits: v,
                existing_benefits_description: v ? workforce.existing_benefits_description : '',
              })
            }
          />
          {workforce.has_existing_benefits === true ? (
            <Field
              small
              className="nw-in"
              label={
                <>
                  Briefly describe current arrangement{' '}
                  <span className="nwpq-optional">(optional)</span>
                </>
              }
            >
              {(id) => (
                <TextArea
                  id={id}
                  placeholder="e.g. Group RA with Old Mutual, basic group life cover"
                  value={workforce.existing_benefits_description}
                  onChange={(v) => setWorkforce({ ...workforce, existing_benefits_description: v })}
                />
              )}
            </Field>
          ) : null}
        </Step>
      ) : null}
      {currentStep === 5 ? (
        <Step
          title="Review & submit"
          lead="Please review your details before submitting your employee benefits quote request."
        >
          <Review>
            <ReviewSection title="Business Details" onEdit={() => setCurrentStep(1)}>
              <ReviewRows
                rows={[
                  ['Company name', business.company_name || '—'],
                  ...(business.trading_name
                    ? ([['Trading name', business.trading_name]] as [string, string][])
                    : []),
                  ['Industry sector', business.industry_sector || '—'],
                  [
                    'Number of employees',
                    labelOf(EMPLOYEE_COUNT_OPTIONS, business.employee_count) || '—',
                  ],
                  ['Province', business.province || '—'],
                ]}
              />
            </ReviewSection>
            <ReviewSection title="Benefit Type" onEdit={() => setCurrentStep(2)}>
              <ReviewRows
                rows={[
                  [
                    'Selected benefit type',
                    (BENEFIT_TYPE_OPTIONS.find((b) => b.id === benefitType)?.label ??
                      benefitType) ||
                      '—',
                  ],
                ]}
              />
            </ReviewSection>
            <ReviewSection title="Budget & Contribution" onEdit={() => setCurrentStep(3)}>
              <ReviewRows
                rows={[
                  [
                    'Monthly budget',
                    budget.budget_adviser_assist
                      ? 'Adviser guidance requested'
                      : budget.monthly_budget
                        ? `R ${budget.monthly_budget} /month`
                        : '—',
                  ],
                  [
                    'Contribution structure',
                    labelOf(CONTRIBUTION_STRUCTURE_OPTIONS, budget.contribution_structure) || '—',
                  ],
                  [
                    'Compulsory for all staff',
                    labelOf(COMPULSORY_OPTIONS, budget.compulsory_for_all) || '—',
                  ],
                ]}
              />
            </ReviewSection>
            <ReviewSection title="Workforce Overview" onEdit={() => setCurrentStep(4)}>
              <ReviewRows
                rows={[
                  [
                    'Average age band',
                    labelOf(AGE_BAND_OPTIONS, workforce.average_age_band) || '—',
                  ],
                  [
                    'Workforce type',
                    labelOf(WORKFORCE_TYPE_OPTIONS, workforce.workforce_type) || '—',
                  ],
                  [
                    'Existing benefits',
                    workforce.has_existing_benefits === null
                      ? '—'
                      : workforce.has_existing_benefits
                        ? 'Yes'
                        : 'No',
                  ],
                  ...(workforce.has_existing_benefits && workforce.existing_benefits_description
                    ? ([['Current arrangement', workforce.existing_benefits_description]] as [
                        string,
                        string,
                      ][])
                    : []),
                ]}
              />
            </ReviewSection>
          </Review>
        </Step>
      ) : null}
    </ProductQuoteWizard>
  );
}
