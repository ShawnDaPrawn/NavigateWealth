/**
 * Runtime contracts (Stage A / F8) — the runtime half of `src/shared/types/`.
 *
 * Types there are erased at runtime; schemas here are checked at the boundary.
 * Each schema is pinned to its interface by a compile-time equality assertion,
 * so the two cannot drift.
 *
 * Adoption is deliberately incremental: `.contract-coverage-baseline` ratchets
 * the number of validated call sites upward. See the enhancement plan §4.
 */
export {
  parseContract,
  parseContractStrict,
  setContractViolationReporter,
  resetContractViolationReporter,
  type ContractContext,
  type ContractViolationReporter,
} from './parse';
export { BaseClientSchema, AccountStatusSchema } from './base-client';
