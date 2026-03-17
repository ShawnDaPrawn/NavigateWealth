/**
 * Communication Module — Repository Layer
 *
 * Data access for groups, campaigns, and group member caches.
 * §4.2 — Thin data access; business logic belongs in the service layer.
 * §5.4 — KV key naming: communication:{entity}:{id}
 */

import type { Group, GroupCreate, Campaign, CampaignCreate, CachedRecipient } from './communication-types.ts';
import * as kv from './kv_store.tsx';
import { recalculateGroupMembership, recalculateSingleGroupMembership } from './group-matcher.ts';
import type { MatcherClient } from './group-matcher.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('communication-repo');

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Helper for in-memory pagination (since KV doesn't support it natively yet)
function paginate<T>(items: T[], options?: PaginationOptions): PaginatedResult<T> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const total = items.length;
  const data = items.slice(offset, offset + limit);
  return { data, total, limit, offset };
}

// ============================================================================
// GROUPS
// ============================================================================

export async function getGroups(options?: PaginationOptions): Promise<PaginatedResult<Group>> {
  const allGroups = await kv.getByPrefix('communication:groups:');
  allGroups.sort((a: Group, b: Group) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return paginate(allGroups, options);
}

export async function getGroup(id: string): Promise<Group | null> {
  return await kv.get(`communication:groups:${id}`);
}

export async function saveGroup(group: Group): Promise<void> {
  await kv.set(`communication:groups:${group.id}`, group);
}

export async function deleteGroup(id: string): Promise<void> {
  await kv.del(`communication:groups:${id}`);
}

export async function getAllGroups(): Promise<Group[]> {
  const result = await getGroups();
  return result.data;
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  return await getGroup(groupId);
}

// Group Members Cache
export async function getGroupMembersCache(groupId: string): Promise<CachedRecipient[] | null> {
  return await kv.get(`communication:group_members:${groupId}`);
}

export async function setGroupMembersCache(groupId: string, members: CachedRecipient[]): Promise<void> {
  await kv.set(`communication:group_members:${groupId}`, members);
}

export async function deleteGroupMembersCache(groupId: string): Promise<void> {
  await kv.del(`communication:group_members:${groupId}`);
}

// ============================================================================
// CLIENT MATCHER HELPERS
// ============================================================================

/**
 * Fetch all active clients and convert them to the matcher format.
 * This is used by both createGroup/updateGroup recalculation and the
 * bulk recalculateAllGroupMemberships.
 */
export async function fetchMatcherClients(): Promise<MatcherClient[]> {
  const { ClientsService } = await import('./client-management-service.ts');
  const service = new ClientsService();
  const allClients = await service.getAllClients();

  // Exclude deleted/suspended — they should not be in communication groups (§12.3)
  const activeClients = allClients.filter((c: Record<string, unknown>) => !c.deleted && !c.suspended);

  log.info('Fetched matcher clients', {
    totalCount: allClients.length,
    activeCount: activeClients.length,
  });

  // Fetch policies to build product associations per client.
  // Policies are stored as arrays under `policies:client:{clientId}` (§5.4, integrations-types.ts).
  // The old code used `kv.getByPrefix('policy:')` which doesn't match `policies:client:*`.
  const clientIds = activeClients.map((c: Record<string, unknown>) => c.id as string);
  const policyKeys = clientIds.map(id => `policies:client:${id}`);

  let policyResults: unknown[] = [];
  try {
    if (policyKeys.length > 0) {
      policyResults = await kv.mget(policyKeys);
    }
  } catch (e) {
    log.error('Error fetching policies for matcher', e as Error);
  }

  // Build a map: clientId -> [{ provider, type }]
  const clientProductsMap = new Map<string, Array<{ provider?: string; type?: string }>>();
  for (let i = 0; i < clientIds.length; i++) {
    const raw = policyResults[i];
    if (!raw) continue;

    // Defensive unwrapping: the KV entry may be a flat array, an object with
    // a .policies array, or an object with a .value array (see client-portal-service.ts §647).
    let policyArray: Array<Record<string, unknown>> = [];
    if (Array.isArray(raw)) {
      policyArray = raw as Array<Record<string, unknown>>;
    } else if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.policies)) policyArray = obj.policies as Array<Record<string, unknown>>;
      else if (Array.isArray(obj.value)) policyArray = obj.value as Array<Record<string, unknown>>;
    }

    if (policyArray.length === 0) continue;

    const products: Array<{ provider?: string; type?: string }> = [];
    for (const p of policyArray) {
      // Skip archived policies
      if (p.archived === true) continue;
      products.push({
        provider: (p.providerName || p.provider || p.insurerName) as string | undefined,
        type: (p.categoryId || p.type || p.productType) as string | undefined,
      });
    }

    if (products.length > 0) {
      clientProductsMap.set(clientIds[i], products);
    }
  }

  log.info('Built client products map', {
    clientsWithProducts: clientProductsMap.size,
    sampleProducts: clientProductsMap.size > 0
      ? Array.from(clientProductsMap.entries()).slice(0, 3).map(([id, prods]) => ({
          clientId: id.slice(0, 8) + '…',
          products: prods.map(p => `${p.provider || '?'}/${p.type || '?'}`),
        }))
      : [],
  });

  return activeClients.map((c: Record<string, unknown>) => {
    const profile = (c.profile || {}) as Record<string, unknown>;

    // Extract fields — try flat first, then nested (handles both profile shapes)
    const pi = (profile.personalInformation || {}) as Record<string, unknown>;
    const ei = (profile.employmentInformation || {}) as Record<string, unknown>;
    const fi = (profile.financialInformation || {}) as Record<string, unknown>;
    const ai = (profile.additionalInformation || {}) as Record<string, unknown>;

    const gender = (profile.gender || pi.gender) as string | undefined;
    const nationality = (profile.nationality || pi.nationality) as string | undefined;
    const maritalStatus = (profile.maritalStatus || pi.maritalStatus) as string | undefined;
    const dateOfBirth = (profile.dateOfBirth || pi.dateOfBirth) as string | undefined;
    const occupation = (profile.occupation || ei.occupation) as string | undefined;
    const employmentStatus = (profile.employmentStatus || ei.employmentStatus) as string | undefined;
    const grossIncome = (profile.grossIncome || pi.grossIncome) as number | undefined;
    const netIncome = (profile.netIncome || pi.netIncome) as number | undefined;
    const netWorth = (profile.netWorth || fi.netWorth) as number | undefined;
    const dependants = (profile.dependants || ai.dependants) as number | undefined;
    const retirementAge = (profile.retirementAge || ai.retirementAge) as number | undefined;

    return {
      id: c.id as string,
      gender,
      country: nationality,
      maritalStatus,
      dateOfBirth,
      occupation,
      employmentStatus,
      income: grossIncome || netIncome,
      netWorth,
      dependants,
      retirementAge,
      age: dateOfBirth
        ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined,
      products: clientProductsMap.get(c.id as string) || [],
    };
  });
}

