import {
  BROKERAGE_COLLECTION_ID,
  type AiAccess,
  type Collection,
  type CredentialKind,
  type VaultSummary,
} from '../../../shared/password-manager';
import { providers, type Broker } from '../../../shared/broker-operations';
import { needsAttention } from './ui';

export type VaultView = 'portals' | 'attention' | 'ai' | 'never';
/** `all`, `c:<collection id>` or `v:<view>`. */
export type VaultScope = 'all' | `c:${string}` | `v:${VaultView}`;

export const viewLabels: Record<VaultView, string> = {
  portals: 'Provider portals',
  attention: 'Needs attention',
  ai: 'Seen by an AI',
  never: 'Never shared',
};

const viewTests: Record<VaultView, (item: VaultSummary) => boolean> = {
  portals: (item) => !!item.portal,
  attention: needsAttention,
  ai: (item) => (item.seenByAi?.length ?? 0) > 0,
  never: (item) => item.aiAccess === 'never',
};

export const collectionOf = (item: VaultSummary) => item.collectionId || BROKERAGE_COLLECTION_ID;

export function inScope(item: VaultSummary, scope: VaultScope): boolean {
  if (scope === 'all') return true;
  if (scope.startsWith('c:')) return collectionOf(item) === scope.slice(2);
  return viewTests[scope.slice(2) as VaultView](item);
}

export function collectionName(collections: Collection[], collectionId: string): string {
  const found = collections.find((c) => c.id === collectionId);
  if (found) return found.name;
  return collectionId === BROKERAGE_COLLECTION_ID ? 'Brokerage' : 'Unknown collection';
}

export interface VaultFilter {
  scope: VaultScope;
  search: string;
  kind: CredentialKind | '';
  aiAccess: AiAccess | '';
}

export function filterItems(items: VaultSummary[], filter: VaultFilter, directory: Broker[]) {
  const needle = filter.search.trim().toLowerCase();
  return items.filter((item) => {
    if (!inScope(item, filter.scope)) return false;
    if (filter.kind && (item.kind ?? 'login') !== filter.kind) return false;
    if (filter.aiAccess && item.aiAccess !== filter.aiAccess) return false;
    if (!needle) return true;
    return [
      item.name,
      item.url,
      item.username,
      item.category,
      ...(item.tags ?? []),
      item.portal?.brokerage,
      item.portal?.purpose,
      item.portal && providers[item.portal.provider]?.name,
      ...(item.portal?.brokers.flatMap((b) => [
        b.code,
        directory.find((row) => row.id === b.brokerId)?.name,
      ]) ?? []),
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}

export function vaultStats(items: VaultSummary[]) {
  return {
    logins: items.length,
    attention: items.filter(needsAttention).length,
    readable: items.filter((item) => item.aiAccess === 'reveal').length,
    never: items.filter((item) => item.aiAccess === 'never').length,
  };
}
