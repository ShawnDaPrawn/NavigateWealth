/**
 * ProductQuoteModel — what the redesigned "quote details" step sends.
 *
 * The request is the live page's: POST /quote-request/submit with the same
 * body, its keys in the same order, built here from each wizard's state by
 * the same code the live wizards run in their submit handlers
 * (src/components/pages/quote/components/*QuoteWizard.tsx), copied rather
 * than shared because the live wizards stay as they are. The page tests run
 * the live wizard and this page on the same answers and expect the same body.
 *
 * The one difference is the header: the live wizards send the public anon key
 * as a bearer token, and this page does not. POST /quote-request/submit is
 * public (no auth middleware, and the function runs with verify_jwt = false),
 * as the redesigned "your details" step already relies on; see
 * anon-key-bearer-ratchet.test.ts.
 */
import { projectId } from '../../utils/supabase/info';
import type { QuoteContactDetails, QuoteServiceId } from '../../components/pages/quote/types';
import {
  COVER_OPTIONS,
  needsSpouseIncome,
  parseCurrencyToNumber,
  type HealthDisclosures,
  type PersonalDetails,
  type RiskNeeds,
} from '../../components/pages/quote/components/risk/model';
import {
  BUDGET_BANDS,
  COVER_TYPES,
  LPJ_OPTIONS,
  MEMBERSHIP_TYPES,
  NETWORK_OPTIONS,
  TENURE_OFF_OPTIONS,
  TENURE_ON_OPTIONS,
  type HealthState,
  type MedicalAidHistoryState,
  type MembersState,
  type PreferencesState,
} from '../../components/pages/quote/components/medicalAid/model';
import {
  CONTRIBUTION_TYPES,
  OBJECTIVE_OPTIONS,
  RISK_COMFORT_OPTIONS,
  TAX_BRACKET_OPTIONS as INVESTMENT_TAX_BRACKETS,
  TIME_HORIZON_OPTIONS,
  getInitialContribution,
  getLabelForType,
  needsLumpSum as investmentNeedsLumpSum,
  needsMonthly as investmentNeedsMonthly,
  type ContributionEntry,
  type FinancialState as InvestmentFinancialState,
  type ObjectiveState,
} from '../../components/pages/quote/components/investment/model';
import {
  PRODUCT_OPTIONS,
  RA_CONTRIBUTION_TYPES,
  TAX_BRACKET_OPTIONS as RETIREMENT_TAX_BRACKETS,
  needsLumpSum as retirementNeedsLumpSum,
  needsMonthly as retirementNeedsMonthly,
  type FinancialState as RetirementFinancialState,
  type NotSureState,
  type PreservationState,
  type RAContributionState,
  type TimelineState,
} from '../../components/pages/quote/components/retirement/model';
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
} from '../../components/pages/quote/components/employeeBenefits/model';
import {
  SUBMISSION_STATUS_OPTIONS,
  TAXPAYER_TYPE_OPTIONS,
  TAX_TYPE_OPTIONS,
  TAX_YEAR_OPTIONS,
  TURNOVER_BAND_OPTIONS,
  lookupLabel,
  ynsLabel,
  type FinancialScopeState,
  type TaxpayerContextState,
} from '../../components/pages/quote/components/taxPlanning/model';

