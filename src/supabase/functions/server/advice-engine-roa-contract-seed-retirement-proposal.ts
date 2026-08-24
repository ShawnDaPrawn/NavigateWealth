/**
 * Seeded RoA module contract: new_retirement_proposal.
 * Extracted verbatim from advice-engine-roa-default-contracts.ts, which
 * assembles the DEFAULT_ROA_MODULE_CONTRACTS array from these seed files.
 */
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  clientSnapshotSources,
  systemContract,
} from './advice-engine-roa-contract-seed-builders.ts';

export const newRetirementProposalContract: RoAModuleContract = systemContract({
  id: 'new_retirement_proposal',
  title: 'New Retirement Proposal',
  description:
    'Recommends a new retirement product or contribution strategy based on retirement objectives and affordability.',
  category: 'Retirement',
  input: {
    sources: [
      ...clientSnapshotSources,
      {
        id: 'retirement_fna',
        label: 'Retirement FNA',
        type: 'fna',
        required: false,
        sourcePath: 'fnaSummaries.retirement',
      },
      {
        id: 'retirement_quote',
        label: 'Retirement product quote',
        type: 'documentUpload',
        required: true,
      },
    ],
    gatheringMethods: ['clientProfile', 'fna', 'typed', 'upload'],
  },
  formSchema: {
    sections: [
      {
        id: 'retirement',
        title: 'Retirement Proposal',
        fields: [
          {
            key: 'product_type',
            label: 'Product Type',
            type: 'select',
            required: true,
            source: 'moduleInput',
            options: [
              'Retirement Annuity',
              'Preservation Fund',
              'Living Annuity',
              'Life Annuity',
              'Other',
            ],
          },
          {
            key: 'provider',
            label: 'Provider',
            type: 'text',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'monthly_contribution',
            label: 'Monthly Contribution',
            type: 'currency',
            required: false,
            source: 'moduleInput',
          },
          {
            key: 'lump_sum',
            label: 'Lump Sum',
            type: 'currency',
            required: false,
            source: 'moduleInput',
          },
          {
            key: 'retirement_age',
            label: 'Target Retirement Age',
            type: 'number',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'investment_strategy',
            label: 'Investment Strategy',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'rationale',
            label: 'Rationale',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
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
    requiredFields: [
      'product_type',
      'provider',
      'retirement_age',
      'investment_strategy',
      'rationale',
    ],
    rules: [
      {
        id: 'contribution_or_lump_sum',
        severity: 'blocking',
        message: 'Record either a recurring contribution or lump sum amount.',
      },
      {
        id: 'retirement_objective',
        severity: 'blocking',
        message: 'Retirement objective and target retirement age must be documented.',
      },
    ],
  },
  evidence: {
    requirements: [
      {
        id: 'retirement_quote',
        label: 'Retirement product quote',
        type: 'quote',
        required: true,
        acceptedMimeTypes: ['application/pdf'],
      },
      { id: 'retirement_fna', label: 'Retirement FNA', type: 'fna', required: false },
    ],
  },
  documentSections: [
    {
      id: 'retirement_need',
      title: 'Retirement Need',
      purpose: 'Summarise retirement objective and shortfall.',
      order: 10,
      required: true,
    },
    {
      id: 'recommendation',
      title: 'Retirement Recommendation',
      purpose: 'Explain product, provider and contribution strategy.',
      order: 20,
      required: true,
    },
    {
      id: 'tax_fees_risks',
      title: 'Tax, Fees and Risks',
      purpose: 'Disclose tax treatment, Regulation 28, fees and investment risk.',
      order: 30,
      required: true,
    },
  ],
  disclosures: [
    'Retirement products are subject to retirement fund rules, Regulation 28 and applicable tax legislation.',
    'Investment performance is not guaranteed unless specifically stated by the product provider.',
  ],
  compileOrder: ['retirement_need', 'recommendation', 'tax_fees_risks', 'disclosures'],
});
