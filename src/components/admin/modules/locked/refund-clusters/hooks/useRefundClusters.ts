/**
 * Refund Clusters — Query & Mutation Hooks
 *
 * §6 — Hooks are the only consumers of APIs.
 * §11.2 — React Query for all server state.
 */

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { refundClusterKeys } from '../queryKeys';
import { RefundClustersAPI } from '../api';
import type {
  BankAccountSlot,
  RefundEntityInput,
  RefundManagerInput,
  RefundTransactionInput,
  VatPeriodCategory,
} from '../types';

const STALE_TIME = 60 * 1000;

// ============================================================================
// Queries
// ============================================================================

export function useRefundClusters() {
  return useQuery({
    queryKey: refundClusterKeys.lists(),
    queryFn: () => RefundClustersAPI.listClusters(),
    staleTime: STALE_TIME,
  });
}

export function useRefundClusterDetail(clusterId: string | null) {
  return useQuery({
    queryKey: refundClusterKeys.detail(clusterId ?? ''),
    queryFn: () => RefundClustersAPI.getClusterDetail(clusterId!),
    enabled: !!clusterId,
    staleTime: STALE_TIME,
  });
}

/**
 * Details (cluster + entities) for several clusters at once, aligned to
 * `clusterIds` order. Shares the per-cluster detail cache keys with
 * {@link useRefundClusterDetail} so the manager overview and a single opened
 * cluster stay in sync.
 */
export function useClusterDetails(clusterIds: string[]) {
  return useQueries({
    queries: clusterIds.map((clusterId) => ({
      queryKey: refundClusterKeys.detail(clusterId),
      queryFn: () => RefundClustersAPI.getClusterDetail(clusterId),
      enabled: !!clusterId,
      staleTime: STALE_TIME,
    })),
  });
}

export function useEntityDocuments(clusterId: string, entityId: string | null) {
  return useQuery({
    queryKey: refundClusterKeys.documents(entityId ?? ''),
    queryFn: () => RefundClustersAPI.listDocuments(clusterId, entityId!),
    enabled: !!entityId,
    staleTime: STALE_TIME,
  });
}

// ============================================================================
// Cluster mutations
// ============================================================================

export function useCreateCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      vatPeriod: VatPeriodCategory | '';
      vatYearEndMonth?: number;
    }) => RefundClustersAPI.createCluster(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.lists() });
      toast.success('Refund cluster created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create cluster', { description: error.message });
    },
  });
}

export function useUpdateCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      clusterId: string;
      patch: {
        name?: string;
        description?: string;
        vatPeriod?: VatPeriodCategory | '';
        vatYearEndMonth?: number;
        archived?: boolean;
      };
    }) => RefundClustersAPI.updateCluster(input.clusterId, input.patch),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.lists() });
      qc.invalidateQueries({ queryKey: refundClusterKeys.detail(variables.clusterId) });
      toast.success('Cluster updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update cluster', { description: error.message });
    },
  });
}

export function useDeleteCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clusterId: string) => RefundClustersAPI.deleteCluster(clusterId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.all });
      toast.success('Cluster deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete cluster', { description: error.message });
    },
  });
}

// ============================================================================
// Entity mutations
// ============================================================================

export function useCreateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entity: RefundEntityInput }) =>
      RefundClustersAPI.createEntity(input.clusterId, input.entity),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.detail(variables.clusterId) });
      qc.invalidateQueries({ queryKey: refundClusterKeys.lists() });
      toast.success('Entity added');
    },
    onError: (error: Error) => {
      toast.error('Failed to add entity', { description: error.message });
    },
  });
}

export function useUpdateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; entity: RefundEntityInput }) =>
      RefundClustersAPI.updateEntity(input.clusterId, input.entityId, input.entity),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.detail(variables.clusterId) });
      toast.success('Entity updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update entity', { description: error.message });
    },
  });
}

export function useDeleteEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string }) =>
      RefundClustersAPI.deleteEntity(input.clusterId, input.entityId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.detail(variables.clusterId) });
      qc.invalidateQueries({ queryKey: refundClusterKeys.lists() });
      toast.success('Entity deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete entity', { description: error.message });
    },
  });
}

export function useRevealEfilingPassword() {
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string }) =>
      RefundClustersAPI.revealEfilingPassword(input.clusterId, input.entityId),
    onError: (error: Error) => {
      toast.error('Failed to reveal password', { description: error.message });
    },
  });
}

export function useRevealBankPassword() {
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; account: BankAccountSlot }) =>
      RefundClustersAPI.revealBankPassword(input.clusterId, input.entityId, input.account),
    onError: (error: Error) => {
      toast.error('Failed to reveal password', { description: error.message });
    },
  });
}

// ============================================================================
// Manager queries & mutations
// ============================================================================

export function useClusterManagers(clusterId: string | null) {
  return useQuery({
    queryKey: refundClusterKeys.managers(clusterId ?? ''),
    queryFn: () => RefundClustersAPI.listManagers(clusterId!),
    enabled: !!clusterId,
    staleTime: STALE_TIME,
  });
}

export function useCreateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; manager: RefundManagerInput }) =>
      RefundClustersAPI.createManager(input.clusterId, input.manager),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.managers(variables.clusterId) });
      toast.success('Manager added');
    },
    onError: (error: Error) => {
      toast.error('Failed to add manager', { description: error.message });
    },
  });
}

