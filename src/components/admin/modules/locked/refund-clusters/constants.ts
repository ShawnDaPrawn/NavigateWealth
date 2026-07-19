/**
 * Refund Clusters — Constants
 */

import type {
  AttachmentKind,
  PaymentStatus,
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
  BANK_PASSWORD_REVEAL: (clusterId: string, entityId: string) =>
    `${entityBase(clusterId, entityId)}/bank-password/reveal`,
  MANAGERS: (clusterId: string) => `/refund-clusters/${clusterId}/managers`,
  MANAGER: (clusterId: string, managerId: string) =>
    `/refund-clusters/${clusterId}/managers/${managerId}`,
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
  TRANSACTION_ATTACHMENTS: (clusterId: string, entityId: string, txnId: string) =>
    `${entityBase(clusterId, entityId)}/transactions/${txnId}/attachments`,
  TRANSACTION_ATTACHMENT: (clusterId: string, entityId: string, txnId: string, attId: string) =>
    `${entityBase(clusterId, entityId)}/transactions/${txnId}/attachments/${attId}`,
  TRANSACTION_ATTACHMENT_URL: (clusterId: string, entityId: string, txnId: string, attId: string) =>
    `${entityBase(clusterId, entityId)}/transactions/${txnId}/attachments/${attId}/url`,
  SUBMISSION_PACK: (clusterId: string, entityId: string) =>
    `${entityBase(clusterId, entityId)}/submission-pack`,
  CLUSTER_SUBMISSION_PACK: (clusterId: string) => `/refund-clusters/${clusterId}/submission-pack`,
} as const;

export const ENTITY_TYPE_LABELS: Record<RefundEntityType, string> = {
  sole_proprietor: 'Sole Proprietor',
  company: 'Company',
};

export const VAT_PERIOD_OPTIONS: Array<{ value: VatPeriodCategory; label: string }> = [
  { value: 'A', label: 'Category A' },
  { value: 'B', label: 'Category B' },
  { value: 'C', label: 'Category C' },
  { value: 'D', label: 'Category D' },
  { value: 'E', label: 'Category E' },
];

/** Plain-language breakdown of what each SARS VAT category covers. */
export const VAT_PERIOD_DESCRIPTIONS: Record<VatPeriodCategory, string> = {
  A: 'Bi-monthly — periods end in odd months (Dec–Jan, Feb–Mar, Apr–May, Jun–Jul, Aug–Sep, Oct–Nov).',
  B: 'Bi-monthly — periods end in even months (Jan–Feb, Mar–Apr, May–Jun, Jul–Aug, Sep–Oct, Nov–Dec).',
  C: 'Monthly — one calendar month per period.',
  D: 'Bi-annual — two 6-month periods a year, ending at the tax-year-end month and 6 months later (Feb & Aug for a February year-end).',
  E: 'Annual — one 12-month period ending in the vendor’s tax-year-end (approved) month.',
};

export function vatPeriodDescription(category: VatPeriodCategory | ''): string | null {
  return category ? VAT_PERIOD_DESCRIPTIONS[category] : null;
}

/** Categories whose periods depend on a configurable tax-year-end month. */
export const YEAR_END_DEPENDENT_CATEGORIES: ReadonlyArray<VatPeriodCategory> = ['D', 'E'];

/** Month options (1-12) for the tax-year-end selector shown for categories D & E. */
export const MONTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
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

export const ATTACHMENT_KIND_OPTIONS: Array<{
  value: AttachmentKind;
  label: string;
  short: string;
}> = [
  { value: 'tax_invoice', label: 'Tax invoice', short: 'INV' },
  { value: 'proof_of_payment', label: 'Proof of payment', short: 'POP' },
  { value: 'credit_note', label: 'Credit note', short: 'CR' },
  { value: 'debit_note', label: 'Debit note', short: 'DR' },
  { value: 'statement', label: 'Statement', short: 'STMT' },
  { value: 'other', label: 'Other', short: 'DOC' },
];

export function attachmentKindShort(kind: AttachmentKind): string {
  return ATTACHMENT_KIND_OPTIONS.find((o) => o.value === kind)?.short ?? 'DOC';
}

export const PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus; label: string }> = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
];

/**
 * Ledger categories. `capital: true` marks capital goods — VAT201 separates
 * input tax on capital goods (field 14) from other goods/services (field 15).
 */
export const CATEGORY_OPTIONS: Array<{ value: string; label: string; capital?: boolean }> = [
  { value: 'sales_services', label: 'Sales — services' },
  { value: 'sales_goods', label: 'Sales — goods' },
  { value: 'professional_fees', label: 'Professional fees' },
  { value: 'materials', label: 'Materials & consumables' },
  { value: 'rent', label: 'Rent & utilities' },
  { value: 'fuel_transport', label: 'Fuel & transport' },
  { value: 'equipment_capital', label: 'Equipment (capital)', capital: true },
  { value: 'vehicles_capital', label: 'Vehicles (capital)', capital: true },
  { value: 'bank_charges', label: 'Bank charges' },
  { value: 'telecoms', label: 'Telecoms & software' },
  { value: 'other', label: 'Other' },
];

export interface DocumentTypeOption {
  value: string;
  label: string;
}

export const SOLE_PROPRIETOR_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: 'id_copy', label: 'Copy of ID' },
  { value: 'selfie', label: 'Selfie' },
  {
    value: 'proof_of_residential_address',
    label: 'Proof of Residential Address (within 3 months)',
  },
  { value: 'proof_of_business_address', label: 'Proof of Business Address (within 3 months)' },
  { value: 'primary_bank_proof', label: 'Proof of Primary Bank Account' },
  { value: 'secondary_bank_proof', label: 'Proof of Secondary Bank Account' },
  {
    value: 'taxable_supplies_threshold_proof',
    label: 'Proof Taxable Supplies Exceeded R120 000 (Past 12 Months)',
  },
  {
    value: 'taxable_supplies_monthly_proof',
    label: 'Proof Taxable Supplies Averaged Over R10 000 per Month',
  },
];

export const COMPANY_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: 'company_registration', label: 'Company Registration Documents' },
  { value: 'sars_vat_certificate', label: 'SARS VAT Registration Certificate' },
  { value: 'proof_of_business_address', label: 'Proof of Business Address (within 3 months)' },
  { value: 'director_id', label: 'Director/Representative ID Document' },
  { value: 'director_selfie', label: 'Director/Representative Selfie' },
  {
    value: 'representative_residential_address_proof',
    label: 'Proof of Representative Residential Address (within 3 months)',
  },
  { value: 'bank_confirmation_letter', label: 'Company Bank Confirmation Letter' },
  { value: 'primary_bank_proof', label: 'Proof of Primary Bank Account' },
  { value: 'secondary_bank_proof', label: 'Proof of Secondary Bank Account' },
  {
    value: 'taxable_supplies_threshold_proof',
    label: 'Proof Taxable Supplies Exceeded R120 000 (Past 12 Months)',
  },
  {
    value: 'taxable_supplies_monthly_proof',
    label: 'Proof Taxable Supplies Averaged Over R10 000 per Month',
  },
];

export function documentTypesFor(entityType: RefundEntityType): DocumentTypeOption[] {
  return entityType === 'company' ? COMPANY_DOCUMENT_TYPES : SOLE_PROPRIETOR_DOCUMENT_TYPES;
}

export function documentTypeLabel(entityType: RefundEntityType, value: string): string {
  return documentTypesFor(entityType).find((opt) => opt.value === value)?.label ?? value;
}
