import type { RoAModuleContract } from './types';

const FALLBACK_TIMESTAMP = '2026-05-04T00:00:00.000Z';
const FALLBACK_USER = 'system:frontend-roa-contract-seed';

type FieldSeed = RoAModuleContract['formSchema']['sections'][number]['fields'][number];

type DocumentSectionSeed =
  Omit<RoAModuleContract['documentSections'][number], 'template'> & { template?: string };

interface ContractSeed {
  id: string;
  title: string;
  description: string;
  category: string;
  normalizedKey: string;
  fields: FieldSeed[];
  evidence: RoAModuleContract['evidence']['requirements'];
  documentSections: DocumentSectionSeed[];
  disclosures: string[];
  compilerHints?: RoAModuleContract['compilerHints'];
  metadata?: Record<string, unknown>;
}

function contract(seed: ContractSeed): RoAModuleContract {
  const requiredFields = seed.fields.filter((field) => field.required).map((field) => field.key);
  return {
    id: seed.id,
    title: seed.title,
    description: seed.description,
    category: seed.category,
    status: 'active',
    version: 1,
    schemaVersion: '1.0',
    input: {
      sources: [
        {
          id: 'client_profile',
          label: 'Client profile and personal details',
          type: 'clientSnapshot',
          required: true,
          sourcePath: 'draft.clientSnapshot',
        },
        {
          id: 'adviser_profile',
          label: 'Adviser profile',
          type: 'adviserSnapshot',
          required: true,
          sourcePath: 'draft.adviserSnapshot',
        },
      ],
      gatheringMethods: ['clientProfile', 'typed', 'upload'],
    },
    formSchema: {
      sections: [{ id: 'details', title: 'Details', fields: seed.fields }],
    },
    output: {
      normalizedKey: seed.normalizedKey,
      fields: requiredFields.map((key) => ({
        key,
        label: seed.fields.find((field) => field.key === key)?.label || key,
        type: 'string',
        required: true,
      })),
    },
    validation: {
      requiredFields,
      rules: requiredFields.map((key) => ({
        id: `${key}_required`,
        severity: 'blocking',
        message: `${seed.fields.find((field) => field.key === key)?.label || key} is required.`,
        fieldKeys: [key],
      })),
    },
    evidence: { requirements: seed.evidence },
    documentSections: seed.documentSections.map((section) => ({
      ...section,
      template: section.template || `## ${section.title}\n${section.purpose}\n\n{{module.rationale}}`,
    })),
    disclosures: seed.disclosures,
    compileOrder: [...seed.documentSections].sort((a, b) => a.order - b.order).map((section) => section.id),
    ...(seed.compilerHints ? { compilerHints: seed.compilerHints } : {}),
    metadata: { ...(seed.metadata || {}), fallbackSeed: true },
    createdAt: FALLBACK_TIMESTAMP,
    updatedAt: FALLBACK_TIMESTAMP,
    createdBy: FALLBACK_USER,
    updatedBy: FALLBACK_USER,
    publishedAt: FALLBACK_TIMESTAMP,
  };
}