// ============================================================================
// GROUP CREATE / UPDATE (with auto-recalculation)
// ============================================================================

export async function createGroup(data: GroupCreate): Promise<Group> {
  const groupId = crypto.randomUUID();
  const externalContacts = data.externalContacts || [];
  const clientIds = data.clientIds || [];

  const group: Group = {
    id: groupId,
    name: data.name,
    description: data.description || '',
    color: data.color || undefined,
    type: data.type || 'custom',
    clientIds,
    externalContacts,
    filterConfig: data.filterConfig || {},
    clientCount: clientIds.length + externalContacts.length,
    createdBy: data.createdBy || 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // If the group has filter rules, auto-populate members now
  const hasFilters = group.filterConfig &&
    Object.values(group.filterConfig).some(v =>
      Array.isArray(v) ? v.length > 0 : v !== undefined
    );

  if (hasFilters) {
    try {
      log.info('Group has filters — recalculating membership on create', { groupId, groupName: group.name });
      const matcherClients = await fetchMatcherClients();
      const recalculated = recalculateSingleGroupMembership(group, matcherClients);
      group.clientIds = recalculated.clientIds || [];
      group.clientCount = (recalculated.clientIds?.length || 0) + externalContacts.length;
      log.success('Group membership calculated', { groupId, memberCount: group.clientCount });
    } catch (err) {
      log.error('Failed to recalculate group on create', err as Error);
      // Save with empty membership — user can manually recalculate later
    }
  }

  await saveGroup(group);
  return group;
}

export async function updateGroup(groupId: string, updates: Partial<Group>): Promise<Group> {
  const group = await getGroup(groupId);
  if (!group) {
    throw new Error('Group not found');
  }

  const clientIds = updates.clientIds !== undefined ? updates.clientIds : (group.clientIds || []);
  const externalContacts = updates.externalContacts !== undefined ? updates.externalContacts : (group.externalContacts || []);
  const filterConfig = updates.filterConfig !== undefined ? updates.filterConfig : (group.filterConfig || {});

  const updatedData = {
    ...updates,
    type: updates.type || group.type || 'custom',
    clientIds,
    externalContacts,
    filterConfig,
    clientCount: clientIds.length + externalContacts.length,
    updatedAt: new Date().toISOString()
  };

  Object.assign(group, updatedData);

  // If filters changed, recalculate membership
  const hasFilters = filterConfig &&
    Object.values(filterConfig).some(v =>
      Array.isArray(v) ? v.length > 0 : v !== undefined
    );

  if (hasFilters && updates.filterConfig !== undefined) {
    try {
      log.info('Group filters updated — recalculating membership', { groupId, groupName: group.name });
      const matcherClients = await fetchMatcherClients();
      const recalculated = recalculateSingleGroupMembership(group, matcherClients);
      group.clientIds = recalculated.clientIds || [];
      group.clientCount = (recalculated.clientIds?.length || 0) + externalContacts.length;
      log.success('Group membership recalculated', { groupId, memberCount: group.clientCount });
    } catch (err) {
      log.error('Failed to recalculate group on update', err as Error);
    }
  }

  await saveGroup(group);
  return group;
}

// ============================================================================
// CAMPAIGNS
// ============================================================================

export async function getCampaigns(options?: PaginationOptions): Promise<PaginatedResult<Campaign>> {
  const allCampaigns = await kv.getByPrefix('communication:campaigns:');
  allCampaigns.sort((a: Campaign, b: Campaign) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return paginate(allCampaigns, options);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  return await kv.get(`communication:campaigns:${id}`);
}

export async function saveCampaign(campaign: Campaign): Promise<void> {
  await kv.set(`communication:campaigns:${campaign.id}`, campaign);
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const result = await getCampaigns();
  return result.data;
}

/**
 * Create a campaign and persist ALL fields needed for sendCampaign.
 * The Campaign type requires: subject, bodyHtml, channel, recipientType,
 * selectedRecipients, selectedGroup, status, scheduling, etc.
 */
export async function createCampaign(data: CampaignCreate & { createdBy?: string }): Promise<Campaign> {
  const campaignId = data.id || crypto.randomUUID();

  const campaign: Campaign = {
    id: campaignId,
    subject: data.subject,
    bodyHtml: data.bodyHtml,
    channel: data.channel || 'email',
    recipientType: data.recipientType,
    selectedRecipients: data.selectedRecipients || [],
    selectedGroup: data.selectedGroup,
    status: 'draft',
    attachments: [],
    scheduling: data.scheduling || { type: 'immediate' },
    createdBy: data.createdBy || 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveCampaign(campaign);
  log.success('Campaign created', { campaignId, subject: campaign.subject, recipientType: campaign.recipientType });
  return campaign;
}

export async function getCampaignById(campaignId: string): Promise<Campaign | null> {
  return await getCampaign(campaignId);
}

export async function updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  Object.assign(campaign, updates, { updatedAt: new Date().toISOString() });
  await saveCampaign(campaign);
  return campaign;
}

// ============================================================================
// BULK GROUP RECALCULATION
// ============================================================================

/**
 * Recalculate membership for all dynamic groups based on current client data.
 * Accepts optional pre-fetched matcher clients for efficiency.
 */
export async function recalculateAllGroupMemberships(clients?: MatcherClient[]): Promise<void> {
  log.info('========== STARTING GROUP MEMBERSHIP RECALCULATION ==========');

  const allGroups = await getAllGroups();
  log.info('Fetched groups for recalculation', {
    groupCount: allGroups.length,
    groupNames: allGroups.map(g => g.name)
  });

  // If clients not provided, fetch them
  const clientList = clients || await fetchMatcherClients();

  log.info('Starting group matching', {
    groupCount: allGroups.length,
    clientCount: clientList.length,
  });

  const updatedGroups = recalculateGroupMembership(allGroups, clientList);

  // Save all updated groups
  for (const group of updatedGroups) {
    log.info('Saving updated group', {
      groupId: group.id,
      groupName: group.name,
      memberCount: group.clientCount,
    });
    await saveGroup(group as Group);
  }

  log.success('========== GROUP MEMBERSHIP RECALCULATION COMPLETE ==========');
}