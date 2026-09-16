/**
 * Portal automation repository
 * ============================
 *
 * The three KV namespaces the navigator agent reads and writes. Added when the
 * agent landed, rather than reaching past the layer into `kv_store` the way the
 * older portal modules do — the `kv-direct-access` ratchet exists to stop
 * exactly that, and new code has no excuse to add to the pile.
 *
 * `portal-playbook:` is new here. The other two already existed; this file
 * gives them one typed definition each so the key strings stop being repeated
 * as template literals at every call site.
 */

import { createKvRepository } from './kv-repository.ts';
import type {
  PortalAgentPlaybook,
  PortalConnectionRecord,
  PortalSyncJob,
} from '../integrations-portal-types.ts';
import type { KvProvider } from '../integrations-types.ts';

/**
 * Recorded navigator steps, one record per provider + product category.
 *
 * The id is `${providerId}:${categoryId}` — a playbook is only valid for the
 * journey it was recorded on, and the same provider's retirement and risk
 * portals are usually different journeys.
 */
export const PORTAL_PLAYBOOK_NAMESPACE = 'portal-playbook:';

export const portalPlaybooks = createKvRepository<PortalAgentPlaybook>(PORTAL_PLAYBOOK_NAMESPACE);

/** One queued or running portal automation job, keyed by job id. */
export const PORTAL_JOB_NAMESPACE = 'portal-job:';

export const portalJobs = createKvRepository<PortalSyncJob>(PORTAL_JOB_NAMESPACE);

/** The product provider record, keyed by provider id. */
export const PROVIDER_NAMESPACE = 'provider:';

export const providers = createKvRepository<KvProvider>(PROVIDER_NAMESPACE);

/**
 * How many navigator decisions one job has spent.
 *
 * The navigator calls a paid model once per browser action, so a loop that
 * fails to converge is a loop that spends. The per-stage step budget bounds one
 * stage; this bounds the whole job, across every policy in its queue, which is
 * the number that actually shows up on a bill.
 */
export const PORTAL_AGENT_BUDGET_NAMESPACE = 'portal-agent-budget:';

export interface PortalAgentBudget {
  jobId: string;
  decisions: number;
  updatedAt: string;
}

export const portalAgentBudgets = createKvRepository<PortalAgentBudget>(
  PORTAL_AGENT_BUDGET_NAMESPACE,
);

/**
 * The outcome of the last sign-in test, one record per provider + credential
 * profile.
 *
 * Not per category, because credentials are not per category — the same
 * username and password open the same front door whichever product the flow is
 * configured for. The id is `${providerId}:${credentialProfileId}`.
 */
export const PORTAL_CONNECTION_NAMESPACE = 'portal-connection:';

export const portalConnections = createKvRepository<PortalConnectionRecord>(
  PORTAL_CONNECTION_NAMESPACE,
);

/**
 * The "which job is current" pointer, one per provider + category.
 *
 * It lives inside the `portal-job:` namespace (`portal-job:latest:…`), so a
 * plain `portalJobs.get` would return a pointer typed as a whole job. Giving
 * the pointers their own repository keeps that shape honest.
 */
export const PORTAL_JOB_POINTER_NAMESPACE = 'portal-job:latest:';

export interface PortalJobPointer {
  jobId: string;
  updatedAt: string;
}

export const portalJobPointers = createKvRepository<PortalJobPointer>(PORTAL_JOB_POINTER_NAMESPACE);
