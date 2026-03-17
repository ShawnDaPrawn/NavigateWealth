import { RoAModule } from './DraftRoAInterface';

export const ROA_MODULE_SCHEMAS: Record<string, RoAModule> = {
  medical_aid: {
    id: 'medical_aid',
    title: 'Medical Aid Proposal',
    description: 'New medical aid proposal or scheme changes',
    fields: [
      {
        key: 'current_scheme',
        label: 'Current Medical Scheme',
        type: 'text',
        required: false,
        placeholder: 'e.g., Discovery Health Medical Scheme'
      },
      {
        key: 'current_option',
        label: 'Current Option',
        type: 'text',
        required: false,
        placeholder: 'e.g., Comprehensive Cover'
      },
      {
        key: 'proposed_scheme',
        label: 'Proposed Medical Scheme',
        type: 'select',
        required: true,
        options: ['Discovery Health', 'Momentum Health', 'Bonitas', 'Medihelp', 'Genesis', 'Other']
      },
      {
        key: 'proposed_option',
        label: 'Proposed Option',
        type: 'text',
        required: true,
        placeholder: 'e.g., Smart Comprehensive'
      },
      {
        key: 'monthly_premium',
        label: 'Monthly Premium (R)',
        type: 'number',
        required: true
      },
      {
        key: 'rationale',
        label: 'Rationale for Change',
        type: 'textarea',
        required: true,
        placeholder: 'Explain benefits, cost savings, better coverage, etc.'
      },
      {
        key: 'waiting_periods',
        label: 'Waiting Periods',
        type: 'textarea',
        required: false,
        placeholder: 'Detail any applicable waiting periods'
      }
    ],
    disclosures: [
      'Medical scheme membership is subject to the scheme rules and the Medical Schemes Act.',
      'Waiting periods may apply for certain benefits.',
      'Late joiner penalties may apply if you have not maintained continuous medical scheme cover.',
      'Benefits are subject to annual limits and sub-limits as per the scheme rules.'
    ],
    compileOrder: ['current_situation', 'proposal', 'rationale', 'costs', 'disclosures']
  },

  life_recosting: {
    id: 'life_recosting',
    title: 'Life Cover Re-costing / Restructure',
    description: 'Life insurance restructuring or re-costing analysis',
    fields: [
      {
        key: 'current_providers',
        label: 'Current Life Insurance Providers',
        type: 'chips',
        required: true
      },
      {
        key: 'current_cover_amount',
        label: 'Current Total Cover Amount (R)',
        type: 'number',
        required: true
      },
      {
        key: 'current_premiums',
        label: 'Current Monthly Premiums (R)',
        type: 'number',
        required: true
      },
      {
        key: 'proposed_provider',
        label: 'Proposed Provider',
        type: 'select',
        required: true,
        options: ['Discovery Life', 'Momentum Life', 'Sanlam Life', 'Old Mutual Life', 'Hollard Life', 'Other']
      },
      {
        key: 'proposed_cover_amount',
        label: 'Proposed Cover Amount (R)',
        type: 'number',
        required: true
      },
      {
        key: 'proposed_premiums',
        label: 'Proposed Monthly Premiums (R)',
        type: 'number',
        required: true
      },
      {
        key: 'cost_savings',
        label: 'Monthly Cost Savings (R)',
        type: 'number',
        required: false
      },
      {
        key: 'rationale',
        label: 'Rationale for Change',
        type: 'textarea',
        required: true,
        placeholder: 'Cost savings, better benefits, improved underwriting, etc.'
      },
      {
        key: 'underwriting_notes',
        label: 'Underwriting Considerations',
        type: 'textarea',
        required: false,
        placeholder: 'Health changes, age factors, exclusions, etc.'
      }
    ],
    disclosures: [
      'Life insurance is subject to underwriting and acceptance by the insurer.',
      'Existing policies should not be cancelled until new cover is confirmed and in force.',
      'Suicide exclusions typically apply for the first two years of a new policy.',
      'Premium increases may occur annually based on age and insurer rate adjustments.'
    ],
    compileOrder: ['current_situation', 'proposal', 'cost_analysis', 'rationale', 'disclosures']
  },

  severe_illness: {
    id: 'severe_illness',
    title: 'Severe Illness (Critical Illness)',
    description: 'Critical illness insurance proposal',
    fields: [
      {
        key: 'cover_amount',
        label: 'Cover Amount (R)',
        type: 'number',
        required: true
      },
      {
        key: 'provider',
        label: 'Recommended Provider',
        type: 'select',
        required: true,
        options: ['Discovery Life', 'Momentum Life', 'Sanlam Life', 'Old Mutual Life', 'Hollard Life', 'Other']
      },
      {
        key: 'monthly_premium',
        label: 'Monthly Premium (R)',
        type: 'number',
        required: true
      },
      {
        key: 'conditions_covered',
        label: 'Key Conditions Covered',
        type: 'textarea',
        required: true,
        placeholder: 'List major conditions covered (cancer, heart attack, stroke, etc.)'
      },
      {
        key: 'benefit_structure',
        label: 'Benefit Structure',
        type: 'select',
        required: true,
        options: ['Lump Sum', 'Staged Benefits', 'Combination']
      },
      {
        key: 'rationale',
        label: 'Rationale',
        type: 'textarea',
        required: true,
        placeholder: 'Why this cover is needed and appropriate'
      }
    ],
    disclosures: [
      'Critical illness benefits are paid upon diagnosis of covered conditions as defined in the policy.',
      'Survival periods may apply for certain conditions.',
      'Pre-existing medical conditions are typically excluded.',
      'The policy definitions of critical illnesses must be met for claims to be paid.'
    ],
    compileOrder: ['cover_details', 'rationale', 'benefits', 'disclosures']
  },

  income_protection: {
    id: 'income_protection',
    title: 'Income Protection',
    description: 'Disability and income protection insurance',
    fields: [
      {
        key: 'monthly_benefit',
        label: 'Monthly Benefit Amount (R)',
        type: 'number',
        required: true
      },
      {
        key: 'current_income',
        label: 'Current Monthly Income (R)',
        type: 'number',
        required: true
      },
      {
        key: 'replacement_ratio',
        label: 'Income Replacement Ratio (%)',
        type: 'number',
        required: true
      },
      {
        key: 'waiting_period',
        label: 'Waiting Period',
        type: 'select',
        required: true,
        options: ['1 month', '3 months', '6 months', '12 months']
      },
      {
        key: 'benefit_period',
        label: 'Benefit Period',
        type: 'select',
        required: true,
        options: ['2 years', '5 years', 'To age 65', 'To age 70']
      },
      {
        key: 'occupation_class',
        label: 'Occupation Class',
        type: 'select',
        required: true,
        options: ['Professional/White Collar', 'Skilled Manual', 'Unskilled Manual', 'High Risk']
      },
      {
        key: 'provider',
        label: 'Recommended Provider',
        type: 'select',
        required: true,
        options: ['Discovery Life', 'Momentum Life', 'Sanlam Life', 'Old Mutual Life', 'Hollard Life', 'Other']
      },
      {
        key: 'monthly_premium',
        label: 'Monthly Premium (R)',
        type: 'number',
        required: true
      }
    ],
    disclosures: [
      'Income protection benefits are paid during periods of disability as defined in the policy.',
      'Benefits are typically subject to monthly proof of disability.',
      'Pre-existing medical conditions and disabilities are excluded.',
      'Benefits may be reduced by other disability income sources.'
    ],
    compileOrder: ['cover_details', 'suitability', 'costs', 'disclosures']
  },

  retirement_annuity_section14: {
    id: 'retirement_annuity_section14',
    title: 'Retirement Annuity Proposal & Section 14 Transfer',
    description: 'RA proposal and Section 14 transfer analysis',
    fields: [
      {
        key: 'current_providers',
        label: 'Current RA Providers',
        type: 'chips',
        required: true
      },
      {
        key: 'transfer_targets',
        label: 'Transfer To',
        type: 'select',
        required: true,
        options: ['Sygnia', 'Allan Gray', 'Coronation', 'Momentum', 'Discovery', 'Old Mutual', 'Other']
      },
      {
        key: 'transfer_amount',
        label: 'Transfer Amount (R)',
        type: 'number',
        required: true
      },
      {
        key: 'rationale',
        label: 'Rationale (fees/performance/process)',
        type: 'textarea',
        required: true,
        placeholder: 'Explain rationale for transfer - fees, performance, investment process, etc.'
      },
      {
        key: 'fees_current_eac',
        label: 'Current EAC (%)',
        type: 'number',
        required: false
      },
      {
        key: 'fees_target_eac',
        label: 'Target EAC (%)',
        type: 'number',
        required: false
      },
      {
        key: 'annual_fee_saving',
        label: 'Annual Fee Saving (R)',
        type: 'number',
        required: false
      },
      {
        key: 'disclosure_penalties',
        label: 'Penalties / Paybacks (notes)',
        type: 'textarea',
        placeholder: 'Detail any penalties, paybacks, or market value adjustments'
      },
      {
        key: 'tax_note',
        label: 'Tax Note',
        type: 'textarea',
        default: 'Section 14 transfers are tax-neutral within approved funds.'
      }
    ],
    disclosures: [
      'Section 14 transfers are tax-neutral; timelines ~4–8 weeks; short out-of-market periods may occur.',
      'Potential forfeiture of loyalty/fee paybacks or termination fees from ceding products.',
      'Past performance not indicative of future results; Reg 28 limits apply.',
      'Market value adjustments may apply if underlying funds have declined in value.'
    ],
    compileOrder: ['context', 'rationale', 'fees', 'process', 'disclosures']
  },

  investment_offshore_allangray: {
    id: 'investment_offshore_allangray',
    title: 'Investment Proposal (Local/Offshore)',
    description: 'Investment portfolio proposal including offshore allocation',
    fields: [
      {
        key: 'investment_amount',
        label: 'Total Investment Amount (R)',
        type: 'number',
        required: true
      },
      {
        key: 'local_allocation',
        label: 'Local Allocation (%)',
        type: 'number',
        required: true
      },
      {
        key: 'offshore_allocation',
        label: 'Offshore Allocation (%)',
        type: 'number',
        required: true
      },
      {
        key: 'investment_platform',
        label: 'Investment Platform',
        type: 'select',
        required: true,
        options: ['Allan Gray', 'Coronation', 'Sygnia', 'Momentum', 'Discovery', 'Multi-manager platform', 'Other']
      },
      {
        key: 'fund_selection',
        label: 'Recommended Funds',
        type: 'textarea',
        required: true,
        placeholder: 'List specific funds and allocation percentages'
      },
      {
        key: 'risk_profile',
        label: 'Client Risk Profile',
        type: 'select',
        required: true,
        options: ['Conservative', 'Moderate Conservative', 'Moderate', 'Moderate Aggressive', 'Aggressive']
      },
      {
        key: 'investment_objective',
        label: 'Investment Objective',
        type: 'textarea',
        required: true,
        placeholder: 'Capital growth, income generation, inflation protection, etc.'
      },
      {
        key: 'time_horizon',
        label: 'Investment Time Horizon',
        type: 'select',
        required: true,
        options: ['Less than 2 years', '2-5 years', '5-10 years', 'More than 10 years']
      },
      {
        key: 'total_fees',
        label: 'Total Annual Fees (%)',
        type: 'number',
        required: true
      }
    ],
    disclosures: [
      'Investments are subject to market risk and values may fluctuate.',
      'Past performance is not indicative of future results.',
      'Offshore investments are subject to currency risk.',
      'All fees include management fees, administration fees, and performance fees where applicable.',
      'The offshore investment allowance is subject to SARB and SARS regulations.'
    ],
    compileOrder: ['investment_details', 'suitability', 'fees', 'risks', 'disclosures']
  },

  estate_planning_will: {
    id: 'estate_planning_will',
    title: 'Estate Planning (Will Review/Redraft)',
    description: 'Comprehensive estate planning and will drafting',
    fields: [
      {
        key: 'current_will_status',
        label: 'Current Will Status',
        type: 'select',
        required: true,
        options: ['No will exists', 'Outdated will', 'Recent will but changes needed', 'Current will - review only']
      },
      {
        key: 'estate_value',
        label: 'Estimated Estate Value (R)',
        type: 'number',
        required: true
      },
      {
        key: 'beneficiaries',
        label: 'Primary Beneficiaries',
        type: 'textarea',
        required: true,
        placeholder: 'List beneficiaries and proposed allocations'
      },
      {
        key: 'executor_appointment',
        label: 'Executor Appointment',
        type: 'select',
        required: true,
        options: ['Family member', 'Professional executor', 'Trust company', 'Navigate Wealth will assist']
      },
      {
        key: 'minor_children',
        label: 'Minor Children Provisions',
        type: 'textarea',
        required: false,
        placeholder: 'Guardianship and trust arrangements for minor children'
      },
      {
        key: 'tax_planning',
        label: 'Estate Duty Planning',
        type: 'textarea',
        required: false,
        placeholder: 'Strategies to minimize estate duty and costs'
      },
      {
        key: 'liquidity_planning',
        label: 'Liquidity Planning',
        type: 'textarea',
        required: false,
        placeholder: 'Provisions for estate liquidity and expense coverage'
      },
      {
        key: 'special_instructions',
        label: 'Special Instructions',
        type: 'textarea',
        required: false,
        placeholder: 'Any specific bequests, conditions, or instructions'
      }
    ],
    disclosures: [
      'Wills must comply with the Wills Act 7 of 1953 and subsequent amendments.',
      'Estate duty may be payable on estates exceeding R3.5 million (2024 threshold).',
      'Executor fees are typically 3.5% of gross estate value plus VAT.',
      'This advice should be implemented in consultation with qualified legal professionals.',
      'Regular will reviews are recommended, especially after major life events.'
    ],
    compileOrder: ['current_situation', 'recommendations', 'tax_planning', 'implementation', 'disclosures']
  }
};

export const getModuleSchema = (moduleId: string): RoAModule | undefined => {
  return ROA_MODULE_SCHEMAS[moduleId];
};

export const getAllModules = (): RoAModule[] => {
  return Object.values(ROA_MODULE_SCHEMAS);
};