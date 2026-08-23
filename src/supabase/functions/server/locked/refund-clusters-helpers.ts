/**
 * KV key layout, input normalization, sanitization, and VAT helpers for
 * refund clusters. Moved verbatim from refund-clusters-service.ts; the
 * normalizeVatPeriod/normalizeYearEndMonth/resolveVatAmount service methods
 * live here as module functions (the facade re-binds them).
 */
import type {
  BankAccountDetails,
  BankAccountInput,
  ManagerInput,
  RefundEntityRecord,
  RefundManagerRecord,
  SanitizedBankAccount,
  SanitizedEntity,
  StoredBankAccount,
  TransactionDirection,
  VatPeriodCategory,
  VatTreatment,
} from './refund-clusters-model.ts';
import { encryptSecret } from './refund-clusters-crypto.ts';

export const CLUSTER_PREFIX = 'refund-clusters:cluster:';
export const ENTITY_PREFIX = 'refund-clusters:entity:';
export const DOC_PREFIX = 'refund-clusters:doc:';
export const TXN_PREFIX = 'refund-clusters:txn:';
export const MANAGER_PREFIX = 'refund-clusters:manager:';

export const clusterKey = (clusterId: string) => `${CLUSTER_PREFIX}${clusterId}`;
export const entityKey = (clusterId: string, entityId: string) =>
  `${ENTITY_PREFIX}${clusterId}:${entityId}`;
export const docKey = (entityId: string, docId: string) => `${DOC_PREFIX}${entityId}:${docId}`;
export const txnKey = (entityId: string, txnId: string) => `${TXN_PREFIX}${entityId}:${txnId}`;
export const managerKey = (clusterId: string, managerId: string) =>
  `${MANAGER_PREFIX}${clusterId}:${managerId}`;

export const newId = () => crypto.randomUUID();

// ============================================================================
// Helpers
// ============================================================================

export const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

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
export async function buildStoredBankAccount(
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

export function sanitizeEntity(entity: RefundEntityRecord): SanitizedEntity {
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

export function normalizeManager(input: ManagerInput, base?: RefundManagerRecord) {
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
export const DEFAULT_VAT_YEAR_END_MONTH = 2;

const VAT_RATE = 0.15;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Strictly parse a direction — an unrecognized value is rejected, never silently defaulted. */
export function parseDirection(value: unknown): TransactionDirection {
  if (value === 'income' || value === 'expense') return value;
  throw Object.assign(new Error('Invalid transaction direction'), { status: 400 });
}

/** Strictly parse a VAT treatment. `undefined` is allowed (caller decides the default). */
export function parseTreatment(value: unknown): VatTreatment {
  if (value === 'standard' || value === 'zero_rated' || value === 'exempt') return value;
  throw Object.assign(new Error('Invalid VAT treatment'), { status: 400 });
}

export function toAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? round2(n) : 0;
}

/** VAT-inclusive VAT portion for a standard-rated amount; 0 for zero-rated/exempt. */
function autoVat(amount: number, treatment: VatTreatment): number {
  if (treatment !== 'standard') return 0;
  return round2((amount * VAT_RATE) / (1 + VAT_RATE));
}

export function normalizeVatPeriod(value: unknown): VatPeriodCategory | '' {
  const v = typeof value === 'string' ? value.toUpperCase().trim() : '';
  return VAT_PERIODS.includes(v) ? (v as VatPeriodCategory | '') : '';
}

/** Clamp the tax-year-end month to 1-12, defaulting to February. */
export function normalizeYearEndMonth(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  const m = Number.isFinite(n) ? Math.trunc(n) : NaN;
  return m >= 1 && m <= 12 ? m : DEFAULT_VAT_YEAR_END_MONTH;
}

/** Resolve the stored VAT amount from the input (auto unless explicitly overridden). */
export function resolveVatAmount(
  amount: number,
  treatment: VatTreatment,
  override: number | undefined,
): { vatAmount: number; vatOverridden: boolean } {
  if (override !== undefined && Number.isFinite(override)) {
    const clamped = Math.min(Math.max(round2(override), 0), amount);
    return { vatAmount: clamped, vatOverridden: clamped !== autoVat(amount, treatment) };
  }
  return { vatAmount: autoVat(amount, treatment), vatOverridden: false };
}