export const QUOTE_SUBMIT_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit`;

export interface ProductQuoteRequest {
  contact: QuoteContactDetails;
  productName: string;
  service: QuoteServiceId;
  parentSubmissionId?: string;
  productDetails: unknown;
}

/**
 * Sends the quote. Resolves with the server's reply, or throws as fetch and
 * response.json() do — the callers report each the way the live page does.
 */
export async function submitProductQuote({
  contact,
  productName,
  service,
  parentSubmissionId,
  productDetails,
}: ProductQuoteRequest) {
  const response = await fetch(QUOTE_SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: contact.firstName.trim(),
      lastName: contact.lastName.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
      productName,
      stage: 'full',
      service,
      parentSubmissionId: parentSubmissionId ?? undefined,
      productDetails,
    }),
  });
  const result = await response.json();
  return { ok: response.ok, result };
}

/** The live wizards' failure messages, word for word. */
export const SEND_FAILED = 'Something went wrong. Please try again.';
export const SEND_UNREACHABLE =
  'Unable to submit your request. Please check your connection and try again.';

/** The metadata block every phase-2 wizard but risk appends. */
function metadata() {
  return {
    source: 'NavigateWealthApp',
    submitted_at: new Date().toISOString(),
    status: 'submitted',
  };
}

// ── Risk management (RiskQuoteWizard.handleSubmit) ─────────────────────────────

export function riskProductDetails(
  riskNeeds: RiskNeeds,
  personalDetails: PersonalDetails,
  healthDisclosures: HealthDisclosures,
) {
  const riskNeedsPayload: Record<string, unknown> = {};
  COVER_OPTIONS.forEach((c) => {
    const entry = riskNeeds[c.id];
    const base: Record<string, unknown> = {
      selected: entry.selected,
      adviser_assist: entry.adviser_assist,
    };
    if (c.isMonthly) {
      base.amount_per_month = entry.selected ? parseCurrencyToNumber(entry.amount) : null;
    } else {
      base.amount = entry.selected ? parseCurrencyToNumber(entry.amount) : null;
    }
    riskNeedsPayload[c.id] = base;
  });

  const personalPayload: Record<string, unknown> = {
    occupation: personalDetails.occupation,
    income_gross_monthly: parseCurrencyToNumber(personalDetails.income_gross_monthly),
    income_net_monthly: parseCurrencyToNumber(personalDetails.income_net_monthly),
    smoker_status: personalDetails.smoker_status,
    highest_qualification: personalDetails.highest_qualification,
    marital_status: personalDetails.marital_status,
  };
  if (needsSpouseIncome(personalDetails.marital_status)) {
    personalPayload.spouse_income_monthly = parseCurrencyToNumber(
      personalDetails.spouse_income_monthly,
    );
  }

  const healthPayload = {
    has_conditions: healthDisclosures.has_conditions,
    selected_conditions: healthDisclosures.selected_conditions,
    free_text: healthDisclosures.free_text,
  };

  return {
    phase: 2,
    risk_needs: riskNeedsPayload,
    personal_details: personalPayload,
    health_disclosures: healthPayload,
  };
}

// ── Medical aid (MedicalAidQuoteWizard.handleSubmit) ───────────────────────────

export function medicalProductDetails(
  members: MembersState,
  preferences: PreferencesState,
  history: MedicalAidHistoryState,
  health: HealthState,
  mainMemberAge: number | null,
) {
  const membersPayload: Record<string, unknown> = {
    membership_type:
      MEMBERSHIP_TYPES.find((m) => m.value === members.membership_type)?.label ??
      members.membership_type,
    main: {
      dob: members.main.dob || null,
      age: members.main.age ? parseInt(members.main.age, 10) : null,
    },
  };

  if (members.membership_type === 'main_spouse' || members.membership_type === 'family') {
    membersPayload.spouse = {
      dob: members.spouse.dob || null,
      age: members.spouse.age ? parseInt(members.spouse.age, 10) : null,
    };
  }

  if (members.membership_type === 'family') {
    membersPayload.children = members.children.map((c) => ({
      dob: c.dob || null,
      age: c.age ? parseInt(c.age, 10) : null,
    }));
  }

  const preferencesPayload = {
    cover_type:
      COVER_TYPES.find((c) => c.value === preferences.cover_type)?.label ?? preferences.cover_type,
    network:
      NETWORK_OPTIONS.find((n) => n.value === preferences.network)?.label ?? preferences.network,
    budget_band:
      BUDGET_BANDS.find((b) => b.value === preferences.budget_band)?.label ??
      preferences.budget_band,
    province: preferences.province,
  };

  const historyPayload: Record<string, unknown> = {
    current_status:
      history.current_status === 'currently_on'
        ? 'I am currently on a South African medical aid'
        : history.current_status === 'not_currently_on'
          ? 'I am not currently on a South African medical aid'
          : '',
  };

  if (history.current_status === 'currently_on') {
    historyPayload.current_scheme = history.current_scheme;
    historyPayload.current_plan = history.current_plan;
    historyPayload.current_tenure_band =
      TENURE_ON_OPTIONS.find((o) => o.value === history.current_tenure_band)?.label ?? null;
  } else {
    historyPayload.current_scheme = null;
    historyPayload.current_plan = null;
    historyPayload.current_tenure_band = null;
  }

  if (history.current_status === 'not_currently_on') {
    historyPayload.time_without_sa_medical_aid =
      TENURE_OFF_OPTIONS.find((o) => o.value === history.time_without_sa_medical_aid)?.label ??
      null;
  } else {
    historyPayload.time_without_sa_medical_aid = null;
  }

  const showLpj = mainMemberAge !== null && mainMemberAge >= 35;
  historyPayload.lpj_time_off_since_35 = showLpj
    ? (LPJ_OPTIONS.find((o) => o.value === history.lpj_time_off_since_35)?.label ?? null)
    : null;

  const healthPayload = {
    has_chronic_conditions: health.has_chronic_conditions,
    selected_conditions: health.selected_conditions,
    applies_to_members: health.applies_to_members,
    notes: health.notes,
  };

  return {
    vertical: 'MedicalAid',
    phase: 2,
    members: membersPayload,
    preferences: preferencesPayload,
    medical_aid_history: historyPayload,
    health: healthPayload,
    metadata: metadata(),
  };
}

// ── Investment management (InvestmentQuoteWizard.handleSubmit) ─────────────────

export function investmentProductDetails(
  selectedTypes: string[],
  contributions: Record<string, ContributionEntry>,
  objective: ObjectiveState,
  financial: InvestmentFinancialState,
) {
  const contributionsPayload: Record<string, unknown> = {};
  selectedTypes
    .filter((t) => t !== 'not_sure')
    .forEach((typeId) => {
      const entry = contributions[typeId] || getInitialContribution();
      const ctLabel =
        CONTRIBUTION_TYPES.find((c) => c.value === entry.contribution_type)?.label ??
        entry.contribution_type;
      const data: Record<string, unknown> = {
        contribution_type: ctLabel,
        adviser_assist: entry.contribution_type === 'not_sure',
      };
      if (investmentNeedsLumpSum(entry.contribution_type)) {
        data.lump_sum = entry.lump_sum_adviser_assist
          ? { adviser_assist: true }
          : { amount: parseCurrencyToNumber(entry.lump_sum_amount) };
      }
      if (investmentNeedsMonthly(entry.contribution_type)) {
        data.monthly = entry.monthly_adviser_assist
          ? { adviser_assist: true }
          : { amount_per_month: parseCurrencyToNumber(entry.monthly_amount) };
      }
      contributionsPayload[typeId] = data;
    });

  return {
    vertical: 'Investment',
    phase: 2,
    selected_types: selectedTypes.map(getLabelForType),
    contributions: contributionsPayload,
    objective: {
      primary_objective:
        OBJECTIVE_OPTIONS.find((o) => o.value === objective.primary_objective)?.label ??
        objective.primary_objective,
      time_horizon:
        TIME_HORIZON_OPTIONS.find((o) => o.value === objective.time_horizon)?.label ??
        objective.time_horizon,
      risk_comfort:
        RISK_COMFORT_OPTIONS.find((o) => o.value === objective.risk_comfort)?.label ??
        objective.risk_comfort,
    },
    financial_snapshot: {
      income_gross_monthly: parseCurrencyToNumber(financial.income_gross_monthly),
      income_net_monthly: parseCurrencyToNumber(financial.income_net_monthly),
      existing_investments: financial.existing_investments || null,
      has_retirement_annuity: financial.has_retirement_annuity,
      tax_bracket:
        INVESTMENT_TAX_BRACKETS.find((o) => o.value === financial.tax_bracket)?.label ?? null,
    },
    metadata: metadata(),
  };
}

// ── Retirement planning (RetirementQuoteWizard.handleSubmit) ───────────────────

export function retirementProductDetails(
  selectedProduct: string,
  raContribution: RAContributionState,
  preservation: PreservationState,
  notSureContext: NotSureState,
  timeline: TimelineState,
  financial: RetirementFinancialState,
) {
  const productLabel =
    PRODUCT_OPTIONS.find((p) => p.id === selectedProduct)?.label ?? selectedProduct;

  let fundingPayload: Record<string, unknown> = {};
  if (selectedProduct === 'ra') {
    const ctLabel =
      RA_CONTRIBUTION_TYPES.find((c) => c.value === raContribution.contribution_type)?.label ??
      raContribution.contribution_type;
    fundingPayload = {
      contribution_type: ctLabel,
      adviser_assist: raContribution.contribution_type === 'not_sure',
    };
    if (retirementNeedsMonthly(raContribution.contribution_type)) {
      fundingPayload.monthly = raContribution.monthly_adviser_assist
        ? { adviser_assist: true }
        : { amount_per_month: parseCurrencyToNumber(raContribution.monthly_amount) };
    }
    if (retirementNeedsLumpSum(raContribution.contribution_type)) {
      fundingPayload.lump_sum = raContribution.lump_sum_adviser_assist
        ? { adviser_assist: true }
        : { amount: parseCurrencyToNumber(raContribution.lump_sum_amount) };
    }
  } else if (
    selectedProduct === 'provident_preservation' ||
    selectedProduct === 'pension_preservation'
  ) {
    fundingPayload = {
      is_transferring: preservation.is_transferring,
      transfer_amount: preservation.transfer_not_sure
        ? null
        : parseCurrencyToNumber(preservation.transfer_amount) || null,
      transfer_not_sure: preservation.transfer_not_sure,
    };
  } else if (selectedProduct === 'not_sure') {
    fundingPayload = {
      currently_employed: notSureContext.currently_employed,
      leaving_employer_fund: notSureContext.leaving_employer_fund,
      want_monthly_contributions: notSureContext.want_monthly_contributions,
    };
  }

  return {
    vertical: 'Retirement',
    phase: 2,
    selected_product: productLabel,
    selected_product_id: selectedProduct,
    funding: fundingPayload,
    timeline: {
      current_age: parseInt(timeline.current_age, 10) || null,
      planned_retirement_age: parseInt(timeline.planned_retirement_age, 10) || null,
      member_of_retirement_fund: timeline.member_of_retirement_fund,
      fund_details: timeline.fund_details || null,
    },
    financial_snapshot: {
      income_gross_monthly: parseCurrencyToNumber(financial.income_gross_monthly),
      income_net_monthly: parseCurrencyToNumber(financial.income_net_monthly),
      current_retirement_savings:
        parseCurrencyToNumber(financial.current_retirement_savings) || null,
      tax_bracket:
        RETIREMENT_TAX_BRACKETS.find((o) => o.value === financial.tax_bracket)?.label ?? null,
    },
    metadata: metadata(),
  };
}

// ── Employee benefits (EmployeeBenefitsQuoteWizard.handleSubmit) ───────────────

export function benefitsProductDetails(
  business: BusinessState,
  benefitType: string,
  budget: BudgetState,
  workforce: WorkforceState,
) {
  const benefitLabel = BENEFIT_TYPE_OPTIONS.find((b) => b.id === benefitType)?.label ?? benefitType;
  const contribLabel =
    CONTRIBUTION_STRUCTURE_OPTIONS.find((c) => c.value === budget.contribution_structure)?.label ??
    budget.contribution_structure;
  const compulsoryLabel =
    COMPULSORY_OPTIONS.find((c) => c.value === budget.compulsory_for_all)?.label ??
    budget.compulsory_for_all;
  const ageBandLabel =
    AGE_BAND_OPTIONS.find((a) => a.value === workforce.average_age_band)?.label ??
    workforce.average_age_band;
  const workforceTypeLabel =
    WORKFORCE_TYPE_OPTIONS.find((w) => w.value === workforce.workforce_type)?.label ??
    workforce.workforce_type;
  const empCountLabel =
    EMPLOYEE_COUNT_OPTIONS.find((e) => e.value === business.employee_count)?.label ??
    business.employee_count;

  return {
    vertical: 'EmployeeBenefits',
    phase: 2,
    business: {
      company_name: business.company_name.trim(),
      trading_name: business.trading_name.trim() || null,
      industry_sector: business.industry_sector,
      employee_count: empCountLabel,
      employee_count_id: business.employee_count,
      province: business.province,
    },
    benefit_type: benefitLabel,
    benefit_type_id: benefitType,
    budget: {
      monthly_budget: budget.budget_adviser_assist
        ? null
        : parseCurrencyToNumber(budget.monthly_budget),
      budget_adviser_assist: budget.budget_adviser_assist,
      contribution_structure: contribLabel,
      contribution_structure_id: budget.contribution_structure,
      compulsory_for_all: compulsoryLabel,
      compulsory_for_all_id: budget.compulsory_for_all,
    },
    workforce: {
      average_age_band: ageBandLabel,
      average_age_band_id: workforce.average_age_band,
      workforce_type: workforceTypeLabel,
      workforce_type_id: workforce.workforce_type,
      has_existing_benefits: workforce.has_existing_benefits,
      existing_benefits_description: workforce.existing_benefits_description.trim() || null,
    },
    metadata: metadata(),
  };
}

// ── Tax planning (TaxPlanningQuoteWizard.handleSubmit) ─────────────────────────

export function taxProductDetails(
  selectedTypes: string[],
  taxpayerContext: TaxpayerContextState,
  financialScope: FinancialScopeState,
) {
  const typeLabels = selectedTypes.map(
    (id) => TAX_TYPE_OPTIONS.find((t) => t.id === id)?.label ?? id,
  );

  return {
    vertical: 'TaxPlanning',
    phase: 2,
    selected_types: typeLabels,
    selected_type_ids: selectedTypes,
    taxpayer_context: {
      taxpayer_type: lookupLabel(TAXPAYER_TYPE_OPTIONS, taxpayerContext.taxpayer_type),
      taxpayer_type_id: taxpayerContext.taxpayer_type,
      sars_registered: ynsLabel(taxpayerContext.sars_registered),
      sars_registered_id: taxpayerContext.sars_registered,
      submission_status: lookupLabel(SUBMISSION_STATUS_OPTIONS, taxpayerContext.submission_status),
      submission_status_id: taxpayerContext.submission_status,
      tax_years: lookupLabel(TAX_YEAR_OPTIONS, taxpayerContext.tax_years),
      tax_years_id: taxpayerContext.tax_years,
    },
    financial_scope: {
      turnover_band: lookupLabel(TURNOVER_BAND_OPTIONS, financialScope.turnover_band),
      turnover_band_id: financialScope.turnover_band,
      has_foreign_income: ynsLabel(financialScope.has_foreign_income),
      under_sars_audit: ynsLabel(financialScope.under_sars_audit),
      has_penalties: ynsLabel(financialScope.has_penalties),
      has_penalties_id: financialScope.has_penalties,
    },
    metadata: metadata(),
  };
}

// ── Presentation helpers ──────────────────────────────────────────────────────

/** The live models write a dash as " -- "; the board sets it as an em dash. */
export function dash(text: string): string {
  return text.replace(/ -- /g, ' — ');
}

/** A yes-or-no question's answers, as the live wizards list them. */
export const YES_NO_BOOL = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
] as const;
