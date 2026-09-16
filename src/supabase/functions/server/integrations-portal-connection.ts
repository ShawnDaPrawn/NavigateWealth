/**
 * Portal automation — is this provider actually connected?
 * ========================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * Until now nothing in the product answered that question. The provider list
 * showed "Last sync", which is about data, not about sign-in: a provider whose
 * password expired six weeks ago looked identical to one nobody had touched.
 * The only way to find out was to start a real sync run, which required the
 * provider to already have policies captured and which wrote to the book if it
 * worked. So the cheapest diagnostic cost the most.
 *
 * A connection test is the opposite: an empty-queue run that opens the login
 * page, signs in, clears whatever verification step the provider puts in the
 * way, and stops there. It can be run against a provider with zero policies —
 * which is exactly the moment an adviser is setting one up and most wants to
 * know whether the credentials are right.
 *
 * WHAT IS RECORDED, AND AT WHAT GRANULARITY
 * -----------------------------------------
 * Credentials belong to a provider and a credential profile; they are not
 * per-category. So the outcome is stored per provider + profile, and the
 * category is kept only as context (it is the flow that supplied the login URL
 * that was proven). A second category on the same provider inherits the result,
 * which is correct: the same username and password open the same front door.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM
 * -----------------------------------
 * `connected` means sign-in worked at `checkedAt`. It does not mean the
 * provider's policy pages are mapped, or that a sync will find anything. Those
 * are separate failures with separate surfaces, and rolling them into one
 * traffic light is how the old module ended up unable to say what was wrong.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import {
  loadPortalCredentialRecord,
  normalisePortalCredentialProfileId,
} from './integrations-portal-credentials.ts';
import { getPortalAutomationCategoryError } from './integrations-portal-guards.ts';
import { getPortalFlow } from './integrations-portal-flow.ts';
import {
  portalConnections,
  portalJobPointers,
  portalJobs,
  providers,
} from './repositories/portal-automation-repository.ts';
import type {
  PortalConnectionRecord,
  PortalConnectionState,
  PortalProviderConnection,
  PortalProviderFlow,
  PortalSyncJob,
} from './integrations-portal-types.ts';

const log = createModuleLogger('integrations-portal-connection');

/** Job statuses that mean the worker has stopped, one way or the other. */
const TERMINAL_STATUSES = new Set([
  'discovery_ready',
  'dry_run_ready',
  'staged',
  'failed',
  'cancelled',
]);

/** Statuses that mean a worker is still in the middle of the attempt. */
const IN_FLIGHT_STATUSES = new Set([
  'queued',
  'running',
  'waiting_for_otp',
  'discovering',
  'extracting',
  'staging',
]);

export function portalConnectionId(providerId: string, credentialProfileId: string): string {
  return `${providerId}:${credentialProfileId}`;
}

export function isPortalConnectionJobInFlight(job: PortalSyncJob): boolean {
  return IN_FLIGHT_STATUSES.has(job.status);
}

/**
 * Record what a finished connection test proved, if the job was one.
 *
 * Called from both job-status routes (the admin one and the worker one), which
 * is why it takes the already-updated job rather than doing its own read: the
 * caller has just written it, and a second read would race with itself.
 *
 * Never throws. A connection record is a convenience for the Connections
 * screen; losing one must not fail the status update that the worker depends
 * on to make progress.
 */
export async function recordPortalConnectionOutcome(job: PortalSyncJob): Promise<void> {
  if (!job.connectionTest) return;
  if (!TERMINAL_STATUSES.has(job.status)) return;

  const state: PortalConnectionRecord['state'] =
    job.status === 'failed' || job.status === 'cancelled' ? 'failed' : 'connected';

  const record: PortalConnectionRecord = {
    providerId: job.providerId,
    credentialProfileId: job.credentialProfileId,
    categoryId: job.categoryId,
    state,
    checkedAt: job.completedAt || job.updatedAt || new Date().toISOString(),
    message: (state === 'failed' ? job.error || job.message : job.message)?.slice(0, 500),
    jobId: job.id,
  };

  try {
    await portalConnections.put(
      portalConnectionId(job.providerId, job.credentialProfileId),
      record,
    );
  } catch (e) {
    log.error('Portal connection record write failed:', getErrMsg(e));
  }
}

export async function loadPortalConnectionRecord(
  providerId: string,
  credentialProfileId: string,
): Promise<PortalConnectionRecord | null> {
  try {
    return await portalConnections.get(portalConnectionId(providerId, credentialProfileId));
  } catch (e) {
    log.error('Portal connection record read failed:', getErrMsg(e));
    return null;
  }
}

