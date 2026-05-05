/**
 * Record of Advice module contract definitions.
 *
 * These contracts are system configuration: super admins can edit them later,
 * while advisers consume only the active version through the RoA wizard.
 */

type JsonRecord = Record<string, unknown>;

export type RoAContractStatus = 'draft' | 'active' | 'archived';

export type RoAContractFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'chips'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'currency'
  | 'percentage'
  | 'file';

export type RoAContractSourceType =
  | 'clientSnapshot'
  | 'adviserSnapshot'
  | 'policyRegister'
  | 'fna'
  | 'moduleInput'
  | 'documentUpload'
  | 'calculated'
  | 'manual';

export interface RoAContractInputSource {
  id: string;
  label: string;
  type: RoAContractSourceType;
  required: boolean;
  sourcePath?: string;
  description?: string;
}

export interface RoAContractField {
  key: string;
  label: string;
  type: RoAContractFieldType;
  required?: boolean;
  source: RoAContractSourceType;
  sourcePath?: string;
  options?: string[];
  default?: string | number | boolean;
  placeholder?: string;
  helpText?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface RoAContractFormSection {
  id: string;
  title: string;
  description?: string;
  fields: RoAContractField[];
}

export interface RoAContractOutputField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  required: boolean;
  description?: string;
}

export interface RoAContractValidationRule {
  id: string;
  severity: 'blocking' | 'warning';
  message: string;
  fieldKeys?: string[];
}

export interface RoAContractEvidenceRequirement {
  id: string;
  label: string;
  type: 'quote' | 'policy_schedule' | 'comparison' | 'application' | 'fna' | 'client_instruction' | 'other';
  required: boolean;
  acceptedMimeTypes?: string[];
  guidance?: string;
}

export interface RoAContractDocumentSection {
  id: string;
  title: string;
  purpose: string;
  order: number;
  required: boolean;
  template: string;
}

export interface RoAModuleContract {
  id: string;
  title: string;
  description: string;
  category: string;
  status: RoAContractStatus;
  version: number;
  schemaVersion: string;
  input: {
    sources: RoAContractInputSource[];
    gatheringMethods: Array<'typed' | 'upload' | 'clientProfile' | 'policyRegister' | 'fna' | 'calculated'>;
  };
  formSchema: {
    sections: RoAContractFormSection[];
  };
  output: {
    normalizedKey: string;
    fields: RoAContractOutputField[];
  };
  validation: {
    requiredFields: string[];
    rules: RoAContractValidationRule[];
  };
  evidence: {
    requirements: RoAContractEvidenceRequirement[];
  };
  documentSections: RoAContractDocumentSection[];
  disclosures: string[];
  compileOrder: string[];
  /**
   * Optional compiler behaviour flags. Keeps canonical document assembly generic:
   * no title/keyword heuristics for module-specific sections.
   */
  compilerHints?: {
    /** Emit standard replacement-analysis wrapper sections in the canonical RoA shell. */
    includeReplacementAnalysis?: boolean;
  };
  metadata?: JsonRecord;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  publishedAt?: string;
}

export interface RoAModuleContractSchemaFormat {
  schemaVersion: string;
  allowedFieldTypes: RoAContractFieldType[];
  allowedSourceTypes: RoAContractSourceType[];
  allowedGatheringMethods: RoAModuleContract['input']['gatheringMethods'];
  allowedEvidenceTypes: RoAContractEvidenceRequirement['type'][];
  allowedValidationSeverities: RoAContractValidationRule['severity'][];
  requiredContractKeys: string[];
  requiredFieldKeys: string[];
}

export interface LegacyRoAModule {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'chips' | 'checkbox' | 'radio' | 'date';
    required?: boolean;
    options?: string[];
    default?: string | number | boolean;
    placeholder?: string;
    helpText?: string;
    validation?: {
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
    };
  }>;
  disclosures: string[];
  compileOrder: string[];
  category?: string;
  evidence?: RoAModuleContract['evidence'];
  validation?: RoAModuleContract['validation'];
  documentSections?: RoAModuleContract['documentSections'];
  output?: RoAModuleContract['output'];
}

const SYSTEM_TIMESTAMP = '2026-05-04T00:00:00.000Z';
const SYSTEM_USER = 'system:roa-contract-seed';

export const ROA_MODULE_CONTRACT_SCHEMA_FORMAT: RoAModuleContractSchemaFormat = {
  schemaVersion: '1.0',
  allowedFieldTypes: ['text', 'textarea', 'number', 'select', 'chips', 'checkbox', 'radio', 'date', 'currency', 'percentage', 'file'],
  allowedSourceTypes: ['clientSnapshot', 'adviserSnapshot', 'policyRegister', 'fna', 'moduleInput', 'documentUpload', 'calculated', 'manual'],
  allowedGatheringMethods: ['typed', 'upload', 'clientProfile', 'policyRegister', 'fna', 'calculated'],
  allowedEvidenceTypes: ['quote', 'policy_schedule', 'comparison', 'application', 'fna', 'client_instruction', 'other'],
  allowedValidationSeverities: ['blocking', 'warning'],
  requiredContractKeys: [
    'id',
    'title',
    'description',
    'category',
    'input',
    'formSchema',
    'output',
    'validation',
    'evidence',
    'documentSections',
  ],
  requiredFieldKeys: ['key', 'label', 'type', 'source'],
};

