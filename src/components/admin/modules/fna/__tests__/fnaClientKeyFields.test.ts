/**
 * Every client key an FNA's Step 1 is offered lands on a field that form has.
 *
 * A mapping for a missing field shows the adviser a match in the review and
 * then silently drops it on apply — which is how five dead mappings went
 * unnoticed. The field lists below are type-checked against each form's own
 * input type, so they cannot claim a field the form does not have either.
 */
import { describe, expect, it } from 'vitest';
import { FORM_FIELD_REGISTRY } from '@/shared/form-prefill/form-field-registry';
import type { FormPrefillId } from '@/shared/form-prefill/types';
import { DEFAULT_FORM_VALUES as RISK_FORM_DEFAULTS } from '../../risk-planning-fna/constants';
import { MedicalFNAInputSchema } from '../../medical-fna/schema';
import type { RetirementFNAInputs } from '../../retirement-fna/types';
import type { TaxPlanningInputs } from '../../tax-planning-fna/types';
import type { InvestmentINAInputs } from '../../investment-ina/types';
import type { FamilyInformation } from '../../estate-planning-fna/types';

const RETIREMENT_FIELDS = [
  'currentAge',
  'retirementAge',
  'currentMonthlyIncome',
  'currentMonthlyContribution',
  'currentRetirementSavings',
] as const satisfies readonly (keyof RetirementFNAInputs)[];

const TAX_FIELDS = [
  'age',
  'maritalStatus',
  'numberOfDependants',
  'employmentIncome',
  'medicalSchemeMembers',
] as const satisfies readonly (keyof TaxPlanningInputs)[];

const INA_FIELDS = [
  'currentAge',
  'dateOfBirth',
  'grossMonthlyIncome',
  'netMonthlyIncome',
  'householdDependants',
  'clientRiskProfile',
] as const satisfies readonly (keyof InvestmentINAInputs)[];

const ESTATE_FIELDS = [
  'familyInfo.fullName',
  'familyInfo.dateOfBirth',
  'familyInfo.age',
  'familyInfo.maritalStatus',
  'familyInfo.spouseName',
] as const satisfies readonly `familyInfo.${keyof FamilyInformation}`[];

const FORM_FIELDS: Record<FormPrefillId, readonly string[]> = {
  'risk-fna-step1': Object.keys(RISK_FORM_DEFAULTS),
  'medical-fna-step1': Object.keys(MedicalFNAInputSchema.shape),
  'retirement-fna-step1': RETIREMENT_FIELDS,
  'tax-fna-step1': TAX_FIELDS,
  'investment-ina-step1': INA_FIELDS,
  'estate-fna-step1': ESTATE_FIELDS,
};

describe('FNA client key mappings', () => {
  it.each(Object.keys(FORM_FIELD_REGISTRY) as FormPrefillId[])(
    '%s maps only fields its Step 1 has',
    (formId) => {
      const missing = FORM_FIELD_REGISTRY[formId]
        .map((m) => m.formField)
        .filter((field) => !FORM_FIELDS[formId].includes(field));
      expect(missing).toEqual([]);
    },
  );
});
