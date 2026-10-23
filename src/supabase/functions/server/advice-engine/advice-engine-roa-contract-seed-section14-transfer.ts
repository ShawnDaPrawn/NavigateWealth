/**
 * Seeded RoA module contract: section_14_transfer_proposal.
 * Extracted verbatim from advice-engine-roa-default-contracts.ts, which
 * assembles the DEFAULT_ROA_MODULE_CONTRACTS array from these seed files.
 */
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  clientSnapshotSources,
  systemContract,
} from './advice-engine-roa-contract-seed-builders.ts';

export const section14TransferProposalContract: RoAModuleContract = systemContract({
  id: 'section_14_transfer_proposal',
  title: 'Section 14 Proposal',
  description:
    'Documents a Section 14 retirement fund transfer, including ceding and receiving funds, costs, risks and process.',
  category: 'Retirement',
  input: {
    sources: [
      ...clientSnapshotSources,
      {
        id: 'current_retirement_policy',
        label: 'Current retirement policy',
        type: 'policyRegister',
        required: true,
        sourcePath: 'clientSnapshot.policies',
      },
      {
        id: 'section_14_docs',
        label: 'Section 14 transfer documents',
        type: 'documentUpload',
        required: true,
      },
    ],
    gatheringMethods: ['clientProfile', 'policyRegister', 'typed', 'upload'],
  },
  formSchema: {
    sections: [
      {
        id: 'section_14',
        title: 'Section 14 Transfer',
        fields: [
          {
            key: 'ceding_provider',
            label: 'Ceding Provider/Fund',
            type: 'text',
            required: true,
            source: 'policyRegister',
          },
          {
            key: 'receiving_provider',
            label: 'Receiving Provider/Fund',
            type: 'text',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'transfer_amount',
            label: 'Transfer Amount',
            type: 'currency',
            required: true,
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
            key: 'receiving_eac',
            label: 'Receiving EAC',
            type: 'percentage',
            required: false,
            source: 'moduleInput',
          },
          {
            key: 'penalties',
            label: 'Penalties, Paybacks or Adjustments',
            type: 'textarea',
            required: false,
            source: 'moduleInput',
          },
          {
            key: 'rationale',
            label: 'Transfer Rationale',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'process_notes',
            label: 'Process Notes',
            type: 'textarea',
            required: false,
            source: 'moduleInput',
            default:
              'Section 14 transfers can take several weeks and may include a short out-of-market period.',
          },
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
      {
        id: 'ceding_and_receiving_required',
        severity: 'blocking',
        message: 'Both ceding and receiving funds must be identified.',
      },
      {
        id: 'transfer_process_warning',
        severity: 'warning',
        message: 'Record process timelines, possible out-of-market period and any penalties.',
      },
    ],
  },
  evidence: {
    requirements: [
      {
        id: 'current_statement',
        label: 'Current retirement statement',
        type: 'policy_schedule',
        required: true,
        acceptedMimeTypes: ['application/pdf'],
      },
      {
        id: 'transfer_form',
        label: 'Section 14 transfer/application form',
        type: 'application',
        required: true,
        acceptedMimeTypes: ['application/pdf'],
      },
    ],
  },
  documentSections: [
    {
      id: 'current_fund',
      title: 'Current Retirement Fund',
      purpose: 'Summarise the ceding fund and current position.',
      order: 10,
      required: true,
    },
    {
      id: 'receiving_fund',
      title: 'Receiving Fund Recommendation',
      purpose: 'Explain the receiving fund and investment strategy.',
      order: 20,
      required: true,
    },
    {
      id: 'transfer_considerations',
      title: 'Transfer Considerations',
      purpose: 'Record fees, risks, timelines and disadvantages.',
      order: 30,
      required: true,
    },
  ],
  disclosures: [
    'Section 14 transfers are subject to fund administrator and regulatory processing requirements.',
    'The transfer may include delays, out-of-market periods, penalties or loss of product-specific benefits.',
    'Past performance is not a reliable indicator of future returns.',
  ],
  compileOrder: ['current_fund', 'receiving_fund', 'transfer_considerations', 'disclosures'],
  compilerHints: { includeReplacementAnalysis: true },
});
