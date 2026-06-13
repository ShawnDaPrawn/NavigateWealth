/**
 * Refund Clusters — Types
 *
 * Client-side shapes for the Locked → Accounts → Refund Clusters feature.
 * These mirror the sanitized payloads returned by the
 * /refund-clusters edge routes: eFiling passwords are write-only — the
 * server only ever returns a `hasEfilingPassword` flag.
 */

export type RefundEntityType = 'sole_proprietor' | 'company';
export type VatPeriodCategory = 'A' | 'B' | 'C';
export type TransactionDirection = 'income' | 'expense';
export type VatTreatment = 'standard' | 'zero_rated' | 'exempt';

export interface RefundCluster {
  id: string;
  name: string;
  description: string;
  /** Shared VAT category for every entity in the cluster (drives the current period). */
  vatPeriod: VatPeriodCategory | '';
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  entityCount?: number;
}

export interface BankAccountDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
}

export interface PersonalDetails {
  name: string;
  surname: string;
  physicalAddress: string;
}

export interface BusinessDetails {
  companyName: string;
  registrationNumber: string;
  tradingName: string;
  registeredAddress: string;
  physicalBusinessAddress: string;
  contactPerson: string;
  contactPersonEmail: string;
  contactPersonPhone: string;
}

export interface TaxDetails {
  efilingUsername: string;
  hasEfilingPassword: boolean;
  /** Manual accounting-record note. The live VAT figure comes from the transactions ledger. */
  currentPeriodVat: string;
  previousPeriodVat: string;
}

export interface RefundTransactionInvoice {
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface RefundTransaction {
  id: string;
  entityId: string;
  clusterId: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  description: string;
  /** income → output VAT (payable); expense → input VAT (refundable). */
  direction: TransactionDirection;
  vatTreatment: VatTreatment;
  /** Gross amount, VAT-inclusive. */
  amount: number;
  vatAmount: number;
  vatOverridden: boolean;
  invoice?: RefundTransactionInvoice;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RefundTransactionInput {
  date: string;
  description: string;
  direction: TransactionDirection;
  vatTreatment: VatTreatment;
  amount: number;
  /** Optional manual override of the auto-derived VAT. */
  vatAmount?: number;
}

export interface RefundEntity {
  id: string;
  clusterId: string;
  entityType: RefundEntityType;
  personalDetails?: PersonalDetails;
  businessDetails?: BusinessDetails;
  bankingDetails: {
    primary: BankAccountDetails;
    secondary: BankAccountDetails;
  };
  taxDetails: TaxDetails;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RefundEntityDocument {
  id: string;
  entityId: string;
  clusterId: string;
  documentType: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

/** Payload sent when creating or updating an entity. */
export interface RefundEntityInput {
  entityType: RefundEntityType;
  personalDetails?: PersonalDetails;
  businessDetails?: BusinessDetails;
  bankingDetails?: {
    primary: BankAccountDetails;
    secondary: BankAccountDetails;
  };
  taxDetails?: {
    efilingUsername: string;
    /** Write-only: encrypted server-side, never echoed back. */
    efilingPassword?: string;
    currentPeriodVat: string;
    previousPeriodVat: string;
  };
}

export interface ClusterDetailResponse {
  cluster: RefundCluster;
  entities: RefundEntity[];
}
