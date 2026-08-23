/**
 * Types for the Locked → Accounts → Refund Clusters feature. Moved verbatim
 * from refund-clusters-service.ts, which re-exports them for the routes.
 */
// ============================================================================
// Types
// ============================================================================

export type RefundEntityType = 'sole_proprietor' | 'company';
export type VatPeriodCategory = 'A' | 'B' | 'C' | 'D' | 'E';
export type BankAccountSlot = 'primary' | 'secondary';

export interface BankAccountDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  /** Online-banking login name. The matching password is stored encrypted. */
  onlineUsername: string;
}

export interface RefundClusterRecord {
  id: string;
  name: string;
  description: string;
  /** Shared VAT category for every entity in the cluster (drives the current period). */
  vatPeriod: VatPeriodCategory | '';
  /** Tax-year-end month (1-12) for the 6-monthly (D) and annual (E) categories; Feb by default. */
  vatYearEndMonth?: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type TransactionDirection = 'income' | 'expense';
export type VatTreatment = 'standard' | 'zero_rated' | 'exempt';

export interface RefundTransactionRecord {
  id: string;
  entityId: string;
  clusterId: string;
  /** Transaction date (ISO yyyy-mm-dd). */
  date: string;
  description: string;
  /** income → output VAT (payable); expense → input VAT (refundable). */
  direction: TransactionDirection;
  vatTreatment: VatTreatment;
  /** Gross amount, VAT-inclusive. */
  amount: number;
  /** VAT portion of the amount (0 for zero-rated/exempt unless overridden). */
  vatAmount: number;
  /** Whether vatAmount was set manually rather than auto-derived. */
  vatOverridden: boolean;
  /** Optional supporting tax invoice. */
  invoice?: RefundTransactionInvoice;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RefundTransactionInvoice {
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface TransactionInput {
  date?: string;
  description?: string;
  direction?: TransactionDirection;
  vatTreatment?: VatTreatment;
  amount?: number;
  /** When provided, overrides the auto-derived VAT for the row. */
  vatAmount?: number;
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

/** Encrypted secret envelope persisted in KV (AES-256-GCM). */
export interface EncryptedSecret {
  v: 1;
  iv: string; // base64
  ct: string; // base64 (ciphertext + GCM tag)
}

/** Bank account as persisted — adds the encrypted online-banking password. */
export interface StoredBankAccount extends BankAccountDetails {
  /** Present only when an online-banking password has been captured. */
  onlinePasswordEnc?: EncryptedSecret;
}

/** Client-safe bank account — ciphertext stripped, presence flag added. */
export type SanitizedBankAccount = BankAccountDetails & { hasOnlinePassword: boolean };

export interface TaxDetailsStored {
  efilingUsername: string;
  /** Present only when a password has been captured. Never sent to clients. */
  efilingPasswordEnc?: EncryptedSecret;
  vatPeriod: VatPeriodCategory | '';
  currentPeriodVat: string;
  previousPeriodVat: string;
}

export interface RefundEntityRecord {
  id: string;
  clusterId: string;
  entityType: RefundEntityType;
  /** Optional cluster manager who runs this entity's banking + eFiling. */
  managerId?: string;
  personalDetails?: PersonalDetails;
  businessDetails?: BusinessDetails;
  bankingDetails: {
    primary: StoredBankAccount;
    secondary: StoredBankAccount;
  };
  taxDetails: TaxDetailsStored;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Client-safe projection — ciphertext stripped, presence flags added. */
export type SanitizedEntity = Omit<RefundEntityRecord, 'taxDetails' | 'bankingDetails'> & {
  bankingDetails: {
    primary: SanitizedBankAccount;
    secondary: SanitizedBankAccount;
  };
  taxDetails: Omit<TaxDetailsStored, 'efilingPasswordEnc'> & {
    hasEfilingPassword: boolean;
  };
};

/** A person who manages banking + eFiling for entities in a cluster. */
export interface RefundManagerRecord {
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

export interface ManagerInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  notes?: string;
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

/** Bank account fields from the form; `onlinePassword` is plaintext, encrypted on save. */
export type BankAccountInput = Partial<BankAccountDetails> & { onlinePassword?: string };

export interface EntityInput {
  entityType: RefundEntityType;
  /** Assign (id) or clear (null/'') the entity's cluster manager. */
  managerId?: string | null;
  personalDetails?: Partial<PersonalDetails>;
  businessDetails?: Partial<BusinessDetails>;
  bankingDetails?: {
    primary?: BankAccountInput;
    secondary?: BankAccountInput;
  };
  taxDetails?: {
    efilingUsername?: string;
    /** Plaintext from the form; encrypted before persistence, then discarded. */
    efilingPassword?: string;
    vatPeriod?: VatPeriodCategory | '';
    currentPeriodVat?: string;
    previousPeriodVat?: string;
  };
}
