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
 *   refund-clusters:submission:{entityId}:{periodKey} → VatSubmissionRecord
 *
 * @module server/refund-clusters-service
 */

import * as kv from '../kv_store.tsx';
import { createModuleLogger } from '../stderr-logger.ts';
import { isLockedStatus, type SubmissionStatus } from './vat201.ts';

const log = createModuleLogger('refund-clusters');

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

/** Evidence kinds SARS asks for during refund verifications. */
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
  /**
   * Operator confirmation that a tax invoice meets the FULL tax invoice
   * requirements (s20(4): recipient name/address/VAT no) — required for
   * supplies over R5,000.
   */
  verifiedFull?: boolean;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface TransactionPayment {
  status: PaymentStatus;
  /** ISO yyyy-mm-dd. */
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
  /** Who the money moved to/from (supplier link, customer, or freeform). */
  counterparty?: TransactionCounterparty;
  /** Income/expense category; categories marked capital map to VAT201 field 14. */
  category?: string;
  /** Counterparty document reference (their invoice number / PO). */
  reference?: string;
  payment?: TransactionPayment;
  /** Supporting evidence files. */
  attachments?: TransactionAttachment[];
  /**
   * Legacy single tax invoice (pre-attachments). Lazily migrated into
   * `attachments` on read; never written by new code.
   */
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

/**
 * A VAT period's submission lifecycle. Existence with any status other than
 * 'open' LOCKS the period: transactions dated inside it cannot be created,
 * edited or deleted (corrections go into the open period). Evidence
 * attachments remain allowed — verification is when documents get gathered.
 */
export interface VatSubmissionRecord {
  entityId: string;
  clusterId: string;
  /** `${periodStart}_${periodEnd}` — stable identifier. */
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  status: SubmissionStatus;
  /** ISO yyyy-mm-dd date the VAT201 was filed on eFiling. */
  submittedDate?: string;
  sarsRef?: string;
  refundAmount?: number;
  refundReceivedDate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SubmissionInput {
  periodStart?: string;
  periodEnd?: string;
  periodLabel?: string;
  status?: string;
  submittedDate?: string;
  sarsRef?: string;
  refundAmount?: number;
  refundReceivedDate?: string;
  notes?: string;
}

export interface TransactionInput {
  date?: string;
  description?: string;
  direction?: TransactionDirection;
  vatTreatment?: VatTreatment;
  amount?: number;
  /** When provided, overrides the auto-derived VAT for the row. */
  vatAmount?: number;
  counterparty?: { kind?: string; id?: string; name?: string } | null;
  category?: string | null;
  reference?: string | null;
  payment?: { status?: string; paidDate?: string; method?: string; bankAccount?: string } | null;
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
interface EncryptedSecret {
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

// ============================================================================
// KV keys
// ============================================================================

const CLUSTER_PREFIX = 'refund-clusters:cluster:';
const ENTITY_PREFIX = 'refund-clusters:entity:';
const DOC_PREFIX = 'refund-clusters:doc:';
const TXN_PREFIX = 'refund-clusters:txn:';
const MANAGER_PREFIX = 'refund-clusters:manager:';
const SUBMISSION_PREFIX = 'refund-clusters:submission:';

const clusterKey = (clusterId: string) => `${CLUSTER_PREFIX}${clusterId}`;
const entityKey = (clusterId: string, entityId: string) =>
  `${ENTITY_PREFIX}${clusterId}:${entityId}`;
const docKey = (entityId: string, docId: string) => `${DOC_PREFIX}${entityId}:${docId}`;
const txnKey = (entityId: string, txnId: string) => `${TXN_PREFIX}${entityId}:${txnId}`;
const managerKey = (clusterId: string, managerId: string) =>
  `${MANAGER_PREFIX}${clusterId}:${managerId}`;
const submissionKey = (entityId: string, pKey: string) => `${SUBMISSION_PREFIX}${entityId}:${pKey}`;

const newId = () => crypto.randomUUID();

// ============================================================================
// Secret encryption (AES-256-GCM)
// ============================================================================

const b64encode = (bytes: Uint8Array): string => {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
};

const b64decode = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));

let cachedKey: CryptoKey | null = null;

/**
 * Resolve the AES-256 vault key.
 *
 * Preferred source is the dedicated NW_REFUND_VAULT_KEY secret (any string
 * ≥ 32 chars, or base64). When unset we fall back to a key derived from the
 * service-role key via SHA-256 with a feature-specific salt, so the feature
 * works out of the box while still keeping secrets unreadable in a raw KV
 * dump. Rotating either source invalidates previously stored passwords —
 * they can simply be re-captured through the UI.
 */
async function getVaultKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const material =
    Deno.env.get('NW_REFUND_VAULT_KEY') ||
    `nw-refund-clusters-v1:${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`;
  if (material.length < 32) {
    throw new Error('Refund vault key material is too short');
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  cachedKey = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  return cachedKey;
}

async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
  const key = await getVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { v: 1, iv: b64encode(iv), ct: b64encode(new Uint8Array(ct)) };
}

async function decryptSecret(secret: EncryptedSecret): Promise<string> {
  const key = await getVaultKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(secret.iv) as BufferSource },
    key,
    b64decode(secret.ct) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

// ============================================================================
// Helpers
// ============================================================================

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function normalizeBankAccount(input?: Partial<BankAccountDetails>): BankAccountDetails {
  return {
    bankName: str(input?.bankName),
    accountHolder: str(input?.accountHolder),
    accountNumber: str(input?.accountNumber),
    branchCode: str(input?.branchCode),
    accountType: str(input?.accountType),
    onlineUsername: str(input?.onlineUsername),
  };
}

/**
 * Merge form input over an existing stored account, preserving the encrypted
 * online-banking password unless a new plaintext one was supplied (mirrors the
 * write-only eFiling-password handling).
 */
async function buildStoredBankAccount(
  existing: StoredBankAccount | undefined,
  input: BankAccountInput | undefined,
): Promise<StoredBankAccount> {
  const merged: StoredBankAccount = normalizeBankAccount({ ...existing, ...input });
  if (existing?.onlinePasswordEnc) merged.onlinePasswordEnc = existing.onlinePasswordEnc;
  if (input?.onlinePassword) merged.onlinePasswordEnc = await encryptSecret(input.onlinePassword);
  return merged;
}

function sanitizeBankAccount(account: StoredBankAccount): SanitizedBankAccount {
  const { onlinePasswordEnc, ...rest } = account;
  return { ...rest, hasOnlinePassword: Boolean(onlinePasswordEnc) };
}

function sanitizeEntity(entity: RefundEntityRecord): SanitizedEntity {
  const { efilingPasswordEnc, ...taxRest } = entity.taxDetails;
  return {
    ...entity,
    bankingDetails: {
      primary: sanitizeBankAccount(entity.bankingDetails.primary),
      secondary: sanitizeBankAccount(entity.bankingDetails.secondary),
    },
    taxDetails: { ...taxRest, hasEfilingPassword: Boolean(efilingPasswordEnc) },
  };
}

function normalizeManager(input: ManagerInput, base?: RefundManagerRecord) {
  return {
    name: input.name !== undefined ? str(input.name) : (base?.name ?? ''),
    email: input.email !== undefined ? str(input.email) : (base?.email ?? ''),
    phone: input.phone !== undefined ? str(input.phone) : (base?.phone ?? ''),
    role: input.role !== undefined ? str(input.role) : (base?.role ?? ''),
    notes: input.notes !== undefined ? str(input.notes) : (base?.notes ?? ''),
  };
}

const VAT_PERIODS: ReadonlyArray<string> = ['A', 'B', 'C', 'D', 'E', ''];

/** Default tax-year-end month (February — the SARS default). */
const DEFAULT_VAT_YEAR_END_MONTH = 2;

const VAT_RATE = 0.15;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Strictly parse a direction — an unrecognized value is rejected, never silently defaulted. */
function parseDirection(value: unknown): TransactionDirection {
  if (value === 'income' || value === 'expense') return value;
  throw Object.assign(new Error('Invalid transaction direction'), { status: 400 });
}

/** Strictly parse a VAT treatment. `undefined` is allowed (caller decides the default). */
function parseTreatment(value: unknown): VatTreatment {
  if (value === 'standard' || value === 'zero_rated' || value === 'exempt') return value;
  throw Object.assign(new Error('Invalid VAT treatment'), { status: 400 });
}

function toAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? round2(n) : 0;
}

