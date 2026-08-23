/**
 * Refund Clusters Service
 *
 * Storage + crypto layer for the Locked → Accounts → Refund Clusters feature.
 * Clusters group "entities" (sole proprietors or companies) whose tax,
 * banking, identity and accounting details are captured for VAT refunds.
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - eFiling passwords are encrypted at rest with AES-256-GCM before the
 *     record is written to KV. The plaintext NEVER leaves this module except
 *     through the explicit, audited `reveal` endpoint.
 *   - Sanitized records returned to the client carry only a
 *     `hasEfilingPassword` flag — never the ciphertext or plaintext.
 *   - Every mutation and sensitive read is recorded via AdminAuditService.
 *
 * KV layout:
 *   refund-clusters:cluster:{clusterId}              → RefundClusterRecord
 *   refund-clusters:entity:{clusterId}:{entityId}    → RefundEntityRecord
 *   refund-clusters:doc:{entityId}:{docId}           → RefundEntityDocument
 *   refund-clusters:txn:{entityId}:{txnId}           → RefundTransactionRecord
 *   refund-clusters:manager:{clusterId}:{managerId}  → RefundManagerRecord
 *
 * @module server/refund-clusters-service
 */

export * from './refund-clusters-model.ts';

import {
  createCluster,
  createEntity,
  createManager,
  deleteCluster,
  deleteEntityRecords,
  deleteManager,
  deriveLegacyVatPeriod,
  getCluster,
  getManager,
  listClusters,
  listEntities,
  listManagers,
  resolveManagerId,
  revealBankPassword,
  revealEfilingPassword,
  updateCluster,
  updateEntity,
  updateManager,
} from './refund-clusters-core.ts';
import {
  attachTransactionInvoice,
  createTransaction,
  deleteDocument,
  deleteTransaction,
  getDocument,
  getEntityRaw,
  getTransaction,
  listClusterDocuments,
  listClusterTransactions,
  listDocuments,
  listTransactions,
  removeTransactionInvoice,
  saveDocument,
  updateTransaction,
} from './refund-clusters-records.ts';
import {
  normalizeVatPeriod,
  normalizeYearEndMonth,
  resolveVatAmount,
} from './refund-clusters-helpers.ts';

// ============================================================================
// Service — facade over the core/records/helpers slices, preserving the
// original RefundClustersService call surface for the routes.
// ============================================================================

export const RefundClustersService = {
  listClusters,
  getCluster,
  deriveLegacyVatPeriod,
  createCluster,
  updateCluster,
  deleteCluster,
  listEntities,
  getEntityRaw,
  createEntity,
  updateEntity,
  revealEfilingPassword,
  revealBankPassword,
  deleteEntityRecords,
  normalizeVatPeriod,
  normalizeYearEndMonth,
  listManagers,
  getManager,
  resolveManagerId,
  createManager,
  updateManager,
  deleteManager,
  listDocuments,
  listClusterDocuments,
  getDocument,
  saveDocument,
  deleteDocument,
  listTransactions,
  listClusterTransactions,
  getTransaction,
  resolveVatAmount,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  attachTransactionInvoice,
  removeTransactionInvoice,
};
