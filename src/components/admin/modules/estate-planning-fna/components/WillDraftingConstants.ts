/**
 * Will Drafting Wizard — Constants
 * Label maps and configuration extracted from WillDraftingWizard.tsx (Guidelines S5.3)
 */

export const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_cop: 'Married in Community of Property',
  married_anc: 'Married ANC with Accrual',
  married_customary: 'Married under Customary Law',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

export const TREATMENT_LABELS: Record<string, string> = {
  ventilator: 'Mechanical Ventilation',
  cpr: 'Cardiopulmonary Resuscitation (CPR)',
  artificialNutrition: 'Artificial Nutrition & Hydration',
  dialysis: 'Dialysis',
  antibiotics: 'Antibiotics',
};

export const TREATMENT_OPTION_LABELS: Record<string, string> = {
  accept: 'Accept',
  refuse: 'Refuse',
  limited: 'Limited Trial',
};
