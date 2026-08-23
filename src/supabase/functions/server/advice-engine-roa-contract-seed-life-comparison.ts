/**
 * Seeded RoA module contract: life_insurance_comparison.
 * Extracted verbatim from advice-engine-roa-default-contracts.ts, which
 * assembles the DEFAULT_ROA_MODULE_CONTRACTS array from these seed files.
 */
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  clientSnapshotSources,
  systemContract,
} from './advice-engine-roa-contract-seed-builders.ts';

export const lifeInsuranceComparisonContract: RoAModuleContract = systemContract({
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
      {
        id: 'current_policies',
        label: 'Current policies',
        type: 'policyRegister',
        required: true,
        sourcePath: 'clientSnapshot.policies',
      },
      {
        id: 'comparison_schedule',
        label: 'Comparison schedule',
        type: 'documentUpload',
        required: true,
      },
    ],
    gatheringMethods: ['clientProfile', 'policyRegister', 'typed', 'upload'],
  },
  formSchema: {
    sections: [
      {
        id: 'comparison',
        title: 'Comparison',
        fields: [
          {
            key: 'current_providers',
            label: 'Current Providers',
            type: 'chips',
            required: true,
            source: 'policyRegister',
          },
          {
            key: 'current_monthly_premium',
            label: 'Current Monthly Premium',
            type: 'currency',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'proposed_provider',
            label: 'Proposed Provider',
            type: 'select',
            required: true,
            source: 'moduleInput',
            options: [
              'Discovery Life',
              'Momentum Life',
              'Sanlam Life',
              'Old Mutual Life',
              'Hollard Life',
              'Other',
            ],
          },
          {
            key: 'proposed_monthly_premium',
            label: 'Proposed Monthly Premium',
            type: 'currency',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'benefit_comparison',
            label: 'Benefit Comparison',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'replacement_rationale',
            label: 'Replacement Rationale',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
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
      {
        key: 'replacementRationale',
        label: 'Replacement rationale',
        type: 'string',
        required: true,
      },
    ],
  },
  validation: {
    requiredFields: [
      'current_providers',
      'current_monthly_premium',
      'proposed_provider',
      'proposed_monthly_premium',
      'benefit_comparison',
      'replacement_rationale',
    ],
    rules: [
      {
        id: 'comparison_required',
        severity: 'blocking',
        message:
          'A like-for-like comparison must be recorded before replacement advice is finalised.',
      },
      {
        id: 'lost_benefits_warning',
        severity: 'warning',
        message:
          'Explicitly record any lost benefits, exclusions, waiting periods, cashback clawbacks or premium escalation differences.',
        fieldKeys: ['benefit_comparison'],
      },
      {
        id: 'underwriting_outcome',
        severity: 'warning',
        message:
          'Replacement cover remains subject to underwriting — benefit terms printed on the accepted policy schedule prevail.',
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
        guidance:
          'Latest insurer-issued schedule showing benefits, exclusions, premiums and inception dates.',
      },
      {
        id: 'comparison_schedule',
        label: 'Comparison schedule',
        type: 'comparison',
        required: true,
        acceptedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
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
});
