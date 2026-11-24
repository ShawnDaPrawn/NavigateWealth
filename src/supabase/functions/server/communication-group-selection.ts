/**
 * Group selection for a campaign
 * ==============================
 *
 * A campaign sent to client groups may target ONE group (the original shape,
 * `selectedGroup`) or SEVERAL (`selectedGroups`, added so an adviser can send
 * one message to e.g. "Allan Gray Clients" + "Newsletter Contacts" at once).
 *
 * Campaigns persisted before `selectedGroups` existed carry only
 * `selectedGroup`, and new campaigns still write it (as the first group) so
 * older readers keep working. Every recipient resolver must read the groups
 * through this helper rather than touching either field directly, otherwise a
 * multi-group campaign silently goes to its first group only.
 */

export interface CampaignGroupRef {
  id: string;
  type?: string;
  name?: string;
  [key: string]: unknown;
}

interface GroupSelectionSource {
  selectedGroup?: CampaignGroupRef | null;
  selectedGroups?: CampaignGroupRef[] | null;
}

/** The distinct groups a campaign targets, in selection order. */
export function getCampaignGroups(source: GroupSelectionSource): CampaignGroupRef[] {
  const candidates =
    Array.isArray(source.selectedGroups) && source.selectedGroups.length > 0
      ? source.selectedGroups
      : source.selectedGroup
        ? [source.selectedGroup]
        : [];

  const seen = new Set<string>();
  const groups: CampaignGroupRef[] = [];
  for (const group of candidates) {
    if (!group || typeof group.id !== 'string' || !group.id || seen.has(group.id)) continue;
    seen.add(group.id);
    groups.push(group);
  }
  return groups;
}

/** Group names joined for display and search, e.g. "Allan Gray Clients, Newsletter". */
export function getCampaignGroupLabel(source: GroupSelectionSource): string {
  return getCampaignGroups(source)
    .map((g) => (typeof g.name === 'string' ? g.name : ''))
    .filter(Boolean)
    .join(', ');
}
