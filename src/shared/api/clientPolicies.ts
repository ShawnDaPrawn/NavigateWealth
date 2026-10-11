/**
 * Client policies — one cached read shared by every screen that shows them.
 *
 * The client Overview tab and each of the seven Policies-tab sections used to
 * fetch policies on their own, uncached, every time they mounted: up to eight
 * Edge Function calls (~2 s each from South Africa) for data the server reads
 * from ONE KV row (`policies:client:{id}`) and merely filters by category.
 * They now share one query per client and filter here, with the server's own
 * category rules.
 *
 * FRESHNESS — policy values are the figures advisers act on, so:
 * - `staleTime: 0`. Whatever is cached is shown at once, and every screen that
 *   opens refetches it in the background. A value changed elsewhere (a portal
 *   refresh, a bulk upload, a colleague) is on screen within one request.
 * - Every write in the app calls `invalidateClientPolicies`, so a screen that
 *   is already open updates as soon as the write returns.
 */
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/utils/api';
import { clientGoalKeys, clientPolicyKeys, policySchemaKeys } from '@/utils/queryKeys';

/** The fields every policy row carries; callers narrow to their own row type. */
export interface ClientPolicyRow {
  id: string;
  categoryId?: string;
  archived?: boolean;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * GET `/integrations/policies?clientId=` — every ACTIVE policy for the client,
 * or with `archived`, every ARCHIVED one (the server's `includeArchived=true`
 * returns archived rows only).
 */
export async function fetchClientPolicies(
  clientId: string,
  archived = false,
): Promise<ClientPolicyRow[]> {
  const query = `clientId=${encodeURIComponent(clientId)}${archived ? '&includeArchived=true' : ''}`;
  const data = await api.get<{ policies?: ClientPolicyRow[] }>(`/integrations/policies?${query}`);
  return data?.policies ?? [];
}

export function clientPoliciesQueryOptions(clientId: string, options: { archived?: boolean } = {}) {
  const archived = options.archived ?? false;
  return {
    queryKey: clientPolicyKeys.list(clientId, archived),
    queryFn: () => fetchClientPolicies(clientId, archived),
    staleTime: 0,
  };
}

/** Sub-categories the server folds into a parent when filtering by it. */
const CATEGORY_ALIASES: Record<string, readonly string[]> = {
  retirement_planning: [
    'retirement_planning',
    'retirement_pre',
    'retirement_post',
    'retirement_post_fixed',
  ],
  investments: ['investments', 'investments_voluntary', 'investments_guaranteed'],
};

/**
 * The policies `/integrations/policies?clientId=&categoryId=` would return.
 *
 * Mirrors the server exactly (`integrations-policy-routes.ts`, GET /policies),
 * including that `employee_benefits` is NOT widened to its sub-categories —
 * changing that is a server decision, not something a client-side filter should
 * quietly differ on.
 */
export function filterPoliciesForCategory<T extends { categoryId?: string }>(
  policies: readonly T[],
  categoryId: string,
): T[] {
  // No category is no filter — the server's `if (categoryId)`.
  if (!categoryId) return [...policies];
  const accepted = CATEGORY_ALIASES[categoryId] ?? [categoryId];
  return policies.filter((policy) => accepted.includes(policy.categoryId ?? ''));
}

/** Call after ANY write that can change a client's policies. */
export function invalidateClientPolicies(queryClient: QueryClient, clientId: string) {
  return queryClient.invalidateQueries({ queryKey: clientPolicyKeys.client(clientId) });
}

/** Call after a bulk write that can change many clients' policies at once. */
export function invalidateAllClientPolicies(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: clientPolicyKeys.all });
}

// ── Schemas ─────────────────────────────────────────────────────────────────

/** A column definition from a category's policy schema. */
export interface PolicySchemaFieldRow {
  id: string;
  [key: string]: unknown;
}

/**
 * GET `/integrations/schemas/batch` — every category's schema in one call (the
 * stored override if there is one, else the default — the same rule as the
 * per-category route). Categories with no fields are left out.
 */
export async function fetchPolicySchemas(): Promise<Record<string, PolicySchemaFieldRow[]>> {
  const data = await api.get<{ schemas?: Record<string, { fields?: PolicySchemaFieldRow[] }> }>(
    '/integrations/schemas/batch',
  );
  const result: Record<string, PolicySchemaFieldRow[]> = {};
  for (const [categoryId, schema] of Object.entries(data?.schemas ?? {})) {
    if (Array.isArray(schema?.fields) && schema.fields.length > 0) {
      result[categoryId] = schema.fields;
    }
  }
  return result;
}

/** Schemas are configuration: cached for 10 minutes, invalidated on edit. */
export function policySchemasQueryOptions() {
  return {
    queryKey: policySchemaKeys.batch(),
    queryFn: fetchPolicySchemas,
    staleTime: 10 * 60 * 1000,
  };
}

/** Call after editing any category's schema. */
export function invalidatePolicySchemas(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: policySchemaKeys.all });
}

// ── Goals ───────────────────────────────────────────────────────────────────

export function clientGoalsQueryOptions<TGoal>(clientId: string) {
  return {
    queryKey: clientGoalKeys.client(clientId),
    queryFn: async (): Promise<TGoal[]> => {
      const data = await api.get<{ goals?: TGoal[] }>(`/goals/${encodeURIComponent(clientId)}`);
      return data?.goals ?? [];
    },
    staleTime: 0,
  };
}

/** Call after saving a client's goals. */
export function invalidateClientGoals(queryClient: QueryClient, clientId: string) {
  return queryClient.invalidateQueries({ queryKey: clientGoalKeys.client(clientId) });
}
