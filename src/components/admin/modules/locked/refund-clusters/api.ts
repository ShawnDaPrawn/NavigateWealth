/**
 * Refund Clusters — API Layer
 *
 * §5.1 — Data boundary; only layer that touches the server.
 * All routes are super-admin only and audited server-side.
 */

import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import { ENDPOINTS } from './constants';
import type {
  ClusterDetailResponse,
  RefundCluster,
  RefundEntity,
  RefundEntityDocument,
  RefundEntityInput,
} from './types';

function rethrow(error: unknown, context: string): never {
  logger.error(`[RefundClustersAPI] ${context} failed`, error);
  throw error instanceof Error ? error : new Error('An unknown error occurred');
}

export const RefundClustersAPI = {
  async listClusters(): Promise<RefundCluster[]> {
    try {
      const data = await api.get<{ clusters: RefundCluster[] }>(ENDPOINTS.CLUSTERS);
      return data?.clusters ?? [];
    } catch (error) {
      rethrow(error, 'listClusters');
    }
  },

  async createCluster(input: { name: string; description: string }): Promise<RefundCluster> {
    try {
      const data = await api.post<{ cluster: RefundCluster }>(ENDPOINTS.CLUSTERS, input);
      return data.cluster;
    } catch (error) {
      rethrow(error, 'createCluster');
    }
  },

  async updateCluster(
    clusterId: string,
    patch: { name?: string; description?: string; archived?: boolean },
  ): Promise<RefundCluster> {
    try {
      const data = await api.put<{ cluster: RefundCluster }>(ENDPOINTS.CLUSTER(clusterId), patch);
      return data.cluster;
    } catch (error) {
      rethrow(error, 'updateCluster');
    }
  },

  async deleteCluster(clusterId: string): Promise<void> {
    try {
      await api.delete(ENDPOINTS.CLUSTER(clusterId));
    } catch (error) {
      rethrow(error, 'deleteCluster');
    }
  },

  async getClusterDetail(clusterId: string): Promise<ClusterDetailResponse> {
    try {
      const data = await api.get<ClusterDetailResponse>(ENDPOINTS.CLUSTER(clusterId));
      return { cluster: data.cluster, entities: data.entities ?? [] };
    } catch (error) {
      rethrow(error, 'getClusterDetail');
    }
  },

  async createEntity(clusterId: string, input: RefundEntityInput): Promise<RefundEntity> {
    try {
      const data = await api.post<{ entity: RefundEntity }>(ENDPOINTS.ENTITIES(clusterId), input);
      return data.entity;
    } catch (error) {
      rethrow(error, 'createEntity');
    }
  },

  async updateEntity(
    clusterId: string,
    entityId: string,
    input: RefundEntityInput,
  ): Promise<RefundEntity> {
    try {
      const data = await api.put<{ entity: RefundEntity }>(
        ENDPOINTS.ENTITY(clusterId, entityId),
        input,
      );
      return data.entity;
    } catch (error) {
      rethrow(error, 'updateEntity');
    }
  },

  async deleteEntity(clusterId: string, entityId: string): Promise<void> {
    try {
      await api.delete(ENDPOINTS.ENTITY(clusterId, entityId));
    } catch (error) {
      rethrow(error, 'deleteEntity');
    }
  },

  /** Audited server-side at critical severity. */
  async revealEfilingPassword(clusterId: string, entityId: string): Promise<string> {
    try {
      const data = await api.post<{ password: string }>(
        ENDPOINTS.PASSWORD_REVEAL(clusterId, entityId),
      );
      return data.password;
    } catch (error) {
      rethrow(error, 'revealEfilingPassword');
    }
  },

  async listDocuments(clusterId: string, entityId: string): Promise<RefundEntityDocument[]> {
    try {
      const data = await api.get<{ documents: RefundEntityDocument[] }>(
        ENDPOINTS.DOCUMENTS(clusterId, entityId),
      );
      return data?.documents ?? [];
    } catch (error) {
      rethrow(error, 'listDocuments');
    }
  },

  async uploadDocument(
    clusterId: string,
    entityId: string,
    documentType: string,
    file: File,
  ): Promise<RefundEntityDocument> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      const data = await api.post<{ document: RefundEntityDocument }>(
        ENDPOINTS.DOCUMENTS(clusterId, entityId),
        formData,
      );
      return data.document;
    } catch (error) {
      rethrow(error, 'uploadDocument');
    }
  },

  async getDocumentUrl(clusterId: string, entityId: string, docId: string): Promise<string> {
    try {
      const data = await api.get<{ url: string }>(
        ENDPOINTS.DOCUMENT_URL(clusterId, entityId, docId),
      );
      return data.url;
    } catch (error) {
      rethrow(error, 'getDocumentUrl');
    }
  },

  async deleteDocument(clusterId: string, entityId: string, docId: string): Promise<void> {
    try {
      await api.delete(ENDPOINTS.DOCUMENT(clusterId, entityId, docId));
    } catch (error) {
      rethrow(error, 'deleteDocument');
    }
  },
};
