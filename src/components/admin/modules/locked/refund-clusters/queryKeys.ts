/**
 * Refund Clusters — React Query key factory.
 *
 * Deliberately local to the locked module (NOT in utils/queryKeys.ts):
 * the Locked module is a standalone unit that must stay deletable without
 * touching shared registries. See ../../README.md.
 */

export const refundClusterKeys = {
  all: ['refund-clusters'] as const,
  lists: () => [...refundClusterKeys.all, 'list'] as const,
  details: () => [...refundClusterKeys.all, 'detail'] as const,
  detail: (clusterId: string) => [...refundClusterKeys.details(), clusterId] as const,
  documents: (entityId: string) => [...refundClusterKeys.all, 'documents', entityId] as const,
  transactions: (entityId: string) => [...refundClusterKeys.all, 'transactions', entityId] as const,
  /** Child of `transactions` so transaction invalidations refresh it too. */
  ledger: (entityId: string) => [...refundClusterKeys.transactions(entityId), 'ledger'] as const,
  submissions: (entityId: string) => [...refundClusterKeys.all, 'submissions', entityId] as const,
  managers: (clusterId: string) => [...refundClusterKeys.all, 'managers', clusterId] as const,
} as const;