/** VAT-inclusive VAT portion for a standard-rated amount; 0 for zero-rated/exempt. */
function autoVat(amount: number, treatment: VatTreatment): number {
  if (treatment !== 'standard') return 0;
  return round2((amount * VAT_RATE) / (1 + VAT_RATE));
}

/** Parse the optional counterparty; null clears it, invalid shapes are dropped. */
function parseCounterparty(
  value: TransactionInput['counterparty'],
  existing?: TransactionCounterparty,
): TransactionCounterparty | undefined {
  if (value === undefined) return existing;
  if (value === null) return undefined;
  const name = str(value.name);
  if (!name) return undefined;
  const kind = value.kind === 'supplier' || value.kind === 'customer' ? value.kind : 'other';
  return { kind, id: str(value.id) || undefined, name };
}

/** Parse the optional payment block; null clears it. */
function parsePayment(
  value: TransactionInput['payment'],
  existing?: TransactionPayment,
): TransactionPayment | undefined {
  if (value === undefined) return existing;
  if (value === null) return undefined;
  const status = value.status === 'paid' || value.status === 'partial' ? value.status : 'unpaid';
  const bankAccount =
    value.bankAccount === 'primary' || value.bankAccount === 'secondary'
      ? value.bankAccount
      : undefined;
  return {
    status,
    paidDate: str(value.paidDate) || undefined,
    method: str(value.method) || undefined,
    bankAccount,
  };
}

/**
 * Lazy migration: a legacy single `invoice` is surfaced as a tax_invoice
 * attachment. Reads always go through this; writes persist the new shape.
 */
function migrateTxn(txn: RefundTransactionRecord): RefundTransactionRecord {
  if (!txn.invoice) return txn;
  const attachments = txn.attachments ?? [];
  const already = attachments.some((a) => a.storagePath === txn.invoice!.storagePath);
  const { invoice, ...rest } = txn;
  return {
    ...rest,
    attachments: already
      ? attachments
      : [{ id: `legacy-${txn.id}`, kind: 'tax_invoice', ...invoice }, ...attachments],
  };
}

