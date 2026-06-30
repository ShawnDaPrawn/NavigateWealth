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
  BankAccountSlot,
  ClusterDetailResponse,
  RefundCluster,
  RefundEntity,
  RefundEntityDocument,
  RefundEntityInput,
  RefundManager,
  RefundManagerInput,
  RefundTransaction,
  RefundTransactionInput,
  VatPeriodCategory,
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

  async createCluster(input: {
    name: string;
    description: string;
    vatPeriod: VatPeriodCategory | '';
    vatYearEndMonth?: number;
  }): Promise<RefundCluster> {
    try {
      const data = await api.post<{ cluster: RefundCluster }>(ENDPOINTS.CLUSTERS, input);
      return data.cluster;
    } catch (error) {
      rethrow(error, 'createCluster');
    }
  },

  async updateCluster(
    clusterId: string,
    patch: {
      name?: string;
      description?: string;
      vatPeriod?: VatPeriodCategory | '';
      vatYearEndMonth?: number;
      archived?: boolean;
    },
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

  /** Reveal a stored online-banking password. Audited server-side at critical severity. */
  async revealBankPassword(
    clusterId: string,
    entityId: string,
    account: BankAccountSlot,
  ): Promise<string> {
    try {
      const data = await api.post<{ password: string }>(
        ENDPOINTS.BANK_PASSWORD_REVEAL(clusterId, entityId),
        { account },
      );
      return data.password;
    } catch (error) {
      rethrow(error, 'revealBankPassword');
    }
  },

  // --- Managers --------------------------------------------------------

  async listManagers(clusterId: string): Promise<RefundManager[]> {
    try {
      const data = await api.get<{ managers: RefundManager[] }>(ENDPOINTS.MANAGERS(clusterId));
      return data?.managers ?? [];
    } catch (error) {
      rethrow(error, 'listManagers');
    }
  },

  async createManager(clusterId: string, input: RefundManagerInput): Promise<RefundManager> {
    try {
      const data = await api.post<{ manager: RefundManager }>(ENDPOINTS.MANAGERS(clusterId), input);
      return data.manager;
    } catch (error) {
      rethrow(error, 'createManager');
    }
  },

  async updateManager(
    clusterId: string,
    managerId: string,
    input: RefundManagerInput,
  ): Promise<RefundManager> {
    try {
      const data = await api.put<{ manager: RefundManager }>(
        ENDPOINTS.MANAGER(clusterId, managerId),
        input,
      );
      return data.manager;
    } catch (error) {
      rethrow(error, 'updateManager');
    }
  },

  async deleteManager(clusterId: string, managerId: string): Promise<void> {
    try {
      await api.delete(ENDPOINTS.MANAGER(clusterId, managerId));
    } catch (error) {
      rethrow(error, 'deleteManager');
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

  // --- Transactions ----------------------------------------------------

  async listTransactions(clusterId: string, entityId: string): Promise<RefundTransaction[]> {
    try {
      const data = await api.get<{ transactions: RefundTransaction[] }>(
        ENDPOINTS.TRANSACTIONS(clusterId, entityId),
      );
      return data?.transactions ?? [];
    } catch (error) {
      rethrow(error, 'listTransactions');
    }
  },

  async createTransaction(
    clusterId: string,
    entityId: string,
    input: RefundTransactionInput,
  ): Promise<RefundTransaction> {
    try {
      const data = await api.post<{ transaction: RefundTransaction }>(
        ENDPOINTS.TRANSACTIONS(clusterId, entityId),
        input,
      );
      return data.transaction;
    } catch (error) {
      rethrow(error, 'createTransaction');
    }
  },

  async updateTransaction(
    clusterId: string,
    entityId: string,
    txnId: string,
    input: RefundTransactionInput,
  ): Promise<RefundTransaction> {
    try {
      const data = await api.put<{ transaction: RefundTransaction }>(
        ENDPOINTS.TRANSACTION(clusterId, entityId, txnId),
        input,
      );
      return data.transaction;
    } catch (error) {
      rethrow(error, 'updateTransaction');
    }
  },

  async deleteTransaction(clusterId: string, entityId: string, txnId: string): Promise<void> {
    try {
      await api.delete(ENDPOINTS.TRANSACTION(clusterId, entityId, txnId));
    } catch (error) {
      rethrow(error, 'deleteTransaction');
    }
  },

  async uploadTransactionInvoice(
    clusterId: string,
    entityId: string,
    txnId: string,
    file: File,
  ): Promise<RefundTransaction> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post<{ transaction: RefundTransaction }>(
        ENDPOINTS.TRANSACTION_INVOICE(clusterId, entityId, txnId),
        formData,
      );
      return data.transaction;
    } catch (error) {
      rethrow(error, 'uploadTransactionInvoice');
    }
  },

  async getTransactionInvoiceUrl(
    clusterId: string,
    entityId: string,
    txnId: string,
  ): Promise<string> {
    try {
      const data = await api.get<{ url: string }>(
        ENDPOINTS.TRANSACTION_INVOICE_URL(clusterId, entityId, txnId),
      );
      return data.url;
    } catch (error) {
      rethrow(error, 'getTransactionInvoiceUrl');
    }
  },

  async deleteTransactionInvoice(
    clusterId: string,
    entityId: string,
    txnId: string,
  ): Promise<void> {
    try {
      await api.delete(ENDPOINTS.TRANSACTION_INVOICE(clusterId, entityId, txnId));
    } catch (error) {
      rethrow(error, 'deleteTransactionInvoice');
    }
  },
};