const clientSnapshotSources: RoAContractInputSource[] = [
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
];

function defaultDocumentTemplate(moduleTitle: string, sectionTitle: string, purpose: string): string {
  return [
    `{{client.displayName}} - ${moduleTitle}`,
    '',
    `## ${sectionTitle}`,
    purpose || 'Record the adviser-reviewed content for this section.',
    '',
    'Adviser notes: {{module.rationale}}',
  ].join('\n');
}

function systemContract(input: Omit<RoAModuleContract, 'status' | 'version' | 'schemaVersion' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): RoAModuleContract {
  return {
    ...input,
    documentSections: input.documentSections.map((section) => ({
      ...section,
      template: section.template || defaultDocumentTemplate(input.title, section.title, section.purpose),
    })),
    status: 'active',
    version: 1,
    schemaVersion: '1.0',
    createdAt: SYSTEM_TIMESTAMP,
    updatedAt: SYSTEM_TIMESTAMP,
    createdBy: SYSTEM_USER,
    updatedBy: SYSTEM_USER,
  };
}

export const DEFAULT_ROA_MODULE_CONTRACTS: RoAModuleContract[] = [
  systemContract({
    id: 'new_life_assurance_proposal',
    title: 'New Life Assurance Proposal',
    description: 'Recommends new life assurance cover based on client needs, affordability, underwriting and suitability.',
    category: 'Risk Management',
    input: {
      sources: [
        ...clientSnapshotSources,
        { id: 'risk_fna', label: 'Risk planning FNA', type: 'fna', required: false, sourcePath: 'fnaSummaries.risk' },
        { id: 'provider_quote', label: 'Provider quote', type: 'documentUpload', required: true },
      ],
      gatheringMethods: ['clientProfile', 'fna', 'typed', 'upload'],
    },
    formSchema: {
      sections: [
        {
          id: 'proposal',
          title: 'Proposal',
          fields: [
            { key: 'provider', label: 'Recommended Provider', type: 'select', required: true, source: 'moduleInput', options: ['Discovery Life', 'Momentum Life', 'Sanlam Life', 'Old Mutual Life', 'Hollard Life', 'Other'] },
            { key: 'cover_amount', label: 'Recommended Cover Amount', type: 'currency', required: true, source: 'moduleInput' },
            { key: 'monthly_premium', label: 'Monthly Premium', type: 'currency', required: true, source: 'moduleInput' },
            { key: 'benefit_types', label: 'Benefit Types', type: 'chips', required: true, source: 'moduleInput', placeholder: 'Life cover, disability, severe illness' },
            { key: 'rationale', label: 'Rationale', type: 'textarea', required: true, source: 'moduleInput' },
            { key: 'underwriting_notes', label: 'Underwriting Notes', type: 'textarea', source: 'moduleInput' },
          ],
        },
      ],
    },
    output: {
      normalizedKey: 'lifeAssuranceProposal',
      fields: [
        { key: 'provider', label: 'Recommended provider', type: 'string', required: true },
        { key: 'coverAmount', label: 'Cover amount', type: 'number', required: true },
        { key: 'monthlyPremium', label: 'Monthly premium', type: 'number', required: true },
        { key: 'rationale', label: 'Advice rationale', type: 'string', required: true },
      ],
    },
    validation: {
      requiredFields: ['provider', 'cover_amount', 'monthly_premium', 'benefit_types', 'rationale'],
      rules: [
        { id: 'quote_required', severity: 'blocking', message: 'A provider quote must be attached before final compilation.' },
        { id: 'do_not_cancel_existing_cover', severity: 'warning', message: 'Confirm the client will not cancel existing cover until new cover is in force.' },
      ],
    },
    evidence: {
      requirements: [
        { id: 'provider_quote', label: 'Provider quote', type: 'quote', required: true, acceptedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'] },
        { id: 'risk_fna', label: 'Risk FNA or needs calculation', type: 'fna', required: false },
      ],
    },
    documentSections: [
      { id: 'need', title: 'Identified Need', purpose: 'Explain the life assurance need and quantified shortfall.', order: 10, required: true },
      { id: 'recommendation', title: 'Recommendation', purpose: 'Describe the recommended cover, provider and premium.', order: 20, required: true },
      { id: 'risks', title: 'Risks and Underwriting', purpose: 'Record underwriting, exclusions and replacement cautions.', order: 30, required: true },
    ],
    disclosures: [
      'Life assurance is subject to underwriting and acceptance by the insurer.',
      'Existing cover should remain in force until replacement or new cover is confirmed.',
      'Premiums, exclusions and waiting periods must be checked against the policy schedule.',
    ],
    compileOrder: ['need', 'recommendation', 'risks', 'disclosures'],
  }),
  systemContract({
    id: 'life_insurance_comparison',
    title: 'Life Insurance Comparison',
    description:
      'Flagship replacement/comparison module: aligns current versus proposed risk cover, premiums and benefits with FAIS-aligned disclosures and evidence of schedules.',
    category: 'Risk Management',
    metadata: {
      flagshipModule: true,
      moduleExcellenceTarget: 'life_insurance_comparison',
      complianceNotes:
        'Use for like-for-life comparisons only when schedules and quotes are attached. Do not cancel in-force contracts until replacements are confirmed in writing.',
    },
    input: {
      sources: [
        ...clientSnapshotSources,
        { id: 'current_policies', label: 'Current policies', type: 'policyRegister', required: true, sourcePath: 'clientSnapshot.policies' },
        { id: 'comparison_schedule', label: 'Comparison schedule', type: 'documentUpload', required: true },
      ],
      gatheringMethods: ['clientProfile', 'policyRegister', 'typed', 'upload'],
    },
    formSchema: {
      sections: [
        {
          id: 'comparison',
          title: 'Comparison',
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
        },
      ],
    },
    output: {
      normalizedKey: 'lifeInsuranceComparison',
      fields: [
        { key: 'currentProviders', label: 'Current providers', type: 'array', required: true },
        { key: 'proposedProvider', label: 'Proposed provider', type: 'string', required: true },
        { key: 'premiumDifference', label: 'Premium difference', type: 'number', required: false },
        { key: 'replacementRationale', label: 'Replacement rationale', type: 'string', required: true },
      ],
    },
    validation: {
      requiredFields: ['current_providers', 'current_monthly_premium', 'proposed_provider', 'proposed_monthly_premium', 'benefit_comparison', 'replacement_rationale'],
      rules: [
        { id: 'comparison_required', severity: 'blocking', message: 'A like-for-like comparison must be recorded before replacement advice is finalised.' },
        {
          id: 'lost_benefits_warning',
          severity: 'warning',
          message: 'Explicitly record any lost benefits, exclusions, waiting periods, cashback clawbacks or premium escalation differences.',
          fieldKeys: ['benefit_comparison'],
        },
        {
          id: 'underwriting_outcome',
          severity: 'warning',
          message: 'Replacement cover remains subject to underwriting — benefit terms printed on the accepted policy schedule prevail.',
        },
        {
          id: 'cooling_off',
          severity: 'warning',
          message: 'Confirm whether statutory cooling-off rights were explained where applicable.',
        },
      ],
    },
    evidence: {
      requirements: [
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
    },
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
    compileOrder: ['current_position', 'comparison', 'replacement_considerations', 'disclosures'],
    compilerHints: { includeReplacementAnalysis: true },
  }),
  systemContract({
    id: 'new_investment_proposal',
    title: 'New Investment Proposal',
    description: 'Recommends a new investment based on objectives, time horizon, risk profile, costs and product suitability.',
    category: 'Investments',
    input: {
      sources: [
        ...clientSnapshotSources,
        { id: 'investment_ina', label: 'Investment needs analysis', type: 'fna', required: false, sourcePath: 'fnaSummaries.investment' },
        { id: 'fund_fact_sheets', label: 'Fund fact sheets or proposal', type: 'documentUpload', required: true },
      ],
      gatheringMethods: ['clientProfile', 'fna', 'typed', 'upload'],
    },
    formSchema: {
      sections: [
        {
          id: 'investment',
          title: 'Investment',
          fields: [
            { key: 'investment_amount', label: 'Investment Amount', type: 'currency', required: true, source: 'moduleInput' },
            { key: 'platform', label: 'Investment Platform', type: 'select', required: true, source: 'moduleInput', options: ['Allan Gray', 'Coronation', 'Sygnia', 'Momentum', 'Discovery', 'Other'] },
            { key: 'recommended_funds', label: 'Recommended Funds', type: 'textarea', required: true, source: 'moduleInput' },
            { key: 'risk_profile', label: 'Risk Profile', type: 'select', required: true, source: 'clientSnapshot', options: ['Conservative', 'Moderate Conservative', 'Moderate', 'Moderate Aggressive', 'Aggressive'] },
            { key: 'time_horizon', label: 'Time Horizon', type: 'select', required: true, source: 'moduleInput', options: ['Less than 2 years', '2-5 years', '5-10 years', 'More than 10 years'] },
            { key: 'total_annual_fee', label: 'Total Annual Fee', type: 'percentage', required: true, source: 'moduleInput' },
            { key: 'rationale', label: 'Rationale', type: 'textarea', required: true, source: 'moduleInput' },
          ],
        },
      ],
    },
    output: {
      normalizedKey: 'newInvestmentProposal',
      fields: [
        { key: 'investmentAmount', label: 'Investment amount', type: 'number', required: true },
        { key: 'platform', label: 'Platform', type: 'string', required: true },
        { key: 'recommendedFunds', label: 'Recommended funds', type: 'string', required: true },
        { key: 'rationale', label: 'Rationale', type: 'string', required: true },
      ],
    },
    validation: {
      requiredFields: ['investment_amount', 'platform', 'recommended_funds', 'risk_profile', 'time_horizon', 'total_annual_fee', 'rationale'],
      rules: [
        { id: 'risk_match', severity: 'blocking', message: 'Investment selection must be consistent with the captured risk profile and time horizon.' },
        { id: 'fees_disclosed', severity: 'blocking', message: 'All product, advice and platform fees must be recorded.' },
      ],
    },
    evidence: {
      requirements: [
        { id: 'investment_proposal', label: 'Investment proposal or fund fact sheets', type: 'comparison', required: true, acceptedMimeTypes: ['application/pdf'] },
        { id: 'client_instruction', label: 'Client investment instruction', type: 'client_instruction', required: false },
      ],
    },
    documentSections: [
      { id: 'objectives', title: 'Objectives and Time Horizon', purpose: 'Record objectives, investment term and liquidity needs.', order: 10, required: true },
      { id: 'recommendation', title: 'Investment Recommendation', purpose: 'Explain product, platform, funds and allocation.', order: 20, required: true },
      { id: 'fees_risks', title: 'Fees and Investment Risks', purpose: 'Disclose costs, volatility, currency and market risks.', order: 30, required: true },
    ],
    disclosures: [
      'Investment values can rise and fall and past performance is not a reliable guide to future returns.',
      'Fees, taxes and currency movements can materially affect investment outcomes.',
    ],
    compileOrder: ['objectives', 'recommendation', 'fees_risks', 'disclosures'],
  }),
  systemContract({
    id: 'investment_replacement_proposal',
    title: 'Investment Replacement Proposal',
    description: 'Documents replacement or transfer of an existing investment, including costs, benefits, risks and disadvantages.',
    category: 'Investments',
    input: {
      sources: [
        ...clientSnapshotSources,
        { id: 'current_investment', label: 'Current investment details', type: 'policyRegister', required: true, sourcePath: 'clientSnapshot.policies' },
        { id: 'replacement_analysis', label: 'Replacement analysis', type: 'documentUpload', required: true },
      ],
      gatheringMethods: ['clientProfile', 'policyRegister', 'typed', 'upload'],
    },
    formSchema: {
      sections: [
        {
          id: 'replacement',
          title: 'Replacement',
          fields: [
            { key: 'current_provider', label: 'Current Provider', type: 'text', required: true, source: 'policyRegister' },
            { key: 'current_value', label: 'Current Value', type: 'currency', required: true, source: 'moduleInput' },
            { key: 'proposed_provider', label: 'Proposed Provider', type: 'text', required: true, source: 'moduleInput' },
            { key: 'exit_penalties', label: 'Exit Penalties or Market Adjustments', type: 'currency', required: false, source: 'moduleInput' },
            { key: 'current_eac', label: 'Current EAC', type: 'percentage', required: false, source: 'moduleInput' },
            { key: 'proposed_eac', label: 'Proposed EAC', type: 'percentage', required: false, source: 'moduleInput' },
            { key: 'replacement_rationale', label: 'Replacement Rationale', type: 'textarea', required: true, source: 'moduleInput' },
            { key: 'disadvantages', label: 'Disadvantages and Risks', type: 'textarea', required: true, source: 'moduleInput' },
          ],
        },
      ],
    },
    output: {
      normalizedKey: 'investmentReplacementProposal',
      fields: [
        { key: 'currentProvider', label: 'Current provider', type: 'string', required: true },
        { key: 'proposedProvider', label: 'Proposed provider', type: 'string', required: true },
        { key: 'replacementRationale', label: 'Replacement rationale', type: 'string', required: true },
        { key: 'disadvantages', label: 'Disadvantages', type: 'string', required: true },
      ],
    },
    validation: {
      requiredFields: ['current_provider', 'current_value', 'proposed_provider', 'replacement_rationale', 'disadvantages'],
      rules: [
        { id: 'replacement_analysis_required', severity: 'blocking', message: 'Replacement advice must record benefits, costs, disadvantages and alternatives.' },
        { id: 'penalties_reviewed', severity: 'warning', message: 'Confirm whether penalties, paybacks or out-of-market periods apply.' },
      ],
    },
    evidence: {
      requirements: [
        { id: 'current_statement', label: 'Current investment statement', type: 'policy_schedule', required: true, acceptedMimeTypes: ['application/pdf'] },
        { id: 'replacement_analysis', label: 'Replacement analysis', type: 'comparison', required: true, acceptedMimeTypes: ['application/pdf'] },
      ],
    },
    documentSections: [
      { id: 'current_position', title: 'Current Investment Position', purpose: 'Summarise the existing investment.', order: 10, required: true },
      { id: 'replacement_analysis', title: 'Replacement Analysis', purpose: 'Compare current and proposed investments.', order: 20, required: true },
      { id: 'recommendation', title: 'Recommendation and Rationale', purpose: 'Explain why replacement is suitable.', order: 30, required: true },
    ],
    disclosures: [
      'Replacement may trigger fees, penalties, tax consequences or temporary out-of-market exposure.',
      'The client must understand both the advantages and disadvantages before implementation.',
    ],
    compileOrder: ['current_position', 'replacement_analysis', 'recommendation', 'disclosures'],
    compilerHints: { includeReplacementAnalysis: true },
  }),
  systemContract({
    id: 'new_retirement_proposal',
    title: 'New Retirement Proposal',
    description: 'Recommends a new retirement product or contribution strategy based on retirement objectives and affordability.',
    category: 'Retirement',
    input: {
      sources: [
        ...clientSnapshotSources,
        { id: 'retirement_fna', label: 'Retirement FNA', type: 'fna', required: false, sourcePath: 'fnaSummaries.retirement' },
        { id: 'retirement_quote', label: 'Retirement product quote', type: 'documentUpload', required: true },
      ],
      gatheringMethods: ['clientProfile', 'fna', 'typed', 'upload'],
    },
    formSchema: {
      sections: [
        {
          id: 'retirement',
          title: 'Retirement Proposal',
          fields: [
            { key: 'product_type', label: 'Product Type', type: 'select', required: true, source: 'moduleInput', options: ['Retirement Annuity', 'Preservation Fund', 'Living Annuity', 'Life Annuity', 'Other'] },
            { key: 'provider', label: 'Provider', type: 'text', required: true, source: 'moduleInput' },
            { key: 'monthly_contribution', label: 'Monthly Contribution', type: 'currency', required: false, source: 'moduleInput' },
            { key: 'lump_sum', label: 'Lump Sum', type: 'currency', required: false, source: 'moduleInput' },
            { key: 'retirement_age', label: 'Target Retirement Age', type: 'number', required: true, source: 'moduleInput' },
            { key: 'investment_strategy', label: 'Investment Strategy', type: 'textarea', required: true, source: 'moduleInput' },
            { key: 'rationale', label: 'Rationale', type: 'textarea', required: true, source: 'moduleInput' },
          ],
        },
      ],
    },
    output: {
      normalizedKey: 'newRetirementProposal',
      fields: [
        { key: 'productType', label: 'Product type', type: 'string', required: true },
        { key: 'provider', label: 'Provider', type: 'string', required: true },
        { key: 'retirementAge', label: 'Retirement age', type: 'number', required: true },
        { key: 'rationale', label: 'Rationale', type: 'string', required: true },
      ],
    },
    validation: {
      requiredFields: ['product_type', 'provider', 'retirement_age', 'investment_strategy', 'rationale'],
      rules: [
        { id: 'contribution_or_lump_sum', severity: 'blocking', message: 'Record either a recurring contribution or lump sum amount.' },
        { id: 'retirement_objective', severity: 'blocking', message: 'Retirement objective and target retirement age must be documented.' },
      ],
    },
    evidence: {
      requirements: [
        { id: 'retirement_quote', label: 'Retirement product quote', type: 'quote', required: true, acceptedMimeTypes: ['application/pdf'] },
        { id: 'retirement_fna', label: 'Retirement FNA', type: 'fna', required: false },
      ],
    },
    documentSections: [
      { id: 'retirement_need', title: 'Retirement Need', purpose: 'Summarise retirement objective and shortfall.', order: 10, required: true },
      { id: 'recommendation', title: 'Retirement Recommendation', purpose: 'Explain product, provider and contribution strategy.', order: 20, required: true },
      { id: 'tax_fees_risks', title: 'Tax, Fees and Risks', purpose: 'Disclose tax treatment, Regulation 28, fees and investment risk.', order: 30, required: true },
    ],
    disclosures: [
      'Retirement products are subject to retirement fund rules, Regulation 28 and applicable tax legislation.',
      'Investment performance is not guaranteed unless specifically stated by the product provider.',
    ],
    compileOrder: ['retirement_need', 'recommendation', 'tax_fees_risks', 'disclosures'],
  }),
  systemContract({
    id: 'section_14_transfer_proposal',
    title: 'Section 14 Proposal',
    description: 'Documents a Section 14 retirement fund transfer, including ceding and receiving funds, costs, risks and process.',
    category: 'Retirement',
    input: {
      sources: [
        ...clientSnapshotSources,
        { id: 'current_retirement_policy', label: 'Current retirement policy', type: 'policyRegister', required: true, sourcePath: 'clientSnapshot.policies' },
        { id: 'section_14_docs', label: 'Section 14 transfer documents', type: 'documentUpload', required: true },
      ],
      gatheringMethods: ['clientProfile', 'policyRegister', 'typed', 'upload'],
    },
    formSchema: {
      sections: [
        {
          id: 'section_14',
          title: 'Section 14 Transfer',
          fields: [
            { key: 'ceding_provider', label: 'Ceding Provider/Fund', type: 'text', required: true, source: 'policyRegister' },
            { key: 'receiving_provider', label: 'Receiving Provider/Fund', type: 'text', required: true, source: 'moduleInput' },
            { key: 'transfer_amount', label: 'Transfer Amount', type: 'currency', required: true, source: 'moduleInput' },
            { key: 'current_eac', label: 'Current EAC', type: 'percentage', required: false, source: 'moduleInput' },
            { key: 'receiving_eac', label: 'Receiving EAC', type: 'percentage', required: false, source: 'moduleInput' },
            { key: 'penalties', label: 'Penalties, Paybacks or Adjustments', type: 'textarea', required: false, source: 'moduleInput' },
            { key: 'rationale', label: 'Transfer Rationale', type: 'textarea', required: true, source: 'moduleInput' },
            { key: 'process_notes', label: 'Process Notes', type: 'textarea', required: false, source: 'moduleInput', default: 'Section 14 transfers can take several weeks and may include a short out-of-market period.' },
          ],
        },
      ],
    },
    output: {
      normalizedKey: 'section14TransferProposal',
      fields: [
        { key: 'cedingProvider', label: 'Ceding provider', type: 'string', required: true },
        { key: 'receivingProvider', label: 'Receiving provider', type: 'string', required: true },
        { key: 'transferAmount', label: 'Transfer amount', type: 'number', required: true },
        { key: 'rationale', label: 'Rationale', type: 'string', required: true },
      ],
    },
    validation: {
      requiredFields: ['ceding_provider', 'receiving_provider', 'transfer_amount', 'rationale'],
      rules: [
        { id: 'ceding_and_receiving_required', severity: 'blocking', message: 'Both ceding and receiving funds must be identified.' },
        { id: 'transfer_process_warning', severity: 'warning', message: 'Record process timelines, possible out-of-market period and any penalties.' },
      ],
    },
    evidence: {
      requirements: [
        { id: 'current_statement', label: 'Current retirement statement', type: 'policy_schedule', required: true, acceptedMimeTypes: ['application/pdf'] },
        { id: 'transfer_form', label: 'Section 14 transfer/application form', type: 'application', required: true, acceptedMimeTypes: ['application/pdf'] },
      ],
    },
    documentSections: [
      { id: 'current_fund', title: 'Current Retirement Fund', purpose: 'Summarise the ceding fund and current position.', order: 10, required: true },
      { id: 'receiving_fund', title: 'Receiving Fund Recommendation', purpose: 'Explain the receiving fund and investment strategy.', order: 20, required: true },
      { id: 'transfer_considerations', title: 'Transfer Considerations', purpose: 'Record fees, risks, timelines and disadvantages.', order: 30, required: true },
    ],
    disclosures: [
      'Section 14 transfers are subject to fund administrator and regulatory processing requirements.',
      'The transfer may include delays, out-of-market periods, penalties or loss of product-specific benefits.',
      'Past performance is not a reliable indicator of future returns.',
    ],
    compileOrder: ['current_fund', 'receiving_fund', 'transfer_considerations', 'disclosures'],
    compilerHints: { includeReplacementAnalysis: true },
  }),
];

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ensureString(value: unknown, label: string, errors: string[]): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  errors.push(`${label} is required`);
  return '';
}

function validateId(value: string, label: string, errors: string[]): void {
  if (!/^[a-z0-9][a-z0-9_-]{2,80}$/.test(value)) {
    errors.push(`${label} must use lowercase letters, numbers, hyphens or underscores`);
  }
}

function isAllowed<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

const ALLOWED_TEMPLATE_ROOTS = ['client', 'adviser', 'module', 'evidence', 'draft'] as const;
const ALLOWED_TEMPLATE_FILTERS = ['currency', 'percentage', 'date'] as const;
const EVIDENCE_TOKEN_PROPERTIES = ['fileName', 'label', 'type', 'source', 'sha256', 'uploadedAt'] as const;

function extractTemplateTokens(template: string): Array<{ expression: string; path: string; filter?: string }> {
  const tokens: Array<{ expression: string; path: string; filter?: string }> = [];
  const tokenPattern = /{{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*([a-zA-Z]+))?\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(template)) !== null) {
    tokens.push({
      expression: match[0],
      path: match[1],
      filter: match[2],
    });
  }
  return tokens;
}

