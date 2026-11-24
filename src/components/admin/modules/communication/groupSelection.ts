/**
 * Client-group selection for the Communication wizard.
 *
 * An adviser can send one message to several groups at once. The draft keeps
 * them in `selectedGroups`; `selectedGroup` is still set to the first one so
 * older readers (and campaigns saved before multi-select) keep working. Read
 * the selection through `getDraftGroups`, never either field directly.
 */
import type { Client, ClientGroup, CommunicationDraft } from './types';

/** The system group that means "every client"; it carries no clientIds. */
export const ALL_CLIENTS_GROUP_ID = 'sys_all';

export function getDraftGroups(
  draft: Pick<CommunicationDraft, 'selectedGroup' | 'selectedGroups'>,
): ClientGroup[] {
  if (draft.selectedGroups && draft.selectedGroups.length > 0) return draft.selectedGroups;
  return draft.selectedGroup ? [draft.selectedGroup] : [];
}

/** Adds the group if it is not selected, removes it if it is. */
export function toggleGroup(selected: ClientGroup[], group: ClientGroup): ClientGroup[] {
  return selected.some((g) => g.id === group.id)
    ? selected.filter((g) => g.id !== group.id)
    : [...selected, group];
}

/**
 * How many people the selection reaches, counting a client who sits in two of
 * the groups once — the server de-duplicates the same way when it sends.
 *
 * A single group reports its own `clientCount`, exactly as before multi-select.
 */
export function estimateGroupRecipients(groups: ClientGroup[]): number {
  if (groups.length === 0) return 0;
  if (groups.length === 1) return groups[0].clientCount || 0;

  const externalEmails = new Set<string>();
  for (const group of groups) {
    for (const contact of group.externalContacts || []) {
      const key = contact.email?.trim().toLowerCase();
      if (key) externalEmails.add(key);
    }
  }

  const allClients = groups.find((g) => g.id === ALL_CLIENTS_GROUP_ID);
  if (allClients) return (allClients.clientCount || 0) + externalEmails.size;

  const clientIds = new Set<string>();
  for (const group of groups) {
    for (const id of group.clientIds || []) clientIds.add(id);
  }
  return clientIds.size + externalEmails.size;
}

/** The known clients the selection covers, de-duplicated, in client-list order. */
export function clientsInGroups(groups: ClientGroup[], clients: Client[]): Client[] {
  if (groups.some((g) => g.id === ALL_CLIENTS_GROUP_ID)) return clients;
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group.clientIds || []) ids.add(id);
  }
  return clients.filter((c) => ids.has(c.id));
}

/** The draft fields to write for a given group selection. */
export function groupSelectionUpdate(
  groups: ClientGroup[],
  clients: Client[],
): Pick<CommunicationDraft, 'selectedGroups' | 'selectedGroup' | 'selectedRecipients'> {
  return {
    selectedGroups: groups,
    selectedGroup: groups[0],
    selectedRecipients: clientsInGroups(groups, clients),
  };
}