/** Every storage path referenced by a transaction (attachments + legacy invoice). */
export function transactionStoragePaths(txn: RefundTransactionRecord): string[] {
  const paths = (txn.attachments ?? []).map((a) => a.storagePath);
  if (txn.invoice && !paths.includes(txn.invoice.storagePath)) paths.push(txn.invoice.storagePath);
  return paths;
}

// ============================================================================
// Service
// ============================================================================

export const RefundClustersService = {
  // --- Clusters --------------------------------------------------------

  async listClusters(): Promise<Array<RefundClusterRecord & { entityCount: number }>> {
    const clusters = (await kv.getByPrefix(CLUSTER_PREFIX)) as RefundClusterRecord[];
    const entities = (await kv.getByPrefix(ENTITY_PREFIX)) as RefundEntityRecord[];
    const counts = new Map<string, number>();
    for (const entity of entities) {
      counts.set(entity.clusterId, (counts.get(entity.clusterId) ?? 0) + 1);
    }
    return clusters
      .filter((c) => c && c.id)
      .map((c) => ({ ...c, entityCount: counts.get(c.id) ?? 0 }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getCluster(clusterId: string): Promise<RefundClusterRecord | null> {
    const cluster =
      ((await kv.get(clusterKey(clusterId))) as RefundClusterRecord | undefined) ?? null;
    if (cluster && !cluster.vatPeriod) {
      // Back-compat: clusters created before the VAT category moved to the
      // cluster have no vatPeriod. Derive it once from any entity's legacy
      // taxDetails.vatPeriod and persist, so period-scoped summaries are
      // correct without a manual edit.
      const derived = await this.deriveLegacyVatPeriod(clusterId);
      if (derived) {
        cluster.vatPeriod = derived;
        await kv.set(clusterKey(clusterId), cluster);
      }
    }
    return cluster;
  },

  /** Reads the legacy per-entity VAT category (pre-migration records) for backfill. */
  async deriveLegacyVatPeriod(clusterId: string): Promise<VatPeriodCategory | ''> {
    const entities = (await kv.getByPrefix(
      `${ENTITY_PREFIX}${clusterId}:`,
    )) as RefundEntityRecord[];
    for (const entity of entities) {
      const legacy = (entity?.taxDetails as { vatPeriod?: unknown } | undefined)?.vatPeriod;
      const normalized = this.normalizeVatPeriod(legacy);
      if (normalized) return normalized;
    }
    return '';
  },

  async createCluster(input: {
    name: string;
    description: string;
    vatPeriod?: VatPeriodCategory | '';
    vatYearEndMonth?: number;
    createdBy: string;
  }): Promise<RefundClusterRecord> {
    const name = str(input.name);
    if (!name) throw new Error('Cluster name is required');

    const now = new Date().toISOString();
    const cluster: RefundClusterRecord = {
      id: newId(),
      name,
      description: str(input.description),
      vatPeriod: this.normalizeVatPeriod(input.vatPeriod),
      vatYearEndMonth: this.normalizeYearEndMonth(input.vatYearEndMonth),
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    };
    await kv.set(clusterKey(cluster.id), cluster);
    log.info('Cluster created', { clusterId: cluster.id });
    return cluster;
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
  ): Promise<RefundClusterRecord> {
    const existing = await this.getCluster(clusterId);
    if (!existing) throw Object.assign(new Error('Cluster not found'), { status: 404 });

    const next: RefundClusterRecord = {
      ...existing,
      name: patch.name !== undefined ? str(patch.name) || existing.name : existing.name,
      description: patch.description !== undefined ? str(patch.description) : existing.description,
      vatPeriod:
        patch.vatPeriod !== undefined
          ? this.normalizeVatPeriod(patch.vatPeriod)
          : (existing.vatPeriod ?? ''),
      vatYearEndMonth:
        patch.vatYearEndMonth !== undefined
          ? this.normalizeYearEndMonth(patch.vatYearEndMonth)
          : (existing.vatYearEndMonth ?? DEFAULT_VAT_YEAR_END_MONTH),
      archived: patch.archived !== undefined ? Boolean(patch.archived) : existing.archived,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(clusterKey(clusterId), next);
    return next;
  },

  /** Deletes the cluster and every entity + document record inside it. */
  async deleteCluster(clusterId: string): Promise<{ entitiesDeleted: number }> {
    const existing = await this.getCluster(clusterId);
    if (!existing) throw Object.assign(new Error('Cluster not found'), { status: 404 });

    const entities = await this.listEntities(clusterId);
    for (const entity of entities) {
      await this.deleteEntityRecords(clusterId, entity.id);
    }
    const managers = await this.listManagers(clusterId);
    for (const manager of managers) {
      await kv.del(managerKey(clusterId, manager.id));
    }
    await kv.del(clusterKey(clusterId));
    log.info('Cluster deleted', {
      clusterId,
      entitiesDeleted: entities.length,
      managersDeleted: managers.length,
    });
    return { entitiesDeleted: entities.length };
  },

  // --- Entities --------------------------------------------------------

  async listEntities(clusterId: string): Promise<SanitizedEntity[]> {
    const rows = (await kv.getByPrefix(`${ENTITY_PREFIX}${clusterId}:`)) as RefundEntityRecord[];
    return rows
      .filter((row) => row && row.id)
      .map(sanitizeEntity)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getEntityRaw(clusterId: string, entityId: string): Promise<RefundEntityRecord | null> {
    return (
      ((await kv.get(entityKey(clusterId, entityId))) as RefundEntityRecord | undefined) ?? null
    );
  },

  async createEntity(
    clusterId: string,
    input: EntityInput,
    createdBy: string,
  ): Promise<SanitizedEntity> {
    const cluster = await this.getCluster(clusterId);
    if (!cluster) throw Object.assign(new Error('Cluster not found'), { status: 404 });

    if (input.entityType !== 'sole_proprietor' && input.entityType !== 'company') {
      throw Object.assign(new Error('Invalid entity type'), { status: 400 });
    }

    const now = new Date().toISOString();
    const record: RefundEntityRecord = {
      id: newId(),
      clusterId,
      entityType: input.entityType,
      managerId: await this.resolveManagerId(clusterId, input.managerId),
      bankingDetails: {
        primary: await buildStoredBankAccount(undefined, input.bankingDetails?.primary),
        secondary: await buildStoredBankAccount(undefined, input.bankingDetails?.secondary),
      },
      taxDetails: {
        efilingUsername: str(input.taxDetails?.efilingUsername),
        vatPeriod: this.normalizeVatPeriod(input.taxDetails?.vatPeriod),
        currentPeriodVat: str(input.taxDetails?.currentPeriodVat),
        previousPeriodVat: str(input.taxDetails?.previousPeriodVat),
      },
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    if (input.entityType === 'sole_proprietor') {
      record.personalDetails = {
        name: str(input.personalDetails?.name),
        surname: str(input.personalDetails?.surname),
        physicalAddress: str(input.personalDetails?.physicalAddress),
      };
      if (!record.personalDetails.name) {
        throw Object.assign(new Error('Name is required for a sole proprietor'), { status: 400 });
      }
    } else {
      record.businessDetails = {
        companyName: str(input.businessDetails?.companyName),
        registrationNumber: str(input.businessDetails?.registrationNumber),
        tradingName: str(input.businessDetails?.tradingName),
        registeredAddress: str(input.businessDetails?.registeredAddress),
        physicalBusinessAddress: str(input.businessDetails?.physicalBusinessAddress),
        contactPerson: str(input.businessDetails?.contactPerson),
        contactPersonEmail: str(input.businessDetails?.contactPersonEmail),
        contactPersonPhone: str(input.businessDetails?.contactPersonPhone),
      };
      if (!record.businessDetails.companyName) {
        throw Object.assign(new Error('Company name is required'), { status: 400 });
      }
    }

    const password = input.taxDetails?.efilingPassword;
    if (password) {
      record.taxDetails.efilingPasswordEnc = await encryptSecret(password);
    }

    await kv.set(entityKey(clusterId, record.id), record);
    log.info('Entity created', { clusterId, entityId: record.id, type: record.entityType });
    return sanitizeEntity(record);
  },

  async updateEntity(
    clusterId: string,
    entityId: string,
    input: EntityInput,
  ): Promise<SanitizedEntity> {
    const existing = await this.getEntityRaw(clusterId, entityId);
    if (!existing) throw Object.assign(new Error('Entity not found'), { status: 404 });

    const next: RefundEntityRecord = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };

    if (input.managerId !== undefined) {
      next.managerId = await this.resolveManagerId(clusterId, input.managerId);
    }

    if (existing.entityType === 'sole_proprietor' && input.personalDetails) {
      next.personalDetails = {
        name: str(input.personalDetails.name ?? existing.personalDetails?.name),
        surname: str(input.personalDetails.surname ?? existing.personalDetails?.surname),
        physicalAddress: str(
          input.personalDetails.physicalAddress ?? existing.personalDetails?.physicalAddress,
        ),
      };
    }
    if (existing.entityType === 'company' && input.businessDetails) {
      const prev = existing.businessDetails;
      next.businessDetails = {
        companyName: str(input.businessDetails.companyName ?? prev?.companyName),
        registrationNumber: str(
          input.businessDetails.registrationNumber ?? prev?.registrationNumber,
        ),
        tradingName: str(input.businessDetails.tradingName ?? prev?.tradingName),
        registeredAddress: str(input.businessDetails.registeredAddress ?? prev?.registeredAddress),
        physicalBusinessAddress: str(
          input.businessDetails.physicalBusinessAddress ?? prev?.physicalBusinessAddress,
        ),
        contactPerson: str(input.businessDetails.contactPerson ?? prev?.contactPerson),
        contactPersonEmail: str(
          input.businessDetails.contactPersonEmail ?? prev?.contactPersonEmail,
        ),
        contactPersonPhone: str(
          input.businessDetails.contactPersonPhone ?? prev?.contactPersonPhone,
        ),
      };
    }

    if (input.bankingDetails?.primary) {
      next.bankingDetails = {
        ...next.bankingDetails,
        primary: await buildStoredBankAccount(
          existing.bankingDetails.primary,
          input.bankingDetails.primary,
        ),
      };
    }
    if (input.bankingDetails?.secondary) {
      next.bankingDetails = {
        ...next.bankingDetails,
        secondary: await buildStoredBankAccount(
          existing.bankingDetails.secondary,
          input.bankingDetails.secondary,
        ),
      };
    }

    if (input.taxDetails) {
      next.taxDetails = {
        ...existing.taxDetails,
        efilingUsername: str(
          input.taxDetails.efilingUsername ?? existing.taxDetails.efilingUsername,
        ),
        vatPeriod:
          input.taxDetails.vatPeriod !== undefined
            ? this.normalizeVatPeriod(input.taxDetails.vatPeriod)
            : existing.taxDetails.vatPeriod,
        currentPeriodVat: str(
          input.taxDetails.currentPeriodVat ?? existing.taxDetails.currentPeriodVat,
        ),
        previousPeriodVat: str(
          input.taxDetails.previousPeriodVat ?? existing.taxDetails.previousPeriodVat,
        ),
      };
      // Only overwrite the stored secret when a new password is supplied.
      if (input.taxDetails.efilingPassword) {
        next.taxDetails.efilingPasswordEnc = await encryptSecret(input.taxDetails.efilingPassword);
      }
    }

    await kv.set(entityKey(clusterId, entityId), next);
    return sanitizeEntity(next);
  },

  /** Decrypt the stored eFiling password. Caller MUST audit this access. */
  async revealEfilingPassword(clusterId: string, entityId: string): Promise<string> {
    const entity = await this.getEntityRaw(clusterId, entityId);
    if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });
    if (!entity.taxDetails.efilingPasswordEnc) {
      throw Object.assign(new Error('No eFiling password is stored for this entity'), {
        status: 404,
      });
    }
    return decryptSecret(entity.taxDetails.efilingPasswordEnc);
  },

  /** Decrypt a stored online-banking password. Caller MUST audit this access. */
  async revealBankPassword(
    clusterId: string,
    entityId: string,
    account: BankAccountSlot,
  ): Promise<string> {
    if (account !== 'primary' && account !== 'secondary') {
      throw Object.assign(new Error('Invalid bank account'), { status: 400 });
    }
    const entity = await this.getEntityRaw(clusterId, entityId);
    if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });
    const enc = entity.bankingDetails[account]?.onlinePasswordEnc;
    if (!enc) {
      throw Object.assign(new Error('No online banking password is stored for this account'), {
        status: 404,
      });
    }
    return decryptSecret(enc);
  },

  /**
   * Removes the entity record plus its document and transaction metadata
   * (not the underlying storage files — the route removes those first).
   */
  async deleteEntityRecords(clusterId: string, entityId: string): Promise<RefundEntityDocument[]> {
    const docs = await this.listDocuments(entityId);
    for (const doc of docs) {
      await kv.del(docKey(entityId, doc.id));
    }
    const txns = await this.listTransactions(entityId);
    for (const txn of txns) {
      await kv.del(txnKey(entityId, txn.id));
    }
    const submissions = await this.listSubmissions(entityId);
    for (const submission of submissions) {
      await kv.del(submissionKey(entityId, submission.periodKey));
    }
    await kv.del(entityKey(clusterId, entityId));
    return docs;
  },

  normalizeVatPeriod(value: unknown): VatPeriodCategory | '' {
    const v = typeof value === 'string' ? value.toUpperCase().trim() : '';
    return VAT_PERIODS.includes(v) ? (v as VatPeriodCategory | '') : '';
  },

  /** Clamp the tax-year-end month to 1-12, defaulting to February. */
  normalizeYearEndMonth(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    const m = Number.isFinite(n) ? Math.trunc(n) : NaN;
    return m >= 1 && m <= 12 ? m : DEFAULT_VAT_YEAR_END_MONTH;
  },

  // --- Managers --------------------------------------------------------

  async listManagers(clusterId: string): Promise<RefundManagerRecord[]> {
    const rows = (await kv.getByPrefix(`${MANAGER_PREFIX}${clusterId}:`)) as RefundManagerRecord[];
    return rows
      .filter((row) => row && row.id)
      .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
  },

  async getManager(clusterId: string, managerId: string): Promise<RefundManagerRecord | null> {
    return (
      ((await kv.get(managerKey(clusterId, managerId))) as RefundManagerRecord | undefined) ?? null
    );
  },

  /** Returns the id only when it names a manager that exists in the cluster; else undefined. */
  async resolveManagerId(
    clusterId: string,
    managerId: string | null | undefined,
  ): Promise<string | undefined> {
    const id = str(managerId);
    if (!id) return undefined;
    const manager = await this.getManager(clusterId, id);
    return manager ? id : undefined;
  },

  async createManager(
    clusterId: string,
    input: ManagerInput,
    createdBy: string,
  ): Promise<RefundManagerRecord> {
    const cluster = await this.getCluster(clusterId);
    if (!cluster) throw Object.assign(new Error('Cluster not found'), { status: 404 });

    const fields = normalizeManager(input);
    if (!fields.name) throw Object.assign(new Error('Manager name is required'), { status: 400 });

    const now = new Date().toISOString();
    const record: RefundManagerRecord = {
      id: newId(),
      clusterId,
      ...fields,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };
    await kv.set(managerKey(clusterId, record.id), record);
    log.info('Manager created', { clusterId, managerId: record.id });
    return record;
  },

  async updateManager(
    clusterId: string,
    managerId: string,
    input: ManagerInput,
  ): Promise<RefundManagerRecord> {
    const existing = await this.getManager(clusterId, managerId);
    if (!existing) throw Object.assign(new Error('Manager not found'), { status: 404 });

    const fields = normalizeManager(input, existing);
    if (!fields.name) throw Object.assign(new Error('Manager name is required'), { status: 400 });

    const next: RefundManagerRecord = {
      ...existing,
      ...fields,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(managerKey(clusterId, managerId), next);
    return next;
  },

  /** Deletes the manager and clears it from any entity that referenced it. */
  async deleteManager(clusterId: string, managerId: string): Promise<void> {
    const existing = await this.getManager(clusterId, managerId);
    if (!existing) throw Object.assign(new Error('Manager not found'), { status: 404 });

    const entities = (await kv.getByPrefix(
      `${ENTITY_PREFIX}${clusterId}:`,
    )) as RefundEntityRecord[];
    const now = new Date().toISOString();
    for (const entity of entities) {
      if (entity?.id && entity.managerId === managerId) {
        await kv.set(entityKey(clusterId, entity.id), {
          ...entity,
          managerId: undefined,
          updatedAt: now,
        });
      }
    }
    await kv.del(managerKey(clusterId, managerId));
    log.info('Manager deleted', { clusterId, managerId });
  },

  // --- Documents -------------------------------------------------------

  async listDocuments(entityId: string): Promise<RefundEntityDocument[]> {
    const rows = (await kv.getByPrefix(`${DOC_PREFIX}${entityId}:`)) as RefundEntityDocument[];
    return rows
      .filter((row) => row && row.id)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },

  /** All document records across every entity in a cluster. */
  async listClusterDocuments(clusterId: string): Promise<RefundEntityDocument[]> {
    const entities = (await kv.getByPrefix(
      `${ENTITY_PREFIX}${clusterId}:`,
    )) as RefundEntityRecord[];
    const documents: RefundEntityDocument[] = [];
    for (const entity of entities) {
      if (entity?.id) {
        documents.push(...(await this.listDocuments(entity.id)));
      }
    }
    return documents;
  },

  async getDocument(entityId: string, docId: string): Promise<RefundEntityDocument | null> {
    return ((await kv.get(docKey(entityId, docId))) as RefundEntityDocument | undefined) ?? null;
  },

  async saveDocument(
    doc: Omit<RefundEntityDocument, 'id' | 'uploadedAt'>,
  ): Promise<RefundEntityDocument> {
    const record: RefundEntityDocument = {
      ...doc,
      id: newId(),
      uploadedAt: new Date().toISOString(),
    };
    await kv.set(docKey(record.entityId, record.id), record);
    return record;
  },

  async deleteDocument(entityId: string, docId: string): Promise<void> {
    await kv.del(docKey(entityId, docId));
  },

  // --- Transactions ----------------------------------------------------

  async listTransactions(entityId: string): Promise<RefundTransactionRecord[]> {
    const rows = (await kv.getByPrefix(`${TXN_PREFIX}${entityId}:`)) as RefundTransactionRecord[];
    return rows
      .filter((row) => row && row.id)
      .map(migrateTxn)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  /** All transaction records across every entity in a cluster. */
  async listClusterTransactions(clusterId: string): Promise<RefundTransactionRecord[]> {
    const entities = (await kv.getByPrefix(
      `${ENTITY_PREFIX}${clusterId}:`,
    )) as RefundEntityRecord[];
    const txns: RefundTransactionRecord[] = [];
    for (const entity of entities) {
      if (entity?.id) txns.push(...(await this.listTransactions(entity.id)));
    }
    return txns;
  },

  async getTransaction(entityId: string, txnId: string): Promise<RefundTransactionRecord | null> {
    const txn = (await kv.get(txnKey(entityId, txnId))) as RefundTransactionRecord | undefined;
    return txn ? migrateTxn(txn) : null;
  },

  /** Resolve the stored VAT amount from the input (auto unless explicitly overridden). */
  resolveVatAmount(
    amount: number,
    treatment: VatTreatment,
    override: number | undefined,
  ): { vatAmount: number; vatOverridden: boolean } {
    if (override !== undefined && Number.isFinite(override)) {
      const clamped = Math.min(Math.max(round2(override), 0), amount);
      return { vatAmount: clamped, vatOverridden: clamped !== autoVat(amount, treatment) };
    }
    return { vatAmount: autoVat(amount, treatment), vatOverridden: false };
  },

  async createTransaction(
    clusterId: string,
    entityId: string,
    input: TransactionInput,
    createdBy: string,
  ): Promise<RefundTransactionRecord> {
    const entity = await this.getEntityRaw(clusterId, entityId);
    if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });

    const amount = toAmount(input.amount);
    if (amount <= 0)
      throw Object.assign(new Error('Amount must be greater than zero'), {
        status: 400,
      });
    const direction = parseDirection(input.direction);
    const treatment = parseTreatment(input.vatTreatment ?? 'standard');
    const { vatAmount, vatOverridden } = this.resolveVatAmount(amount, treatment, input.vatAmount);

    const now = new Date().toISOString();
    const txnDate = str(input.date) || now.slice(0, 10);
    await this.assertPeriodUnlocked(entityId, txnDate);
    const record: RefundTransactionRecord = {
      id: newId(),
      entityId,
      clusterId,
      date: txnDate,
      description: str(input.description),
      direction,
      vatTreatment: treatment,
      amount,
      vatAmount,
      vatOverridden,
      counterparty: parseCounterparty(input.counterparty),
      category: input.category != null ? str(input.category) || undefined : undefined,
      reference: input.reference != null ? str(input.reference) || undefined : undefined,
      payment: parsePayment(input.payment),
      createdAt: now,
      updatedAt: now,
      createdBy,
    };
    await kv.set(txnKey(entityId, record.id), record);
    return record;
  },

  async updateTransaction(
    entityId: string,
    txnId: string,
    input: TransactionInput,
  ): Promise<RefundTransactionRecord> {
    const existing = await this.getTransaction(entityId, txnId);
    if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });

    const amount = input.amount !== undefined ? toAmount(input.amount) : existing.amount;
    if (amount <= 0)
      throw Object.assign(new Error('Amount must be greater than zero'), {
        status: 400,
      });
    const treatment =
      input.vatTreatment !== undefined ? parseTreatment(input.vatTreatment) : existing.vatTreatment;
    const { vatAmount, vatOverridden } = this.resolveVatAmount(amount, treatment, input.vatAmount);

    const nextDate = input.date !== undefined ? str(input.date) || existing.date : existing.date;
    // Both the current and the target period must be open.
    await this.assertPeriodUnlocked(entityId, existing.date);
    if (nextDate !== existing.date) await this.assertPeriodUnlocked(entityId, nextDate);

    const next: RefundTransactionRecord = {
      ...existing,
      date: nextDate,
      description: input.description !== undefined ? str(input.description) : existing.description,
      direction:
        input.direction !== undefined ? parseDirection(input.direction) : existing.direction,
      vatTreatment: treatment,
      amount,
      vatAmount,
      vatOverridden,
      counterparty: parseCounterparty(input.counterparty, existing.counterparty),
      category:
        input.category !== undefined ? str(input.category ?? '') || undefined : existing.category,
      reference:
        input.reference !== undefined
          ? str(input.reference ?? '') || undefined
          : existing.reference,
      payment: parsePayment(input.payment, existing.payment),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(txnKey(entityId, txnId), next);
    return next;
  },

  /** Removes the transaction metadata (not the invoice storage file). */
  async deleteTransaction(
    entityId: string,
    txnId: string,
  ): Promise<RefundTransactionRecord | null> {
    const existing = await this.getTransaction(entityId, txnId);
    if (existing) {
      await this.assertPeriodUnlocked(entityId, existing.date);
      await kv.del(txnKey(entityId, txnId));
    }
    return existing;
  },

  // --- VAT submissions (period lifecycle + locking) --------------------

  async listSubmissions(entityId: string): Promise<VatSubmissionRecord[]> {
    const rows = (await kv.getByPrefix(
      `${SUBMISSION_PREFIX}${entityId}:`,
    )) as VatSubmissionRecord[];
    return rows
      .filter((row) => row && row.periodKey)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  },

  async getSubmission(entityId: string, pKey: string): Promise<VatSubmissionRecord | null> {
    return (
      ((await kv.get(submissionKey(entityId, pKey))) as VatSubmissionRecord | undefined) ?? null
    );
  },

  /**
   * Upsert a period's submission record. Returns the previous status so the
   * route can audit unlocks (locked → open) at warning severity.
   */
  async upsertSubmission(
    clusterId: string,
    entityId: string,
    pKey: string,
    input: SubmissionInput,
    updatedBy: string,
  ): Promise<{ submission: VatSubmissionRecord; previousStatus: SubmissionStatus | undefined }> {
    const entity = await this.getEntityRaw(clusterId, entityId);
    if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });

    const existing = await this.getSubmission(entityId, pKey);
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const periodStart = str(input.periodStart) || existing?.periodStart || '';
    const periodEnd = str(input.periodEnd) || existing?.periodEnd || '';
    if (!iso.test(periodStart) || !iso.test(periodEnd) || periodStart > periodEnd) {
      throw Object.assign(new Error('periodStart and periodEnd must be ISO dates (start ≤ end)'), {
        status: 400,
      });
    }
    const statuses: SubmissionStatus[] = [
      'open',
      'submitted',
      'verification',
      'refund_received',
      'closed',
    ];
    const status =
      input.status !== undefined
        ? statuses.includes(input.status as SubmissionStatus)
          ? (input.status as SubmissionStatus)
          : undefined
        : (existing?.status ?? 'open');
    if (!status) {
      throw Object.assign(new Error(`status must be one of: ${statuses.join(', ')}`), {
        status: 400,
      });
    }

    const now = new Date().toISOString();
    const record: VatSubmissionRecord = {
      entityId,
      clusterId,
      periodKey: pKey,
      periodStart,
      periodEnd,
      periodLabel:
        input.periodLabel !== undefined
          ? str(input.periodLabel).slice(0, 120)
          : (existing?.periodLabel ?? `${periodStart} to ${periodEnd}`),
      status,
      submittedDate:
        input.submittedDate !== undefined
          ? str(input.submittedDate) || undefined
          : existing?.submittedDate,
      sarsRef: input.sarsRef !== undefined ? str(input.sarsRef) || undefined : existing?.sarsRef,
      refundAmount:
        input.refundAmount !== undefined
          ? Number.isFinite(Number(input.refundAmount))
            ? round2(Number(input.refundAmount))
            : undefined
          : existing?.refundAmount,
      refundReceivedDate:
        input.refundReceivedDate !== undefined
          ? str(input.refundReceivedDate) || undefined
          : existing?.refundReceivedDate,
      notes: input.notes !== undefined ? str(input.notes) : (existing?.notes ?? ''),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy,
    };
    await kv.set(submissionKey(entityId, pKey), record);
    return { submission: record, previousStatus: existing?.status };
  },

  /**
   * Rejects mutations of transactions dated inside a submitted (locked)
   * period. Called by every transaction create/update/delete.
   */
  async assertPeriodUnlocked(entityId: string, dateIso: string): Promise<void> {
    const submissions = await this.listSubmissions(entityId);
    const locking = submissions.find(
      (s) => isLockedStatus(s.status) && dateIso >= s.periodStart && dateIso <= s.periodEnd,
    );
    if (locking) {
      throw Object.assign(
        new Error(
          `The VAT period ${locking.periodLabel} was submitted to SARS and is locked — capture corrections in the current open period instead`,
        ),
        { status: 409 },
      );
    }
  },

  // --- Transaction attachments ----------------------------------------

  /** Adds an evidence file to a transaction. */
  async addAttachment(
    entityId: string,
    txnId: string,
    attachment: Omit<TransactionAttachment, 'id'>,
  ): Promise<{ transaction: RefundTransactionRecord; attachment: TransactionAttachment }> {
    const existing = await this.getTransaction(entityId, txnId);
    if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });
    const stored: TransactionAttachment = { id: newId(), ...attachment };
    const next: RefundTransactionRecord = {
      ...existing,
      attachments: [...(existing.attachments ?? []), stored],
      updatedAt: new Date().toISOString(),
    };
    delete next.invoice; // migrated shape is now persisted
    await kv.set(txnKey(entityId, txnId), next);
    return { transaction: next, attachment: stored };
  },

  async getAttachment(
    entityId: string,
    txnId: string,
    attachmentId: string,
  ): Promise<TransactionAttachment | null> {
    const txn = await this.getTransaction(entityId, txnId);
    return txn?.attachments?.find((a) => a.id === attachmentId) ?? null;
  },

  /** Removes attachment metadata; the route removes the storage file first. */
  async removeAttachment(
    entityId: string,
    txnId: string,
    attachmentId: string,
  ): Promise<RefundTransactionRecord> {
    const existing = await this.getTransaction(entityId, txnId);
    if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });
    const next: RefundTransactionRecord = {
      ...existing,
      attachments: (existing.attachments ?? []).filter((a) => a.id !== attachmentId),
      updatedAt: new Date().toISOString(),
    };
    delete next.invoice;
    await kv.set(txnKey(entityId, txnId), next);
    return next;
  },

  /** Sets the full-tax-invoice verification flag on an attachment. */
  async setAttachmentVerifiedFull(
    entityId: string,
    txnId: string,
    attachmentId: string,
    verifiedFull: boolean,
  ): Promise<RefundTransactionRecord> {
    const existing = await this.getTransaction(entityId, txnId);
    if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });
    if (!existing.attachments?.some((a) => a.id === attachmentId)) {
      throw Object.assign(new Error('Attachment not found'), { status: 404 });
    }
    const next: RefundTransactionRecord = {
      ...existing,
      attachments: existing.attachments.map((a) =>
        a.id === attachmentId ? { ...a, verifiedFull } : a,
      ),
      updatedAt: new Date().toISOString(),
    };
    delete next.invoice;
    await kv.set(txnKey(entityId, txnId), next);
    return next;
  },

  // --- Legacy single-invoice API (kept for existing callers) -----------
  // Operates on the transaction's tax_invoice attachments: attach replaces
  // the first one, remove drops it. New code should use the attachment CRUD.

  async attachTransactionInvoice(
    entityId: string,
    txnId: string,
    invoice: RefundTransactionInvoice,
  ): Promise<RefundTransactionRecord> {
    const existing = await this.getTransaction(entityId, txnId);
    if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });
    const rest = (existing.attachments ?? []).filter((a) => a.kind !== 'tax_invoice');
    const next: RefundTransactionRecord = {
      ...existing,
      attachments: [{ id: newId(), kind: 'tax_invoice', ...invoice }, ...rest],
      updatedAt: new Date().toISOString(),
    };
    delete next.invoice;
    await kv.set(txnKey(entityId, txnId), next);
    return next;
  },

  /** First tax_invoice attachment (what the legacy invoice routes serve). */
  primaryInvoice(txn: RefundTransactionRecord): TransactionAttachment | null {
    return txn.attachments?.find((a) => a.kind === 'tax_invoice') ?? null;
  },

  async removeTransactionInvoice(
    entityId: string,
    txnId: string,
  ): Promise<RefundTransactionRecord> {
    const existing = await this.getTransaction(entityId, txnId);
    if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });
    const primary = this.primaryInvoice(existing);
    const next: RefundTransactionRecord = {
      ...existing,
      attachments: (existing.attachments ?? []).filter((a) => a.id !== primary?.id),
      updatedAt: new Date().toISOString(),
    };
    delete next.invoice;
    await kv.set(txnKey(entityId, txnId), next);
    return next;
  },
};
