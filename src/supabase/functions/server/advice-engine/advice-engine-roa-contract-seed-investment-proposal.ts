/**
 * Seeded RoA module contract: new_investment_proposal.
 * Extracted verbatim from advice-engine-roa-default-contracts.ts, which
 * assembles the DEFAULT_ROA_MODULE_CONTRACTS array from these seed files.
 */
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  clientSnapshotSources,
  systemContract,
} from './advice-engine-roa-contract-seed-builders.ts';

export const newInvestmentProposalContract: RoAModuleContract = systemContract({
  id: 'new_investment_proposal',
  title: 'New Investment Proposal',
  description:
    'Recommends a new investment based on objectives, time horizon, risk profile, costs and product suitability.',
  category: 'Investments',
  input: {
    sources: [
      ...clientSnapshotSources,
      {
        id: 'investment_ina',
        label: 'Investment needs analysis',
        type: 'fna',
        required: false,
        sourcePath: 'fnaSummaries.investment',
      },
      {
        id: 'fund_fact_sheets',
        label: 'Fund fact sheets or proposal',
        type: 'documentUpload',
        required: true,
      },
    ],
    gatheringMethods: ['clientProfile', 'fna', 'typed', 'upload'],
  },
  formSchema: {
    sections: [
      {
        id: 'investment',
        title: 'Investment',
        fields: [
          {
            key: 'investment_amount',
            label: 'Investment Amount',
            type: 'currency',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'platform',
            label: 'Investment Platform',
            type: 'select',
            required: true,
            source: 'moduleInput',
            options: ['Allan Gray', 'Coronation', 'Sygnia', 'Momentum', 'Discovery', 'Other'],
          },
          {
            key: 'recommended_funds',
            label: 'Recommended Funds',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
          {
            key: 'risk_profile',
            label: 'Risk Profile',
            type: 'select',
            required: true,
            source: 'clientSnapshot',
            options: [
              'Conservative',
              'Moderate Conservative',
              'Moderate',
              'Moderate Aggressive',
              'Aggressive',
            ],
          },
          {
            key: 'time_horizon',
            label: 'Time Horizon',
            type: 'select',
            required: true,
            source: 'moduleInput',
            options: ['Less than 2 years', '2-5 years', '5-10 years', 'More than 10 years'],
          },
          {
            key: 'total_annual_fee',
            label: 'Total Annual Fee',
            type: 'percentage',
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
    normalizedKey: 'newInvestmentProposal',
    fields: [
      { key: 'investmentAmount', label: 'Investment amount', type: 'number', required: true },
      { key: 'platform', label: 'Platform', type: 'string', required: true },
      { key: 'recommendedFunds', label: 'Recommended funds', type: 'string', required: true },
      { key: 'rationale', label: 'Rationale', type: 'string', required: true },
    ],
  },
  validation: {
    requiredFields: [
      'investment_amount',
      'platform',
      'recommended_funds',
      'risk_profile',
      'time_horizon',
      'total_annual_fee',
      'rationale',
    ],
    rules: [
      {
        id: 'risk_match',
        severity: 'blocking',
        message:
          'Investment selection must be consistent with the captured risk profile and time horizon.',
      },
      {
        id: 'fees_disclosed',
        severity: 'blocking',
        message: 'All product, advice and platform fees must be recorded.',
      },
    ],
  },
  evidence: {
    requirements: [
      {
        id: 'investment_proposal',
        label: 'Investment proposal or fund fact sheets',
        type: 'comparison',
        required: true,
        acceptedMimeTypes: ['application/pdf'],
      },
      {
        id: 'client_instruction',
        label: 'Client investment instruction',
        type: 'client_instruction',
        required: false,
      },
    ],
  },
  documentSections: [
    {
      id: 'objectives',
      title: 'Objectives and Time Horizon',
      purpose: 'Record objectives, investment term and liquidity needs.',
      order: 10,
      required: true,
    },
    {
      id: 'recommendation',
      title: 'Investment Recommendation',
      purpose: 'Explain product, platform, funds and allocation.',
      order: 20,
      required: true,
    },
    {
      id: 'fees_risks',
      title: 'Fees and Investment Risks',
      purpose: 'Disclose costs, volatility, currency and market risks.',
      order: 30,
      required: true,
    },
  ],
  disclosures: [
    'Investment values can rise and fall and past performance is not a reliable guide to future returns.',
    'Fees, taxes and currency movements can materially affect investment outcomes.',
  ],
  compileOrder: ['objectives', 'recommendation', 'fees_risks', 'disclosures'],
});
