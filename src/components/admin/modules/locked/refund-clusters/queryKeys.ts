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
} as const;
