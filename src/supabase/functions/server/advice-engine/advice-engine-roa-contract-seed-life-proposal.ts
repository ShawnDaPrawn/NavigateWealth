/**
 * Seeded RoA module contract: new_life_assurance_proposal.
 * Extracted verbatim from advice-engine-roa-default-contracts.ts, which
 * assembles the DEFAULT_ROA_MODULE_CONTRACTS array from these seed files.
 */
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  clientSnapshotSources,
  systemContract,
} from './advice-engine-roa-contract-seed-builders.ts';

export const newLifeAssuranceProposalContract: RoAModuleContract = systemContract({
  id: 'new_life_assurance_proposal',
  title: 'New Life Assurance Proposal',
  description:
    'Recommends new life assurance cover based on client needs, affordability, underwriting and suitability.',
  category: 'Risk Management',
  input: {
    sources: [
      ...clientSnapshotSources,
      {
        id: 'risk_fna',
        label: 'Risk planning FNA',
        type: 'fna',
        required: false,
        sourcePath: 'fnaSummaries.risk',
      },
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
          {
            key: 'provider',
            label: 'Recommended Provider',
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
            key: 'cover_amount',
            label: 'Recommended Cover Amount',
            type: 'currency',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'monthly_premium',
            label: 'Monthly Premium',
            type: 'currency',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'benefit_types',
            label: 'Benefit Types',
            type: 'chips',
            required: true,
            source: 'moduleInput',
            placeholder: 'Life cover, disability, severe illness',
          },
          {
            key: 'rationale',
            label: 'Rationale',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'underwriting_notes',
            label: 'Underwriting Notes',
            type: 'textarea',
            source: 'moduleInput',
          },
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
      {
        id: 'quote_required',
        severity: 'blocking',
        message: 'A provider quote must be attached before final compilation.',
      },
      {
        id: 'do_not_cancel_existing_cover',
        severity: 'warning',
        message: 'Confirm the client will not cancel existing cover until new cover is in force.',
      },
    ],
  },
  evidence: {
    requirements: [
      {
        id: 'provider_quote',
        label: 'Provider quote',
        type: 'quote',
        required: true,
        acceptedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
      },
      { id: 'risk_fna', label: 'Risk FNA or needs calculation', type: 'fna', required: false },
    ],
  },
  documentSections: [
    {
      id: 'need',
      title: 'Identified Need',
      purpose: 'Explain the life assurance need and quantified shortfall.',
      order: 10,
      required: true,
    },
    {
      id: 'recommendation',
      title: 'Recommendation',
      purpose: 'Describe the recommended cover, provider and premium.',
      order: 20,
      required: true,
    },
    {
      id: 'risks',
      title: 'Risks and Underwriting',
      purpose: 'Record underwriting, exclusions and replacement cautions.',
      order: 30,
      required: true,
    },
  ],
  disclosures: [
    'Life assurance is subject to underwriting and acceptance by the insurer.',
    'Existing cover should remain in force until replacement or new cover is confirmed.',
    'Premiums, exclusions and waiting periods must be checked against the policy schedule.',
  ],
  compileOrder: ['need', 'recommendation', 'risks', 'disclosures'],
});
