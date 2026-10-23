/**
 * advice-engine-roa-default-contracts.ts — seeded RoA module contract data
 * (Phase 7 max-lines split; the per-contract seeds and their builders live in
 * the advice-engine-roa-contract-seed-* siblings). Assembly order is the
 * contract id order pinned by advice-engine-roa-contract-types.test.ts.
 */
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import { newLifeAssuranceProposalContract } from './advice-engine-roa-contract-seed-life-proposal.ts';
import { lifeInsuranceComparisonContract } from './advice-engine-roa-contract-seed-life-comparison.ts';
import { newInvestmentProposalContract } from './advice-engine-roa-contract-seed-investment-proposal.ts';
import { investmentReplacementProposalContract } from './advice-engine-roa-contract-seed-investment-replacement.ts';
import { newRetirementProposalContract } from './advice-engine-roa-contract-seed-retirement-proposal.ts';
import { section14TransferProposalContract } from './advice-engine-roa-contract-seed-section14-transfer.ts';

export {
  SYSTEM_USER,
  ROA_MODULE_CONTRACT_SCHEMA_FORMAT,
  deriveConversationFromContract,
} from './advice-engine-roa-contract-seed-builders.ts';

export const DEFAULT_ROA_MODULE_CONTRACTS: RoAModuleContract[] = [
  newLifeAssuranceProposalContract,
  lifeInsuranceComparisonContract,
  newInvestmentProposalContract,
  investmentReplacementProposalContract,
  newRetirementProposalContract,
  section14TransferProposalContract,
];
