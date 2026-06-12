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

export interface RefundCluster {
  id: string;
  name: string;
  description: string;
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
  vatPeriod: VatPeriodCategory | '';
  currentPeriodVat: string;
  previousPeriodVat: string;
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
    vatPeriod: VatPeriodCategory | '';
    currentPeriodVat: string;
    previousPeriodVat: string;
  };
}

export interface ClusterDetailResponse {
  cluster: RefundCluster;
  entities: RefundEntity[];
}
