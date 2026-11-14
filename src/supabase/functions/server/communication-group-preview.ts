/**
 * Live preview of a group's rules (Client Management › Groups editor):
 * how many active clients the filters match right now, and the first few,
 * without saving anything. Runs the same matcher the saved-group
 * recalculation uses (`group-matcher.ts`) over the same client set
 * (`fetchMatcherClients`: active, not deleted or suspended).
 */

import { fetchMatcherClients } from './communication-repo.ts';
import { clientMatchesFilters } from './group-matcher.ts';
import type { GroupFilterConfig } from './communication-types.ts';

/** How many matching clients the preview lists (the count covers all of them). */
export const GROUP_PREVIEW_LIMIT = 50;

export interface GroupPreview {
  count: number;
  clients: Array<{ id: string; name: string; email: string }>;
}

export async function previewGroupMembers(filterConfig: GroupFilterConfig): Promise<GroupPreview> {
  const clients = await fetchMatcherClients();
  const matched = clients.filter((client) => clientMatchesFilters(client, filterConfig));
  return {
    count: matched.length,
    clients: matched.slice(0, GROUP_PREVIEW_LIMIT).map((client) => ({
      id: client.id,
      name: `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() || 'Unnamed client',
      email: client.email ?? '',
    })),
  };
}
