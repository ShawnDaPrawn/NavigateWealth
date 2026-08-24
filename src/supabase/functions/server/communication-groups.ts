/**
 * Contact groups, including the synthetic all-clients group and newsletter sync.
 *
 * Split out of `communication-service.ts` (1,387 lines), a stateless class whose
 * `this.` only ever called a sibling method. The class remains as a facade with
 * field assignments; the logger keeps its channel name.
 */
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';
import { ValidationError } from './error.middleware.ts';
import * as repo from './communication-repo.ts';
import type { Group, GroupCreate } from './communication-types.ts';
import { splitFullName } from './communication-service-helpers.ts';
import { getAllClients } from './communication-messaging.ts';

const log = createModuleLogger('communication-service');

export async function getAllGroups(): Promise<Group[]> {
  const customGroups = await repo.getAllGroups();

  // ── Auto-maintenance: recalc stale dynamic groups + sync provider groups ──
  const RECALC_STALE_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  const dynamicGroups = customGroups.filter((g) => {
    if (!g.filterConfig) return false;
    return Object.values(g.filterConfig).some((v) =>
      Array.isArray(v) ? v.length > 0 : v !== undefined,
    );
  });

  const needsRecalc =
    dynamicGroups.length > 0 &&
    dynamicGroups.some((g) => {
      const updatedAt = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
      return now - updatedAt > RECALC_STALE_MS;
    });

  // Auto provider groups are seeded/refreshed on their own cadence so they
  // appear even before any other dynamic group exists.
  let providerSyncStale = false;
  try {
    const { isSyncStale } = await import('./provider-group-service.ts');
    providerSyncStale = await isSyncStale(RECALC_STALE_MS);
  } catch (err) {
    log.warn('Failed to check provider-group sync staleness', { error: String(err) });
  }

  if (needsRecalc || providerSyncStale) {
    try {
      log.info('Running communication group auto-maintenance', {
        needsRecalc,
        providerSyncStale,
        dynamicGroupCount: dynamicGroups.length,
      });
      const { fetchMatcherClients, recalculateAllGroupMemberships } =
        await import('./communication-repo.ts');
      const { syncAutoProviderGroups } = await import('./provider-group-service.ts');

      // Fetch the (expensive) client set once and reuse it for both passes.
      const matcherClients = await fetchMatcherClients();
      await syncAutoProviderGroups(matcherClients);
      await recalculateAllGroupMemberships(matcherClients);

      // Re-fetch after maintenance so counts and new groups are included.
      const refreshed = await repo.getAllGroups();
      return _prependSystemGroup(refreshed);
    } catch (err) {
      log.error('Group auto-maintenance failed, returning current data', err as Error);
    }
  }

  return _prependSystemGroup(customGroups);
}

export async function _prependSystemGroup(customGroups: Group[]): Promise<Group[]> {
  // Count all clients for the system "All Clients" group
  let clientCount = 0;
  try {
    const allClients = await getAllClients();
    clientCount = allClients.length;
  } catch (err) {
    log.warn('Failed to count clients for All Clients group', { error: String(err) });
  }

  // Prepend the built-in "All Clients" system group
  const allClientsGroup: Group = {
    id: 'sys_all',
    name: 'All Clients',
    description: 'Every client currently on the platform',
    type: 'system',
    clientIds: [],
    clientCount,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  };

  return [allClientsGroup, ...customGroups];
}

export async function createGroup(data: GroupCreate): Promise<Group> {
  log.info('Creating group', {
    groupName: data.name,
    filterConfig: data.filterConfig,
    clientIds: data.clientIds,
  });

  const group = await repo.createGroup(data);

  log.success('Group created', {
    groupId: group.id,
    storedFilterConfig: group.filterConfig,
  });

  return group;
}

export async function updateGroup(groupId: string, updates: Partial<Group>): Promise<Group> {
  // Prevent modification of system groups
  if (groupId === 'sys_all') {
    throw new ValidationError('System groups cannot be modified');
  }
  if (groupId.startsWith('sys_provider_')) {
    throw new ValidationError('Auto-generated provider groups cannot be modified');
  }

  log.info('Updating group', {
    groupId,
    updates: {
      name: updates.name,
      filterConfig: updates.filterConfig,
      clientIds: updates.clientIds,
    },
  });

  const previousGroup =
    groupId === 'sys_newsletter_contacts' && updates.externalContacts !== undefined
      ? await repo.getGroupById(groupId)
      : null;

  const group = await repo.updateGroup(groupId, updates);

  if (groupId === 'sys_newsletter_contacts' && updates.externalContacts !== undefined) {
    await syncNewsletterSubscribersFromGroupUpdate(
      previousGroup?.externalContacts || [],
      group.externalContacts || [],
    );
  }

  log.success('Group updated', {
    groupId,
    updatedFilterConfig: group.filterConfig,
  });

  return group;
}

export async function deleteGroup(groupId: string): Promise<void> {
  // Prevent deletion of system groups
  if (groupId === 'sys_all') {
    throw new ValidationError('System groups cannot be deleted');
  }
  if (groupId.startsWith('sys_provider_')) {
    throw new ValidationError('Auto-generated provider groups cannot be deleted');
  }

  await repo.deleteGroup(groupId);

  log.warn('Group deleted', { groupId });
}

export async function syncNewsletterSubscribersFromGroupUpdate(
  previousContacts: Array<{ email: string; name?: string; subscribedAt?: string }>,
  nextContacts: Array<{ email: string; name?: string; subscribedAt?: string }>,
): Promise<void> {
  const now = new Date().toISOString();

  const previousMap = new Map<string, { email: string; name?: string; subscribedAt?: string }>();
  const nextMap = new Map<string, { email: string; name?: string; subscribedAt?: string }>();

  for (const contact of previousContacts) {
    const email = (contact.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    previousMap.set(email, { ...contact, email });
  }

  for (const contact of nextContacts) {
    const email = (contact.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    nextMap.set(email, { ...contact, email });
  }

  for (const [email] of previousMap) {
    if (nextMap.has(email)) continue;
    const key = `newsletter:${email}`;
    const existing = (await kv.get(key)) as Record<string, unknown> | null;
    if (!existing) continue;

    await kv.set(key, {
      ...existing,
      email,
      active: false,
      unsubscribedAt: now,
      removedBy: 'admin',
    });
  }

  for (const [email, contact] of nextMap) {
    const key = `newsletter:${email}`;
    const existing = (await kv.get(key)) as Record<string, unknown> | null;
    const split = splitFullName(contact.name);
    const existingFirstName = typeof existing?.firstName === 'string' ? existing.firstName : '';
    const existingSurname = typeof existing?.surname === 'string' ? existing.surname : '';
    const resolvedFirstName = split.firstName || existingFirstName;
    const resolvedSurname = split.surname || existingSurname;
    const resolvedName =
      contact.name?.trim() ||
      `${resolvedFirstName} ${resolvedSurname}`.trim() ||
      (typeof existing?.name === 'string' ? existing.name : '');

    await kv.set(key, {
      ...(existing || {}),
      email,
      firstName: resolvedFirstName,
      surname: resolvedSurname,
      name: resolvedName,
      source: typeof existing?.source === 'string' ? existing.source : 'Admin Manual Upload',
      subscribedAt:
        (typeof existing?.subscribedAt === 'string' ? existing.subscribedAt : undefined) ||
        contact.subscribedAt ||
        now,
      confirmedAt:
        (typeof existing?.confirmedAt === 'string' ? existing.confirmedAt : undefined) || now,
      confirmed: true,
      active: true,
      unsubscribedAt: null,
      removedBy: null,
    });
  }
}
