/**
 * Honeycomb Integration — Service Layer
 *
 * Per Guidelines §4.2: Services own business logic, KV access patterns,
 * and cross-entity consistency. Route handlers are thin dispatchers
 * that call into this service.
 *
 * WHAT THIS FILE IS NOW
 * ---------------------
 * It was 1,613 lines covering four phases of the Honeycomb API plus a
 * compliance dashboard computed on top of them. The implementations now live
 * per concern in the modules re-exported below.
 *
 * This file stays the entry point rather than becoming redundant: all five
 * honeycomb route files reach the service as `import * as service from
 * './honeycomb-service.ts'`, so this module IS the interface. The re-export
 * list is explicit rather than `export *`, so the public surface is the same
 * set of names it was before the split — helpers that had to become module
 * exports to cross a file boundary do not leak into it.
 *
 * `__tests__/honeycomb-service-surface.test.ts` checks that every name the
 * route files call is still exported here, reading the list off those files
 * rather than keeping its own copy.
 */

export { extractId, isRealIdNumber } from './honeycomb-client.ts';

export { logActivity } from './honeycomb-activity.ts';

export {
  runBankVerification,
  runConsumerCredit,
  runConsumerTrace,
  runDebtReviewEnquiry,
  runIdvNoPhoto,
  runIdvWithPhoto,
  searchSanctions,
} from './honeycomb-checks.ts';

export {
  runBestKnownAddress,
  runCipcSearch,
  runCustomScreening,
  runDirectorEnquiry,
  searchEnforcementActions,
  searchLegalAListing,
} from './honeycomb-searches.ts';

export {
  getAllCheckHistory,
  getCheckHistory,
  runCddReport,
  runIncomePredictor,
  runLifestyleAudit,
  runTendersBlue,
} from './honeycomb-reports.ts';

export { runBulkIdv } from './honeycomb-bulk.ts';

export { getComplianceDashboard } from './honeycomb-compliance.ts';
