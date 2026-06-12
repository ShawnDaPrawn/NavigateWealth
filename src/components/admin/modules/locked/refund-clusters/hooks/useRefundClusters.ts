/**
 * Refund Clusters — Query & Mutation Hooks
 *
 * §6 — Hooks are the only consumers of APIs.
 * §11.2 — React Query for all server state.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { refundClusterKeys } from '../../../../../../utils/queryKeys';
import { RefundClustersAPI } from '../api';
import type { RefundEntityInput } from '../types';

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
    mutationFn: (input: { name: string; description: string }) =>
      RefundClustersAPI.createCluster(input),
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
      patch: { name?: string; description?: string; archived?: boolean };
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