export const FALLBACK_ROA_MODULE_CONTRACTS: RoAModuleContract[] = [
  contract({
    id: 'new_life_assurance_proposal',
    title: 'New Life Assurance Proposal',
    description: 'Recommends new life assurance cover based on client needs, affordability and suitability.',
    category: 'Risk Management',
    normalizedKey: 'lifeAssuranceProposal',
    fields: [
      { key: 'provider', label: 'Recommended Provider', type: 'select', required: true, source: 'moduleInput', options: ['Discovery Life', 'Momentum Life', 'Sanlam Life', 'Old Mutual Life', 'Hollard Life', 'Other'] },
      { key: 'cover_amount', label: 'Recommended Cover Amount', type: 'currency', required: true, source: 'moduleInput' },
      { key: 'monthly_premium', label: 'Monthly Premium', type: 'currency', required: true, source: 'moduleInput' },
      { key: 'benefit_types', label: 'Benefit Types', type: 'chips', required: true, source: 'moduleInput' },
      { key: 'rationale', label: 'Rationale', type: 'textarea', required: true, source: 'moduleInput' },
      { key: 'underwriting_notes', label: 'Underwriting Notes', type: 'textarea', source: 'moduleInput' },
    ],
    evidence: [{ id: 'provider_quote', label: 'Provider quote', type: 'quote', required: true, acceptedMimeTypes: ['application/pdf'] }],
    documentSections: [
      { id: 'need', title: 'Identified Need', purpose: 'Explain the cover need and quantified shortfall.', order: 10, required: true },
      { id: 'recommendation', title: 'Recommendation', purpose: 'Describe recommended cover, provider and premium.', order: 20, required: true },
      { id: 'risks', title: 'Risks and Underwriting', purpose: 'Record underwriting, exclusions and replacement cautions.', order: 30, required: true },
    ],
    disclosures: [
      'Life assurance is subject to underwriting and acceptance by the insurer.',
      'Existing cover should remain in force until replacement or new cover is confirmed.',
    ],
  }),
  contract({
    id: 'life_insurance_comparison',
    title: 'Life Insurance Comparison',
    description:
      'Flagship replacement/comparison module: aligns current versus proposed risk cover, premiums and benefits with FAIS-aligned disclosures and evidence of schedules.',
    category: 'Risk Management',
    normalizedKey: 'lifeInsuranceComparison',
    metadata: {
      flagshipModule: true,
      moduleExcellenceTarget: 'life_insurance_comparison',
      complianceNotes:
        'Use for like-for-life comparisons only when schedules and quotes are attached. Do not cancel in-force contracts until replacements are confirmed in writing.',
    },
    fields: [
      { key: 'current_providers', label: 'Current Providers', type: 'chips', required: true, source: 'policyRegister' },
      { key: 'current_monthly_premium', label: 'Current Monthly Premium', type: 'currency', required: true, source: 'moduleInput' },
      {
        key: 'proposed_provider',
        label: 'Proposed Provider',
        type: 'select',
        required: true,
        source: 'moduleInput',
        options: ['Discovery Life', 'Momentum Life', 'Sanlam Life', 'Old Mutual Life', 'Hollard Life', 'Other'],
      },
      { key: 'proposed_monthly_premium', label: 'Proposed Monthly Premium', type: 'currency', required: true, source: 'moduleInput' },
      { key: 'benefit_comparison', label: 'Benefit Comparison', type: 'textarea', required: true, source: 'moduleInput' },
      { key: 'replacement_rationale', label: 'Replacement Rationale', type: 'textarea', required: true, source: 'moduleInput' },
    ],
    evidence: [
      {
        id: 'current_policy_schedule',
        label: 'Current policy schedule',
        type: 'policy_schedule',
        required: true,
        acceptedMimeTypes: ['application/pdf'],
        guidance: 'Latest insurer-issued schedule showing benefits, exclusions, premiums and inception dates.',
      },
      {
        id: 'comparison_schedule',
        label: 'Comparison schedule',
        type: 'comparison',
        required: true,
        acceptedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        guidance: 'Like-for-like or justified comparison worksheet signed by the adviser.',
      },
    ],
    documentSections: [
      {
        id: 'current_position',
        title: 'Current Insurance Position',
        purpose: 'Summarise current cover and premiums.',
        order: 10,
        required: true,
        template: [
          '{{client.displayName}} — adviser {{adviser.displayName}}',
          '',
          '## Current insurance position',
          '',
          '- Current cover providers / contracts recorded: {{module.current_providers}}',
          '- Current monthly premium (indicative): {{module.current_monthly_premium | currency}}',
          '- Schedule on file: {{evidence.current_policy_schedule.fileName}}',
          '',
          'Adviser confirms the schedule was reviewed against the illustration used for comparison.',
        ].join('\n'),
      },
      {
        id: 'comparison',
        title: 'Premium and benefit comparison',
        purpose: 'Compare current and proposed arrangements.',
        order: 20,
        required: true,
        template: [
          '## Comparison overview',
          '',
          '- Proposed insurer: {{module.proposed_provider}}',
          '- Proposed monthly premium (illustrative): {{module.proposed_monthly_premium | currency}}',
          '- Comparison workbook / quote on file: {{evidence.comparison_schedule.fileName}}',
          '',
          '{{module.benefit_comparison}}',
        ].join('\n'),
      },
      {
        id: 'replacement_considerations',
        title: 'Replacement suitability and rationale',
        purpose: 'Explain advantages, disadvantages and risks.',
        order: 30,
        required: true,
        template: [
          '## Replacement rationale and risks',
          '',
          '{{module.replacement_rationale}}',
          '',
          'The client was informed that illustrations are not guarantees and that final contractual wording on the issued policy determines cover.',
          '',
          'Supporting schedules referenced above must be retained on file for supervisory review.',
        ].join('\n'),
      },
    ],
    disclosures: [
      'Replacement of existing life policies may cause loss of benefits already accrued, underwriting concessions, cashback obligations or premium discounts.',
      'Premium rates can change after underwriting and quoted premiums are illustrative until accepted by the insurer.',
      'Clients must not cancel or lapse existing cover until written confirmation that replacement benefits are active and comparable gaps are understood.',
      'Commission, adviser remuneration and recurring policy charges must match the disclosure on the provider documentation and must be explained to the client.',
      'Navigate Wealth records this advice in line with FAIS requirements; clients may request further written particulars at any time.',
    ],
    compilerHints: { includeReplacementAnalysis: true },
  }),
  contract({
    id: 'new_investment_proposal',
    title: 'New Investment Proposal',
    description: 'Recommends a new investment based on objectives, time horizon, risk profile, costs and suitability.',
    category: 'Investments',
    normalizedKey: 'newInvestmentProposal',
    fields: [
      { key: 'investment_amount', label: 'Investment Amount', type: 'currency', required: true, source: 'moduleInput' },
      { key: 'platform', label: 'Investment Platform', type: 'text', required: true, source: 'moduleInput' },
      { key: 'recommended_funds', label: 'Recommended Funds', type: 'textarea', required: true, source: 'moduleInput' },
      { key: 'risk_profile', label: 'Risk Profile', type: 'select', required: true, source: 'clientSnapshot', options: ['Conservative', 'Moderate Conservative', 'Moderate', 'Moderate Aggressive', 'Aggressive'] },
      { key: 'time_horizon', label: 'Time Horizon', type: 'select', required: true, source: 'moduleInput', options: ['Less than 2 years', '2-5 years', '5-10 years', 'More than 10 years'] },
      { key: 'total_annual_fee', label: 'Total Annual Fee', type: 'percentage', required: true, source: 'moduleInput' },
      { key: 'rationale', label: 'Rationale', type: 'textarea', required: true, source: 'moduleInput' },
    ],
    evidence: [{ id: 'investment_proposal', label: 'Investment proposal or fund fact sheets', type: 'comparison', required: true, acceptedMimeTypes: ['application/pdf'] }],
    documentSections: [
      { id: 'objectives', title: 'Objectives and Time Horizon', purpose: 'Record objectives, investment term and liquidity needs.', order: 10, required: true },
      { id: 'recommendation', title: 'Investment Recommendation', purpose: 'Explain product, platform, funds and allocation.', order: 20, required: true },
      { id: 'fees_risks', title: 'Fees and Investment Risks', purpose: 'Disclose costs, volatility, currency and market risks.', order: 30, required: true },
    ],
    disclosures: [
      'Investment values can rise and fall and past performance is not a reliable guide to future returns.',
      'Fees, taxes and currency movements can materially affect investment outcomes.',
    ],
  }),
  contract({
    id: 'investment_replacement_proposal',
    title: 'Investment Replacement Proposal',
    description: 'Documents replacement or transfer of an existing investment, including costs, benefits and disadvantages.',
    category: 'Investments',
    normalizedKey: 'investmentReplacementProposal',
    fields: [
      { key: 'current_provider', label: 'Current Provider', type: 'text', required: true, source: 'policyRegister' },
      { key: 'current_value', label: 'Current Value', type: 'currency', required: true, source: 'moduleInput' },
      { key: 'proposed_provider', label: 'Proposed Provider', type: 'text', required: true, source: 'moduleInput' },
      { key: 'exit_penalties', label: 'Exit Penalties or Market Adjustments', type: 'currency', source: 'moduleInput' },
      { key: 'replacement_rationale', label: 'Replacement Rationale', type: 'textarea', required: true, source: 'moduleInput' },
      { key: 'disadvantages', label: 'Disadvantages and Risks', type: 'textarea', required: true, source: 'moduleInput' },
    ],
    evidence: [
      { id: 'current_statement', label: 'Current investment statement', type: 'policy_schedule', required: true, acceptedMimeTypes: ['application/pdf'] },
      { id: 'replacement_analysis', label: 'Replacement analysis', type: 'comparison', required: true, acceptedMimeTypes: ['application/pdf'] },
    ],
    documentSections: [
      { id: 'current_position', title: 'Current Investment Position', purpose: 'Summarise the existing investment.', order: 10, required: true },
      { id: 'replacement_analysis', title: 'Replacement Analysis', purpose: 'Compare current and proposed investments.', order: 20, required: true },
      { id: 'recommendation', title: 'Recommendation and Rationale', purpose: 'Explain why replacement is suitable.', order: 30, required: true },
    ],
    disclosures: [
      'Replacement may trigger fees, penalties, tax consequences or temporary out-of-market exposure.',
      'The client must understand both the advantages and disadvantages before implementation.',
    ],
    compilerHints: { includeReplacementAnalysis: true },
  }),
  contract({
    id: 'new_retirement_proposal',
    title: 'New Retirement Proposal',
    description: 'Recommends a new retirement product or contribution strategy based on retirement objectives.',
    category: 'Retirement',
    normalizedKey: 'newRetirementProposal',
    fields: [
      { key: 'product_type', label: 'Product Type', type: 'select', required: true, source: 'moduleInput', options: ['Retirement Annuity', 'Preservation Fund', 'Living Annuity', 'Life Annuity', 'Other'] },
      { key: 'provider', label: 'Provider', type: 'text', required: true, source: 'moduleInput' },
      { key: 'monthly_contribution', label: 'Monthly Contribution', type: 'currency', source: 'moduleInput' },
      { key: 'lump_sum', label: 'Lump Sum', type: 'currency', source: 'moduleInput' },
      { key: 'retirement_age', label: 'Target Retirement Age', type: 'number', required: true, source: 'moduleInput' },
      { key: 'investment_strategy', label: 'Investment Strategy', type: 'textarea', required: true, source: 'moduleInput' },
      { key: 'rationale', label: 'Rationale', type: 'textarea', required: true, source: 'moduleInput' },
    ],
    evidence: [{ id: 'retirement_quote', label: 'Retirement product quote', type: 'quote', required: true, acceptedMimeTypes: ['application/pdf'] }],
    documentSections: [
      { id: 'retirement_need', title: 'Retirement Need', purpose: 'Summarise retirement objective and shortfall.', order: 10, required: true },
      { id: 'recommendation', title: 'Retirement Recommendation', purpose: 'Explain product, provider and contribution strategy.', order: 20, required: true },
      { id: 'tax_fees_risks', title: 'Tax, Fees and Risks', purpose: 'Disclose tax treatment, Regulation 28, fees and risk.', order: 30, required: true },
    ],
    disclosures: [
      'Retirement products are subject to fund rules, Regulation 28 and applicable tax legislation.',
      'Investment performance is not guaranteed unless specifically stated by the product provider.',
    ],
  }),
  contract({
    id: 'section_14_transfer_proposal',
    title: 'Section 14 Proposal',
    description: 'Documents a Section 14 retirement fund transfer, including ceding and receiving funds, costs and process.',
    category: 'Retirement',
    normalizedKey: 'section14TransferProposal',
    fields: [
      { key: 'ceding_provider', label: 'Ceding Provider/Fund', type: 'text', required: true, source: 'policyRegister' },
      { key: 'receiving_provider', label: 'Receiving Provider/Fund', type: 'text', required: true, source: 'moduleInput' },
      { key: 'transfer_amount', label: 'Transfer Amount', type: 'currency', required: true, source: 'moduleInput' },
      { key: 'current_eac', label: 'Current EAC', type: 'percentage', source: 'moduleInput' },
      { key: 'receiving_eac', label: 'Receiving EAC', type: 'percentage', source: 'moduleInput' },
      { key: 'penalties', label: 'Penalties, Paybacks or Adjustments', type: 'textarea', source: 'moduleInput' },
      { key: 'rationale', label: 'Transfer Rationale', type: 'textarea', required: true, source: 'moduleInput' },
    ],
    evidence: [
      { id: 'current_statement', label: 'Current retirement statement', type: 'policy_schedule', required: true, acceptedMimeTypes: ['application/pdf'] },
      { id: 'transfer_form', label: 'Section 14 transfer/application form', type: 'application', required: true, acceptedMimeTypes: ['application/pdf'] },
    ],
    documentSections: [
      { id: 'current_fund', title: 'Current Retirement Fund', purpose: 'Summarise the ceding fund and current position.', order: 10, required: true },
      { id: 'receiving_fund', title: 'Receiving Fund Recommendation', purpose: 'Explain receiving fund and investment strategy.', order: 20, required: true },
      { id: 'transfer_considerations', title: 'Transfer Considerations', purpose: 'Record fees, risks, timelines and disadvantages.', order: 30, required: true },
    ],
    disclosures: [
      'Section 14 transfers are subject to fund administrator and regulatory processing requirements.',
      'The transfer may include delays, out-of-market periods, penalties or loss of product-specific benefits.',
    ],
    compilerHints: { includeReplacementAnalysis: true },
  }),
];