export function validateRoAModuleContract(input: unknown): RoAModuleContract {
  const errors: string[] = [];
  if (!isRecord(input)) {
    throw new Error('Module contract must be an object');
  }

  const id = ensureString(input.id, 'id', errors);
  if (id) validateId(id, 'id', errors);

  const title = ensureString(input.title, 'title', errors);
  const description = ensureString(input.description, 'description', errors);
  const category = ensureString(input.category, 'category', errors);
  const status = isAllowed(input.status, ['draft', 'active', 'archived'] as const) ? input.status : 'draft';
  const version = typeof input.version === 'number' && input.version > 0 ? Math.floor(input.version) : 1;
  const schemaVersion = typeof input.schemaVersion === 'string' && input.schemaVersion.trim() ? input.schemaVersion.trim() : '1.0';

  const formSchema = isRecord(input.formSchema) ? input.formSchema : {};
  const sectionsRaw = Array.isArray(formSchema.sections) ? formSchema.sections : [];
  if (sectionsRaw.length === 0) errors.push('formSchema.sections must include at least one section');

  const sections: RoAContractFormSection[] = sectionsRaw.map((sectionRaw, sectionIndex) => {
    const section = isRecord(sectionRaw) ? sectionRaw : {};
    const sectionId = ensureString(section.id, `formSchema.sections[${sectionIndex}].id`, errors);
    if (sectionId) validateId(sectionId, `formSchema.sections[${sectionIndex}].id`, errors);
    const fieldsRaw = Array.isArray(section.fields) ? section.fields : [];
    if (fieldsRaw.length === 0) errors.push(`formSchema.sections[${sectionIndex}].fields must include at least one field`);

    return {
      id: sectionId,
      title: ensureString(section.title, `formSchema.sections[${sectionIndex}].title`, errors),
      description: typeof section.description === 'string' ? section.description : undefined,
      fields: fieldsRaw.map((fieldRaw, fieldIndex) => {
        const field = isRecord(fieldRaw) ? fieldRaw : {};
        const fieldKey = ensureString(field.key, `field ${fieldIndex} key`, errors);
        if (fieldKey) validateId(fieldKey, `field ${fieldKey}`, errors);
        if (!isAllowed(field.type, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedFieldTypes)) {
          errors.push(`field ${fieldKey || fieldIndex} has an unsupported type`);
        }
        if (!isAllowed(field.source, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedSourceTypes)) {
          errors.push(`field ${fieldKey || fieldIndex} has an unsupported source`);
        }

        return {
          key: fieldKey,
          label: ensureString(field.label, `field ${fieldKey || fieldIndex} label`, errors),
          type: (isAllowed(field.type, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedFieldTypes) ? field.type : 'text') as RoAContractFieldType,
          required: field.required === true,
          source: (isAllowed(field.source, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedSourceTypes) ? field.source : 'moduleInput') as RoAContractSourceType,
          sourcePath: typeof field.sourcePath === 'string' ? field.sourcePath : undefined,
          options: Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === 'string' && !!option.trim()) : undefined,
          default: ['string', 'number', 'boolean'].includes(typeof field.default) ? field.default as string | number | boolean : undefined,
          placeholder: typeof field.placeholder === 'string' ? field.placeholder : undefined,
          helpText: typeof field.helpText === 'string' ? field.helpText : undefined,
          validation: isRecord(field.validation) ? field.validation as RoAContractField['validation'] : undefined,
        };
      }),
    };
  });

  const inputConfig = isRecord(input.input) ? input.input : {};
  const sourcesRaw = Array.isArray(inputConfig.sources) ? inputConfig.sources : [];
  const gatheringMethodsRaw = Array.isArray(inputConfig.gatheringMethods) ? inputConfig.gatheringMethods : [];

  const output = isRecord(input.output) ? input.output : {};
  const outputFieldsRaw = Array.isArray(output.fields) ? output.fields : [];
  if (!ensureString(output.normalizedKey, 'output.normalizedKey', errors)) {
    errors.push('output.normalizedKey is required');
  }

  const documentSectionsRaw = Array.isArray(input.documentSections) ? input.documentSections : [];
  if (documentSectionsRaw.length === 0) errors.push('documentSections must include at least one section');

  if (status === 'active') {
    const moduleTokenPaths = new Set<string>();
    moduleTokenPaths.add('module.rationale');
    for (const section of sections) {
      for (const field of section.fields) {
        moduleTokenPaths.add(`module.${field.key}`);
      }
    }
    for (const field of outputFieldsRaw.filter(isRecord)) {
      if (typeof field.key === 'string' && field.key.trim()) {
        moduleTokenPaths.add(`module.${field.key.trim()}`);
      }
    }
    const evidenceRequirementIds = new Set(
      Array.isArray((input.evidence as JsonRecord | undefined)?.requirements)
        ? ((input.evidence as JsonRecord).requirements as unknown[])
          .filter(isRecord)
          .map((requirement) => typeof requirement.id === 'string' ? requirement.id.trim() : '')
          .filter(Boolean)
        : [],
    );
    const documentSectionIds = new Set<string>();

    documentSectionsRaw.filter(isRecord).forEach((section, index) => {
      const required = section.required !== false;
      const template = typeof section.template === 'string' ? section.template.trim() : '';
      const sectionId = typeof section.id === 'string' ? section.id.trim() : '';
      if (sectionId) {
        validateId(sectionId, `documentSections[${index}].id`, errors);
        documentSectionIds.add(sectionId);
      }
      if (required && !template) {
        errors.push(`documentSections[${index}].template is required before publishing`);
      }
      for (const token of extractTemplateTokens(template)) {
        const root = token.path.split('.')[0];
        if (!isAllowed(root, ALLOWED_TEMPLATE_ROOTS)) {
          errors.push(`documentSections[${index}].template uses unsupported token ${token.expression}`);
          continue;
        }
        if (token.filter && !isAllowed(token.filter.toLowerCase(), ALLOWED_TEMPLATE_FILTERS)) {
          errors.push(`documentSections[${index}].template uses unsupported filter ${token.filter}`);
        }
        if (root === 'module' && !moduleTokenPaths.has(token.path)) {
          errors.push(`documentSections[${index}].template uses unknown module token ${token.expression}`);
        }
        if (root === 'evidence') {
          const [, requirementId, property] = token.path.split('.');
          if (!requirementId || !evidenceRequirementIds.has(requirementId) || !isAllowed(property, EVIDENCE_TOKEN_PROPERTIES)) {
            errors.push(`documentSections[${index}].template uses unknown evidence token ${token.expression}`);
          }
        }
      }
    });

    const compileOrderRaw = Array.isArray(input.compileOrder) ? input.compileOrder : [];
    compileOrderRaw.filter((value): value is string => typeof value === 'string').forEach((sectionId) => {
      if (sectionId !== 'disclosures' && !documentSectionIds.has(sectionId)) {
        errors.push(`compileOrder references unknown document section ${sectionId}`);
      }
    });
  }

  const compilerHintsRaw = input.compilerHints;
  let compilerHints: RoAModuleContract['compilerHints'];
  if (compilerHintsRaw !== undefined && compilerHintsRaw !== null) {
    if (!isRecord(compilerHintsRaw)) {
      errors.push('compilerHints must be an object');
    } else {
      const allowedKeys = new Set(['includeReplacementAnalysis']);
      for (const key of Object.keys(compilerHintsRaw)) {
        if (!allowedKeys.has(key)) {
          errors.push(`compilerHints.${key} is not supported`);
        }
      }
      const flag = compilerHintsRaw.includeReplacementAnalysis;
      if (flag !== undefined && typeof flag !== 'boolean') {
        errors.push('compilerHints.includeReplacementAnalysis must be a boolean');
      }
      if (flag === true) {
        compilerHints = { includeReplacementAnalysis: true };
      }
    }
  }

  const now = new Date().toISOString();

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return {
    id,
    title,
    description,
    category,
    status,
    version,
    schemaVersion,
    input: {
      sources: sourcesRaw.filter(isRecord).map((source) => ({
        id: String(source.id || ''),
        label: String(source.label || ''),
        type: (isAllowed(source.type, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedSourceTypes) ? source.type : 'manual') as RoAContractSourceType,
        required: source.required === true,
        sourcePath: typeof source.sourcePath === 'string' ? source.sourcePath : undefined,
        description: typeof source.description === 'string' ? source.description : undefined,
      })),
      gatheringMethods: gatheringMethodsRaw.filter((method): method is RoAModuleContract['input']['gatheringMethods'][number] =>
        isAllowed(method, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedGatheringMethods),
      ),
    },
    formSchema: { sections },
    output: {
      normalizedKey: String(output.normalizedKey),
      fields: outputFieldsRaw.filter(isRecord).map((field) => ({
        key: String(field.key || ''),
        label: String(field.label || ''),
        type: isAllowed(field.type, ['string', 'number', 'boolean', 'array', 'object', 'date'] as const) ? field.type : 'string',
        required: field.required === true,
        description: typeof field.description === 'string' ? field.description : undefined,
      })),
    },
    validation: {
      requiredFields: Array.isArray((input.validation as JsonRecord | undefined)?.requiredFields)
        ? ((input.validation as JsonRecord).requiredFields as unknown[]).filter((value): value is string => typeof value === 'string')
        : sections.flatMap((section) => section.fields.filter((field) => field.required).map((field) => field.key)),
      rules: Array.isArray((input.validation as JsonRecord | undefined)?.rules)
        ? ((input.validation as JsonRecord).rules as unknown[]).filter(isRecord).map((rule) => ({
            id: String(rule.id || ''),
            severity: isAllowed(rule.severity, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedValidationSeverities) ? rule.severity : 'warning',
            message: String(rule.message || ''),
            fieldKeys: Array.isArray(rule.fieldKeys) ? rule.fieldKeys.filter((value): value is string => typeof value === 'string') : undefined,
          }))
        : [],
    },
    evidence: {
      requirements: Array.isArray((input.evidence as JsonRecord | undefined)?.requirements)
        ? ((input.evidence as JsonRecord).requirements as unknown[]).filter(isRecord).map((requirement) => ({
            id: String(requirement.id || ''),
            label: String(requirement.label || ''),
            type: isAllowed(requirement.type, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedEvidenceTypes) ? requirement.type : 'other',
            required: requirement.required === true,
            acceptedMimeTypes: Array.isArray(requirement.acceptedMimeTypes)
              ? requirement.acceptedMimeTypes.filter((value): value is string => typeof value === 'string')
              : undefined,
            guidance: typeof requirement.guidance === 'string' ? requirement.guidance : undefined,
          }))
        : [],
    },
    documentSections: documentSectionsRaw.filter(isRecord).map((section, index) => ({
      id: String(section.id || ''),
      title: String(section.title || ''),
      purpose: String(section.purpose || ''),
      order: typeof section.order === 'number' ? section.order : index + 1,
      required: section.required !== false,
      template: typeof section.template === 'string' ? section.template : '',
    })),
    disclosures: Array.isArray(input.disclosures) ? input.disclosures.filter((value): value is string => typeof value === 'string') : [],
    compileOrder: Array.isArray(input.compileOrder)
      ? input.compileOrder.filter((value): value is string => typeof value === 'string')
      : documentSectionsRaw.filter(isRecord).map((section) => String(section.id || '')).filter(Boolean),
    compilerHints,
    metadata: isRecord(input.metadata) ? input.metadata : undefined,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : now,
    createdBy: typeof input.createdBy === 'string' ? input.createdBy : SYSTEM_USER,
    updatedBy: typeof input.updatedBy === 'string' ? input.updatedBy : SYSTEM_USER,
    publishedAt: typeof input.publishedAt === 'string' ? input.publishedAt : undefined,
  };
}

export function contractToLegacyModule(contract: RoAModuleContract): LegacyRoAModule {
  const fields = contract.formSchema.sections.flatMap((section) => section.fields).map((field) => {
    const legacyType = field.type === 'currency' || field.type === 'percentage' || field.type === 'file'
      ? field.type === 'file' ? 'text' : 'number'
      : field.type;

    return {
      key: field.key,
      label: field.label,
      type: legacyType,
      required: field.required,
      options: field.options,
      default: field.default,
      placeholder: field.placeholder,
      helpText: field.helpText,
      validation: field.validation
        ? {
            minLength: field.validation.minLength,
            maxLength: field.validation.maxLength,
            min: field.validation.min,
            max: field.validation.max,
          }
        : undefined,
    };
  });

  return {
    id: contract.id,
    title: contract.title,
    description: contract.description,
    fields,
    disclosures: contract.disclosures,
    compileOrder: contract.compileOrder,
    category: contract.category,
    evidence: contract.evidence,
    validation: contract.validation,
    documentSections: contract.documentSections,
    output: contract.output,
  };
}
