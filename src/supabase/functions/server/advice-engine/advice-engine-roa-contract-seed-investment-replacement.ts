/**
 * Seeded RoA module contract: investment_replacement_proposal.
 * Extracted verbatim from advice-engine-roa-default-contracts.ts, which
 * assembles the DEFAULT_ROA_MODULE_CONTRACTS array from these seed files.
 */
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  clientSnapshotSources,
  systemContract,
} from './advice-engine-roa-contract-seed-builders.ts';

export const investmentReplacementProposalContract: RoAModuleContract = systemContract({
  id: 'investment_replacement_proposal',
  title: 'Investment Replacement Proposal',
  description:
    'Documents replacement or transfer of an existing investment, including costs, benefits, risks and disadvantages.',
  category: 'Investments',
  input: {
    sources: [
      ...clientSnapshotSources,
      {
        id: 'current_investment',
        label: 'Current investment details',
        type: 'policyRegister',
        required: true,
        sourcePath: 'clientSnapshot.policies',
      },
      {
        id: 'replacement_analysis',
        label: 'Replacement analysis',
        type: 'documentUpload',
        required: true,
      },
    ],
    gatheringMethods: ['clientProfile', 'policyRegister', 'typed', 'upload'],
  },
  formSchema: {
    sections: [
      {
        id: 'replacement',
        title: 'Replacement',
        fields: [
          {
            key: 'current_provider',
            label: 'Current Provider',
            type: 'text',
            required: true,
            source: 'policyRegister',
          },
          {
            key: 'current_value',
            label: 'Current Value',
            type: 'currency',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'proposed_provider',
            label: 'Proposed Provider',
            type: 'text',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'exit_penalties',
            label: 'Exit Penalties or Market Adjustments',
            type: 'currency',
            required: false,
            source: 'moduleInput',
          },
          {
            key: 'current_eac',
            label: 'Current EAC',
            type: 'percentage',
            required: false,
            source: 'moduleInput',
          },
          {
            key: 'proposed_eac',
            label: 'Proposed EAC',
            type: 'percentage',
            required: false,
            source: 'moduleInput',
          },
          {
            key: 'replacement_rationale',
            label: 'Replacement Rationale',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'disadvantages',
            label: 'Disadvantages and Risks',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
        ],
      },
    ],
  },
  output: {
    normalizedKey: 'investmentReplacementProposal',
    fields: [
      { key: 'currentProvider', label: 'Current provider', type: 'string', required: true },
      { key: 'proposedProvider', label: 'Proposed provider', type: 'string', required: true },
      {
        key: 'replacementRationale',
        label: 'Replacement rationale',
        type: 'string',
        required: true,
      },
      { key: 'disadvantages', label: 'Disadvantages', type: 'string', required: true },
    ],
  },
  validation: {
    requiredFields: [
      'current_provider',
      'current_value',
      'proposed_provider',
      'replacement_rationale',
      'disadvantages',
    ],
    rules: [
      {
        id: 'replacement_analysis_required',
        severity: 'blocking',
        message: 'Replacement advice must record benefits, costs, disadvantages and alternatives.',
      },
      {
        id: 'penalties_reviewed',
        severity: 'warning',
        message: 'Confirm whether penalties, paybacks or out-of-market periods apply.',
      },
    ],
  },
  evidence: {
    requirements: [
      {
        id: 'current_statement',
        label: 'Current investment statement',
        type: 'policy_schedule',
        required: true,
        acceptedMimeTypes: ['application/pdf'],
      },
      {
        id: 'replacement_analysis',
        label: 'Replacement analysis',
        type: 'comparison',
        required: true,
        acceptedMimeTypes: ['application/pdf'],
      },
    ],
  },
  documentSections: [
    {
      id: 'current_position',
      title: 'Current Investment Position',
      purpose: 'Summarise the existing investment.',
      order: 10,
      required: true,
    },
    {
      id: 'replacement_analysis',
      title: 'Replacement Analysis',
      purpose: 'Compare current and proposed investments.',
      order: 20,
      required: true,
    },
    {
      id: 'recommendation',
      title: 'Recommendation and Rationale',
      purpose: 'Explain why replacement is suitable.',
      order: 30,
      required: true,
    },
  ],
  disclosures: [
    'Replacement may trigger fees, penalties, tax consequences or temporary out-of-market exposure.',
    'The client must understand both the advantages and disadvantages before implementation.',
  ],
  compileOrder: ['current_position', 'replacement_analysis', 'recommendation', 'disclosures'],
  compilerHints: { includeReplacementAnalysis: true },
});
