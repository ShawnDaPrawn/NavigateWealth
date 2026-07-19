/**
 * Refund Clusters — Types
 *
 * Client-side shapes for the Locked → Accounts → Refund Clusters feature.
 * These mirror the sanitized payloads returned by the
 * /refund-clusters edge routes: eFiling passwords are write-only — the
 * server only ever returns a `hasEfilingPassword` flag.
 */

export type RefundEntityType = 'sole_proprietor' | 'company';
export type VatPeriodCategory = 'A' | 'B' | 'C' | 'D' | 'E';
export type TransactionDirection = 'income' | 'expense';
export type VatTreatment = 'standard' | 'zero_rated' | 'exempt';

export interface RefundCluster {
  id: string;
  name: string;
  description: string;
  /** Shared VAT category for every entity in the cluster (drives the current period). */
  vatPeriod: VatPeriodCategory | '';
  /**
   * Tax-year-end month (1-12) used by the 6-monthly (D) and annual (E)
   * categories. February (2) by default — the SARS default. Ignored by A/B/C.
   */
  vatYearEndMonth?: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  entityCount?: number;
}

export type BankAccountSlot = 'primary' | 'secondary';

export interface BankAccountDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  /** Online-banking login name. */
  onlineUsername: string;
  /** Server-set flag: an online-banking password is stored (write-only). */
  hasOnlinePassword: boolean;
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

export type AttachmentKind =
  | 'tax_invoice'
  | 'proof_of_payment'
  | 'credit_note'
  | 'debit_note'
  | 'statement'
  | 'other';

export interface TransactionAttachment {
  id: string;
  kind: AttachmentKind;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  /** Operator confirmed the FULL tax invoice requirements (needed > R5,000). */
  verifiedFull?: boolean;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface TransactionPayment {
  status: PaymentStatus;
  paidDate?: string;
  method?: string;
  bankAccount?: BankAccountSlot;
}

export interface TransactionCounterparty {
  kind: 'supplier' | 'customer' | 'other';
  /** Suppliers-directory id when kind is 'supplier'. */
  id?: string;
  name: string;
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
  counterparty?: TransactionCounterparty;
  category?: string;
  reference?: string;
  payment?: TransactionPayment;
  attachments?: TransactionAttachment[];
  /** Legacy single invoice; the server lazily migrates it into attachments. */
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
  /** null clears the stored value. */
  counterparty?: TransactionCounterparty | null;
  category?: string | null;
  reference?: string | null;
  payment?: TransactionPayment | null;
}

/** Transactions plus their server-computed SARS-readiness flags. */
export interface EntityLedgerResponse {
  transactions: RefundTransaction[];
  flags: Record<string, string[]>;
}

export interface RefundEntity {
  id: string;
  clusterId: string;
  entityType: RefundEntityType;
  /** Assigned cluster manager (runs banking + eFiling), when set. */
  managerId?: string;
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

/** A person who runs banking + eFiling for entities in a cluster. */
export interface RefundManager {
  id: string;
  clusterId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Manager create/update payload. */
export interface RefundManagerInput {
  name: string;
  email: string;
  phone: string;
  role: string;
  notes: string;
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

/** Bank account fields sent on save; the password is write-only. */
export interface BankAccountInput {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  onlineUsername: string;
  /** Write-only: encrypted server-side, never echoed back. */
  onlinePassword?: string;
}

/** Payload sent when creating or updating an entity. */
export interface RefundEntityInput {
  entityType: RefundEntityType;
  /** Assign (id) or clear (null) the entity's cluster manager. */
  managerId?: string | null;
  personalDetails?: PersonalDetails;
  businessDetails?: BusinessDetails;
  bankingDetails?: {
    primary: BankAccountInput;
    secondary: BankAccountInput;
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