export function useUpdateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; managerId: string; manager: RefundManagerInput }) =>
      RefundClustersAPI.updateManager(input.clusterId, input.managerId, input.manager),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.managers(variables.clusterId) });
      toast.success('Manager updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update manager', { description: error.message });
    },
  });
}

export function useDeleteManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; managerId: string }) =>
      RefundClustersAPI.deleteManager(input.clusterId, input.managerId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.managers(variables.clusterId) });
      // An assignment may have been cleared from entities on the server.
      qc.invalidateQueries({ queryKey: refundClusterKeys.detail(variables.clusterId) });
      toast.success('Manager deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete manager', { description: error.message });
    },
  });
}

// ============================================================================
// Document mutations
// ============================================================================

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      clusterId: string;
      entityId: string;
      documentType: string;
      file: File;
    }) =>
      RefundClustersAPI.uploadDocument(
        input.clusterId,
        input.entityId,
        input.documentType,
        input.file,
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.documents(variables.entityId) });
      toast.success('Document uploaded');
    },
    onError: (error: Error) => {
      toast.error('Upload failed', { description: error.message });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; docId: string }) =>
      RefundClustersAPI.deleteDocument(input.clusterId, input.entityId, input.docId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.documents(variables.entityId) });
      toast.success('Document deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete document', { description: error.message });
    },
  });
}

/**
 * Resolves a short-lived signed URL for a document. The caller must open the
 * tab synchronously inside the click gesture (popup blockers reject windows
 * opened after an async round-trip) and navigate it on success.
 */
export function useViewDocument() {
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; docId: string }) =>
      RefundClustersAPI.getDocumentUrl(input.clusterId, input.entityId, input.docId),
    onError: (error: Error) => {
      toast.error('Failed to open document', { description: error.message });
    },
  });
}

// ============================================================================
// Transactions
// ============================================================================

export function useEntityTransactions(clusterId: string, entityId: string | null) {
  return useQuery({
    queryKey: refundClusterKeys.transactions(entityId ?? ''),
    queryFn: () => RefundClustersAPI.listTransactions(clusterId, entityId!),
    enabled: !!entityId,
    staleTime: STALE_TIME,
  });
}

/**
 * Transactions for several entities at once, aligned to `entityIds` order.
 * Shares the per-entity transaction cache keys with {@link useEntityTransactions},
 * so a cluster-level VAT summary and an entity drawer stay in sync.
 */
export function useEntitiesTransactions(clusterId: string, entityIds: string[]) {
  return useQueries({
    queries: entityIds.map((entityId) => ({
      queryKey: refundClusterKeys.transactions(entityId),
      queryFn: () => RefundClustersAPI.listTransactions(clusterId, entityId),
      enabled: !!clusterId && !!entityId,
      staleTime: STALE_TIME,
    })),
  });
}

/**
 * Transactions for entities across multiple clusters, aligned to `pairs` order.
 * Each entity lives under its own cluster, so callers pass (clusterId, entityId)
 * pairs. Shares the per-entity transaction cache keys with the single-cluster
 * hooks above.
 */
export function useManyEntityTransactions(pairs: Array<{ clusterId: string; entityId: string }>) {
  return useQueries({
    queries: pairs.map(({ clusterId, entityId }) => ({
      queryKey: refundClusterKeys.transactions(entityId),
      queryFn: () => RefundClustersAPI.listTransactions(clusterId, entityId),
      enabled: !!clusterId && !!entityId,
      staleTime: STALE_TIME,
    })),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; txn: RefundTransactionInput }) =>
      RefundClustersAPI.createTransaction(input.clusterId, input.entityId, input.txn),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.transactions(variables.entityId) });
      toast.success('Transaction added');
    },
    onError: (error: Error) => {
      toast.error('Failed to add transaction', { description: error.message });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      clusterId: string;
      entityId: string;
      txnId: string;
      txn: RefundTransactionInput;
    }) =>
      RefundClustersAPI.updateTransaction(input.clusterId, input.entityId, input.txnId, input.txn),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.transactions(variables.entityId) });
      toast.success('Transaction updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update transaction', { description: error.message });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; txnId: string }) =>
      RefundClustersAPI.deleteTransaction(input.clusterId, input.entityId, input.txnId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.transactions(variables.entityId) });
      toast.success('Transaction deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete transaction', { description: error.message });
    },
  });
}

export function useUploadTransactionInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; txnId: string; file: File }) =>
      RefundClustersAPI.uploadTransactionInvoice(
        input.clusterId,
        input.entityId,
        input.txnId,
        input.file,
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.transactions(variables.entityId) });
      toast.success('Invoice uploaded');
    },
    onError: (error: Error) => {
      toast.error('Upload failed', { description: error.message });
    },
  });
}

export function useDeleteTransactionInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; txnId: string }) =>
      RefundClustersAPI.deleteTransactionInvoice(input.clusterId, input.entityId, input.txnId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: refundClusterKeys.transactions(variables.entityId) });
      toast.success('Invoice deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete invoice', { description: error.message });
    },
  });
}

/** Resolves a signed URL for a transaction invoice (open the tab in the click gesture). */
export function useViewTransactionInvoice() {
  return useMutation({
    mutationFn: (input: { clusterId: string; entityId: string; txnId: string }) =>
      RefundClustersAPI.getTransactionInvoiceUrl(input.clusterId, input.entityId, input.txnId),
    onError: (error: Error) => {
      toast.error('Failed to open invoice', { description: error.message });
    },
  });
}
