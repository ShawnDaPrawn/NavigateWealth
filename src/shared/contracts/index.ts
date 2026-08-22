/**
 * Runtime contracts (Stage A / F8) — the runtime half of `src/shared/types/`.
 *
 * Types there are erased at runtime; schemas here are checked at the boundary.
 * Each schema is pinned to its interface by a compile-time equality assertion,
 * so the two cannot drift.
 *
 * Adoption is deliberately incremental, and ratcheted the OTHER WAY ROUND from
 * every other baseline in this repo: `.contract-coverage-baseline` floors the
 * number of validated call sites, and CI fails when that number FALLS. Every
 * other ratchet here caps a backlog and fails when a count rises; this one
 * protects a gain and fails when a count drops. See `contract-coverage.test.ts`.
 *
 * This comment previously described that ratchet as if it existed. It did not —
 * no baseline file, nothing in CI, and no call site anywhere in the codebase
 * used this module. A docblock asserting a gate that is not there is the same
 * trap `security.middleware.ts` was deleted for, so the ratchet was built
 * rather than the sentence softened.
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