/**
 * Collapse flow + credentials + last test into the single state the Connections
 * screen renders.
 *
 * Order matters and is not arbitrary. It is the order in which an adviser can
 * act: there is no point reporting "never tested" for a provider that has no
 * login URL to test against, and no point asking for a password on a provider
 * whose portal address is still unknown. Each state names the one next thing to
 * do.
 */
export function summarisePortalProviderConnection(input: {
  providerId: string;
  providerName: string;
  categoryId: string;
  flow: PortalProviderFlow;
  credentialProfileId: string;
  hasCredentials: boolean;
  credentialsUpdatedAt?: string;
  connection: PortalConnectionRecord | null;
  activeJob?: PortalSyncJob | null;
}): PortalProviderConnection {
  const loginUrl = String(input.flow.loginUrl || '').trim();

  const base = {
    providerId: input.providerId,
    providerName: input.providerName,
    categoryId: input.categoryId,
    credentialProfileId: input.credentialProfileId,
    loginUrl: loginUrl || undefined,
    hasCredentials: input.hasCredentials,
    credentialsUpdatedAt: input.credentialsUpdatedAt,
    lastCheckedAt: input.connection?.checkedAt,
  };

  if (input.activeJob?.connectionTest && isPortalConnectionJobInFlight(input.activeJob)) {
    return {
      ...base,
      state: 'testing',
      message: input.activeJob.message,
      activeJobId: input.activeJob.id,
    };
  }

  let state: PortalConnectionState;
  if (!loginUrl) state = 'no_login_url';
  else if (!input.hasCredentials) state = 'no_credentials';
  else if (!input.connection) state = 'untested';
  else state = input.connection.state;

  return {
    ...base,
    state,
    // Only a recorded test has anything worth saying. The other states are
    // fully described by the state itself, and a stale message next to them
    // reads as if it applied to the current state.
    message: state === 'connected' || state === 'failed' ? input.connection?.message : undefined,
  };
}

/** True when the stored credentials for this provider + profile are complete. */
export async function hasPortalCredentials(
  providerId: string,
  credentialProfileId: string,
): Promise<{ hasCredentials: boolean; updatedAt?: string }> {
  const record = await loadPortalCredentialRecord(providerId, credentialProfileId);
  return {
    hasCredentials: !!record?.username && !!record?.password,
    updatedAt: record?.updatedAt,
  };
}

/**
 * Build the whole Connections list.
 *
 * This lives here rather than in the route because assembling it needs four
 * namespaces, and doing that in the route would mean four more direct KV calls
 * in a module that already has too many. Reading through the repositories keeps
 * the access typed and the key strings in one place.
 */
export async function listPortalProviderConnections(): Promise<PortalProviderConnection[]> {
  const allProviders = await providers.listAll(
    'Connections screen: sign-in state for every provider in one view',
  );

  const connections: PortalProviderConnection[] = [];
  for (const provider of allProviders) {
    if (!provider?.id || typeof provider.name !== 'string') continue;

    // The first automation-eligible category is the one whose flow holds the
    // sign-in address. A provider with none has no portal to connect to, so it
    // is left out rather than shown as permanently broken.
    const categoryId = (provider.categoryIds || []).find(
      (id: string) => !getPortalAutomationCategoryError(id),
    );
    if (!categoryId) continue;

    const flow = await getPortalFlow(provider, provider.id, categoryId);
    const credentialProfileId = normalisePortalCredentialProfileId(
      String(flow.credentialProfiles[0]?.id || ''),
    );
    if (!credentialProfileId) continue;

    const { hasCredentials, updatedAt } = await hasPortalCredentials(
      provider.id,
      credentialProfileId,
    );
    const connection = await loadPortalConnectionRecord(provider.id, credentialProfileId);
    const pointer = await portalJobPointers.get(`${provider.id}:${categoryId}`);
    const activeJob = pointer?.jobId ? await portalJobs.get(pointer.jobId) : null;

    connections.push(
      summarisePortalProviderConnection({
        providerId: provider.id,
        providerName: provider.name || 'Unknown Provider',
        categoryId,
        flow,
        credentialProfileId,
        hasCredentials,
        credentialsUpdatedAt: updatedAt,
        connection,
        activeJob,
      }),
    );
  }

  connections.sort((a, b) => a.providerName.localeCompare(b.providerName));
  return connections;
}
