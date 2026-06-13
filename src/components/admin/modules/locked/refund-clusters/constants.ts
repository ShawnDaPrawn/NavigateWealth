/**
 * Refund Clusters — Constants
 */

import type {
  RefundEntityType,
  TransactionDirection,
  VatPeriodCategory,
  VatTreatment,
} from './types';

const entityBase = (clusterId: string, entityId: string) =>
  `/refund-clusters/${clusterId}/entities/${entityId}`;

export const ENDPOINTS = {
  CLUSTERS: '/refund-clusters',
  CLUSTER: (clusterId: string) => `/refund-clusters/${clusterId}`,
  ENTITIES: (clusterId: string) => `/refund-clusters/${clusterId}/entities`,
  ENTITY: entityBase,
  PASSWORD_REVEAL: (clusterId: string, entityId: string) =>
    `${entityBase(clusterId, entityId)}/efiling-password/reveal`,
  DOCUMENTS: (clusterId: string, entityId: string) =>
    `${entityBase(clusterId, entityId)}/documents`,
  DOCUMENT_URL: (clusterId: string, entityId: string, docId: string) =>
    `${entityBase(clusterId, entityId)}/documents/${docId}/url`,
  DOCUMENT: (clusterId: string, entityId: string, docId: string) =>
    `${entityBase(clusterId, entityId)}/documents/${docId}`,
  TRANSACTIONS: (clusterId: string, entityId: string) =>
    `${entityBase(clusterId, entityId)}/transactions`,
  TRANSACTION: (clusterId: string, entityId: string, txnId: string) =>
    `${entityBase(clusterId, entityId)}/transactions/${txnId}`,
  TRANSACTION_INVOICE: (clusterId: string, entityId: string, txnId: string) =>
    `${entityBase(clusterId, entityId)}/transactions/${txnId}/invoice`,
  TRANSACTION_INVOICE_URL: (clusterId: string, entityId: string, txnId: string) =>
    `${entityBase(clusterId, entityId)}/transactions/${txnId}/invoice/url`,
} as const;

export const ENTITY_TYPE_LABELS: Record<RefundEntityType, string> = {
  sole_proprietor: 'Sole Proprietor',
  company: 'Company',
};

export const VAT_PERIOD_OPTIONS: Array<{ value: VatPeriodCategory; label: string }> = [
  { value: 'A', label: 'Category A' },
  { value: 'B', label: 'Category B' },
  { value: 'C', label: 'Category C' },
];

export const VAT_RATE = 0.15;

export const DIRECTION_LABELS: Record<TransactionDirection, string> = {
  income: 'Income',
  expense: 'Expense',
};

export const VAT_TREATMENT_OPTIONS: Array<{ value: VatTreatment; label: string }> = [
  { value: 'standard', label: 'Standard (15%)' },
  { value: 'zero_rated', label: 'Zero-rated (0%)' },
  { value: 'exempt', label: 'Exempt' },
];

export const ACCOUNT_TYPE_OPTIONS = ['Cheque / Current', 'Savings', 'Transmission', 'Business'];

/** Allowed upload types — mirrored server-side; the server is authoritative. */
export const ALLOWED_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface DocumentTypeOption {
  value: string;
  label: string;
}

export const SOLE_PROPRIETOR_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: 'id_copy', label: 'Copy of ID' },
  { value: 'selfie', label: 'Selfie' },
  { value: 'primary_bank_proof', label: 'Proof of Primary Bank Account' },
  { value: 'secondary_bank_proof', label: 'Proof of Secondary Bank Account' },
];

export const COMPANY_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: 'company_registration', label: 'Company Registration Documents' },
  { value: 'sars_vat_certificate', label: 'SARS VAT Registration Certificate' },
  { value: 'proof_of_business_address', label: 'Proof of Business Address' },
  { value: 'director_id', label: 'Director/Representative ID Document' },
  { value: 'director_selfie', label: 'Director/Representative Selfie' },
  { value: 'bank_confirmation_letter', label: 'Company Bank Confirmation Letter' },
  { value: 'primary_bank_proof', label: 'Proof of Primary Bank Account' },
  { value: 'secondary_bank_proof', label: 'Proof of Secondary Bank Account' },
];

export function documentTypesFor(entityType: RefundEntityType): DocumentTypeOption[] {
  return entityType === 'company' ? COMPANY_DOCUMENT_TYPES : SOLE_PROPRIETOR_DOCUMENT_TYPES;
}

export function documentTypeLabel(entityType: RefundEntityType, value: string): string {
  return documentTypesFor(entityType).find((opt) => opt.value === value)?.label ?? value;
}
