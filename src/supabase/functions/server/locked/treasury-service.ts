/**
 * Treasury Service
 *
 * Stripe money-management integration for the Locked → Accounts → Manager panel.
 * Surfaces a financial account's real balance and (when provisioned) its bank
 * (ABA) details, lists transactions, and — in a later phase — moves money.
 *
 * API version: this account's financial account is a Stripe **v2 money
 * management** "storage" financial account (`/v2/money_management/*`), NOT the
 * legacy v1 Treasury API (`/v1/treasury/*`). v1 does not recognise a v2
 * financial account in live mode (it fails with "Unrecognized request URL …
 * only allowed in test mode"), so all financial-account reads go through v2.
 *
 * Talks to the Stripe REST API directly with `fetch` (no npm SDK) so it stays
 * Deno-native and free of Node type dependencies.
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - The Stripe secret key is read from the environment and NEVER leaves the
 *     server. No Stripe key (secret or publishable) is ever sent to the client.
 *   - The financial account lives on the PLATFORM account, so calls are NOT
 *     scoped to STRIPE_CONNECTED_ACCOUNT_ID (that var is for Issuing on the
 *     connected account — a separate concern).
 *   - The full ABA account number is only returned on the explicit, audited
 *     reveal read; otherwise only the last 4 are exposed.
 *
 * Env:
 *   STRIPE_SECRET_KEY            sk_… platform secret key            [required]
 *   STRIPE_FINANCIAL_ACCOUNT_ID fa_…  v2 money-management FA         [required]
 *   STRIPE_MM_API_VERSION       v2 money-management API version override
 *                               (default below; bump if Stripe requires a newer
 *                               preview, no code change needed)
 *
 * @module server/locked/treasury-service
 */

import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('treasury');

/** Treasury operates in USD by default; expose so callers stay consistent. */
export const DEFAULT_CURRENCY = 'usd';

const STRIPE_BASE = 'https://api.stripe.com';

/**
 * API version for the v2 money-management endpoints. This is a preview surface;
 * the value below is the version verified working against the live account.
 * Overridable via env so ops can bump it without a deploy if Stripe rotates it.
 */
const DEFAULT_MM_API_VERSION = '2026-06-24.preview';

function mmApiVersion(): string {
  return Deno.env.get('STRIPE_MM_API_VERSION') || DEFAULT_MM_API_VERSION;
}

// ============================================================================
// Errors
// ============================================================================

export class TreasuryError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'TreasuryError';
  }
}

/** Normalise a thrown error into a {message, status} we can return to the client. */
export function toClientError(error: unknown): { message: string; status: number } {
  if (error instanceof TreasuryError) {
    return { message: error.message, status: error.status };
  }
  return { message: (error as Error)?.message ?? 'Unexpected error', status: 500 };
}

// ============================================================================
// Stripe REST helpers (fetch-based)
// ============================================================================

function requireKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) {
    throw new TreasuryError('Stripe is not configured (STRIPE_SECRET_KEY missing)', 500);
  }
  return key;
}

/** Both v1 and v2 error bodies surface a human message; read either shape. */
function errorMessage(json: unknown, status: number): string {
  const j = json as { error?: { message?: string }; message?: string } | null;
  return j?.error?.message ?? j?.message ?? `Stripe request failed (${status})`;
}

/**
 * v1 GET helper for platform-level reads (`/v1/account`, `/v1/balance`).
 * Deliberately never sends `Stripe-Account`: Treasury reads the platform, not
 * the Issuing connected account.
 */
async function v1Get<T>(path: string): Promise<T> {
  const res = await fetch(`${STRIPE_BASE}/v1${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${requireKey()}` },
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new TreasuryError(errorMessage(json, res.status), status);
  }
  return json as T;
}

/** v2 money-management request helper (JSON bodies, versioned, platform-scoped). */
async function mmRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: {
    query?: Record<string, string | number | string[] | undefined>;
    body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireKey()}`,
    'Stripe-Version': mmApiVersion(),
  };

  let url = `${STRIPE_BASE}${path}`;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null || v === '') continue;
      // v2 expects repeated params in indexed form (e.g. include[0], include[1]).
      if (Array.isArray(v)) v.forEach((item, i) => qs.append(`${k}[${i}]`, String(item)));
      else qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  let body: string | undefined;
  if (opts.body) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { method, headers, body });
  const json = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new TreasuryError(errorMessage(json, res.status), status);
  }
  return json as T;
}

// ============================================================================
// Raw v2 response shapes (only the fields we read)
// ============================================================================

interface V2Amount {
  value: number;
  currency: string;
}
type V2AmountByCurrency = Record<string, V2Amount | undefined>;

interface V2FinancialAccount {
  id: string;
  status: string;
  balance?: {
    available?: V2AmountByCurrency;
    inbound_pending?: V2AmountByCurrency;
    outbound_pending?: V2AmountByCurrency;
  } | null;
  storage?: { holds_currencies?: string[] } | null;
  display_name?: string | null;
  country?: string | null;
}

/**
 * v2 FinancialAddress credentials, discriminated by `type`. A storage financial
 * account exposes one address per held currency, each with its own scheme:
 * US ABA routing, UK sort code, or SEPA BIC/IBAN.
 */
interface V2BankCredential {
  account_holder_name?: string | null;
  bank_name?: string | null;
  last4?: string | null;
  account_number?: string | null;
  /** us_bank_account only. */
  routing_number?: string | null;
  /** gb_bank_account only. */
  sort_code?: string | null;
  /** sepa_bank_account only. */
  bic?: string | null;
  iban?: string | null;
}

interface V2FinancialAddressCredentials {
  type?: string | null;
  us_bank_account?: V2BankCredential | null;
  gb_bank_account?: V2BankCredential | null;
  sepa_bank_account?: V2BankCredential | null;
}

interface V2FinancialAddress {
  id: string;
  currency?: string | null;
  status?: string | null;
  supported_networks?: string[] | null;
  credentials?: V2FinancialAddressCredentials | null;
}

interface V2Transaction {
  id: string;
  amount?: V2Amount | null;
  currency?: string | null;
  status?: string | null;
  category?: string | null;
  flow?: { type?: string | null } | null;
  description?: string | null;
  created?: string | null;
}

interface V2List<T> {
  data: T[];
  next_page_url?: string | null;
  previous_page_url?: string | null;
}

interface RawAccount {
  business_profile?: { name?: string | null } | null;
  company?: { name?: string | null } | null;
}

interface RawBalanceRow {
  amount: number;
  currency: string;
}
interface RawBalance {
  available?: RawBalanceRow[];
  pending?: RawBalanceRow[];
}

// ============================================================================
// DTOs (only the fields the UI needs) — contract unchanged from v1
// ============================================================================

export interface BankDetailsDTO {
  /** Credential scheme: us_bank_account | gb_bank_account | sepa_bank_account. */
  type: string;
  /** Currency this address receives (one address per held currency). */
  currency: string | null;
  status: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  /** Routing number (US), sort code (UK), or BIC (SEPA). */
  routingNumber: string | null;
  /** Full account number / IBAN — only populated on the audited reveal read. */
  accountNumber: string | null;
  accountNumberLast4: string | null;
  supportedNetworks: string[];
}

/** A single currency's balance subtotals within a multi-currency financial account. */
export interface CurrencyBalanceDTO {
  currency: string;
  cash: number;
  inboundPending: number;
  outboundPending: number;
}

export interface FinancialAccountDTO {
  id: string;
  status: string;
  currency: string;
  balance: {
    cash: number;
    inboundPending: number;
    outboundPending: number;
    /** Every held currency's subtotals (storage FAs can hold USD/EUR/GBP/…). */
    perCurrency: CurrencyBalanceDTO[];
  };
  bankDetails: BankDetailsDTO[];
  accountHolderName: string | null;
  activeFeatures: string[];
}

export interface BalanceDTO {
  currency: string;
  cash: number;
  inboundPending: number;
  outboundPending: number;
  /** Every held currency's subtotals; primary fields above mirror perCurrency[0]. */
  perCurrency: CurrencyBalanceDTO[];
}

export interface PlatformBalanceDTO {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

export interface TreasuryTransactionDTO {
  id: string;
  amount: number;
  currency: string;
  status: string;
  flowType: string | null;
  description: string | null;
  created: number;
}

export interface DepositInput {
  amount: number;
  currency?: string;
  originPaymentMethod: string;
  description?: string;
  idempotencyKey: string;
}

export interface SendInput {
  amount: number;
  currency?: string;
  destinationPaymentMethod: string;
  customer?: string;
  description?: string;
  idempotencyKey: string;
}

// ============================================================================
// Mapping helpers
// ============================================================================

function requireFinancialAccountId(): string {
  const id = Deno.env.get('STRIPE_FINANCIAL_ACCOUNT_ID');
  if (!id) {
    throw new TreasuryError('No financial account configured (STRIPE_FINANCIAL_ACCOUNT_ID)', 500);
  }
  return id;
}

/** Pick the primary display currency: prefer USD, else the first currency held. */
function primaryCurrency(fa: V2FinancialAccount): string {
  const held = fa.storage?.holds_currencies ?? [];
  if (held.includes(DEFAULT_CURRENCY)) return DEFAULT_CURRENCY;
  return held[0] ?? DEFAULT_CURRENCY;
}

function amountFor(bucket: V2AmountByCurrency | undefined | null, currency: string): number {
  return bucket?.[currency]?.value ?? 0;
}

/**
 * Every currency the account holds — the declared `holds_currencies` plus any
 * currency that actually appears in a balance bucket — with USD first when held.
 */
function heldCurrencies(fa: V2FinancialAccount): string[] {
  const set = new Set<string>(fa.storage?.holds_currencies ?? []);
  for (const bucket of [
    fa.balance?.available,
    fa.balance?.inbound_pending,
    fa.balance?.outbound_pending,
  ]) {
    if (bucket) for (const k of Object.keys(bucket)) set.add(k);
  }
  if (set.size === 0) set.add(DEFAULT_CURRENCY);
  return [...set].sort((a, b) =>
    a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b),
  );
}

/** Map each held currency's subtotals. */
function mapPerCurrency(fa: V2FinancialAccount): CurrencyBalanceDTO[] {
  const b = fa.balance;
  return heldCurrencies(fa).map((currency) => ({
    currency,
    cash: amountFor(b?.available, currency),
    inboundPending: amountFor(b?.inbound_pending, currency),
    outboundPending: amountFor(b?.outbound_pending, currency),
  }));
}

function mapBalance(fa: V2FinancialAccount): BalanceDTO {
  const perCurrency = mapPerCurrency(fa);
  const primary = perCurrency.find((c) => c.currency === primaryCurrency(fa)) ??
    perCurrency[0] ?? {
      currency: DEFAULT_CURRENCY,
      cash: 0,
      inboundPending: 0,
      outboundPending: 0,
    };
  return { ...primary, perCurrency };
}

/**
 * Fields Stripe only returns when explicitly requested — the full account
 * number (US/UK). Sent only on the audited reveal read.
 *
 * These two are the ONLY values this API version's `include` enum accepts for
 * financial addresses; `credentials.sepa_bank_account.iban` is not a member,
 * and an unrecognised value fails the WHOLE request with `invalid_fields`
 * (verified against the live account). The SEPA address therefore stays
 * masked — Stripe returns its IBAN as an empty string and we surface last4.
 */
const REVEAL_FIELDS = [
  'credentials.us_bank_account.account_number',
  'credentials.gb_bank_account.account_number',
];

function mapBankDetails(addresses: V2FinancialAddress[], reveal: boolean): BankDetailsDTO[] {
  return addresses.map((addr) => {
    const c = addr.credentials ?? {};
    const us = c.us_bank_account ?? null;
    const gb = c.gb_bank_account ?? null;
    const sepa = c.sepa_bank_account ?? null;
    const bank = us ?? gb ?? sepa;
    // The routing identifier differs per scheme.
    const routingNumber = us?.routing_number ?? gb?.sort_code ?? sepa?.bic ?? null;
    // Full number is blank/absent unless revealed; SEPA carries it as the IBAN.
    const fullNumber = us?.account_number ?? gb?.account_number ?? sepa?.iban ?? null;
    return {
      type: c.type ?? 'bank_account',
      currency: addr.currency ?? null,
      status: addr.status ?? null,
      bankName: bank?.bank_name ?? null,
      accountHolderName: bank?.account_holder_name ?? null,
      routingNumber,
      accountNumber: reveal && fullNumber ? fullNumber : null,
      accountNumberLast4: bank?.last4 ?? null,
      supportedNetworks: addr.supported_networks ?? [],
    };
  });
}

/**
 * List the financial account's bank addresses (one per held currency). Best
 * effort: any failure or empty result degrades to "no bank details" rather than
 * breaking the panel — but a failing REVEAL read first retries without the
 * `include` list, so a rejected include enum costs only the full numbers
 * (masked last4 still shows) instead of blanking the whole card.
 */
async function listBankDetails(faId: string, reveal: boolean): Promise<BankDetailsDTO[]> {
  const list = (withReveal: boolean) =>
    mmRequest<V2List<V2FinancialAddress>>('GET', '/v2/money_management/financial_addresses', {
      query: {
        financial_account: faId,
        limit: 10,
        ...(withReveal ? { include: REVEAL_FIELDS } : {}),
      },
    });
  try {
    const res = await list(reveal);
    return mapBankDetails(res.data ?? [], reveal);
  } catch (err) {
    log.error(
      reveal
        ? 'Reveal read of financial addresses failed — retrying masked'
        : 'Failed to list financial addresses (non-fatal)',
      err,
    );
    if (!reveal) return [];
    try {
      const res = await list(false);
      return mapBankDetails(res.data ?? [], false);
    } catch (err2) {
      log.error('Failed to list financial addresses (non-fatal)', err2);
      return [];
    }
  }
}

async function resolveAccountHolderName(): Promise<string | null> {
  try {
    const acct = await v1Get<RawAccount>('/account');
    return acct.business_profile?.name ?? acct.company?.name ?? null;
  } catch (err) {
    log.error('Failed to resolve account holder name (non-fatal)', err);
    return null;
  }
}

// ============================================================================
// Service
// ============================================================================

export const TreasuryService = {
  async getFinancialAccount(revealAccountNumber = false): Promise<FinancialAccountDTO> {
    const faId = requireFinancialAccountId();
    const fa = await mmRequest<V2FinancialAccount>(
      'GET',
      `/v2/money_management/financial_accounts/${faId}`,
    );

    const [accountHolderName, bankDetails] = await Promise.all([
      resolveAccountHolderName(),
      listBankDetails(faId, revealAccountNumber),
    ]);

    const balance = mapBalance(fa);
    return {
      id: fa.id,
      status: fa.status,
      currency: balance.currency,
      balance: {
        cash: balance.cash,
        inboundPending: balance.inboundPending,
        outboundPending: balance.outboundPending,
        perCurrency: balance.perCurrency,
      },
      bankDetails,
      accountHolderName,
      activeFeatures: fa.storage?.holds_currencies ?? [],
    };
  },

  async getBalance(): Promise<BalanceDTO> {
    const faId = requireFinancialAccountId();
    const fa = await mmRequest<V2FinancialAccount>(
      'GET',
      `/v2/money_management/financial_accounts/${faId}`,
    );
    return mapBalance(fa);
  },

  async getPlatformBalance(): Promise<PlatformBalanceDTO> {
    const balance = await v1Get<RawBalance>('/balance');
    const flatten = (rows: RawBalanceRow[] = []) =>
      rows.map((r) => ({ amount: r.amount, currency: r.currency }));
    return { available: flatten(balance.available), pending: flatten(balance.pending) };
  },

  async listTransactions(opts: { limit?: number } = {}): Promise<TreasuryTransactionDTO[]> {
    const faId = requireFinancialAccountId();
    const res = await mmRequest<V2List<V2Transaction>>('GET', '/v2/money_management/transactions', {
      query: {
        financial_account: faId,
        limit: Math.min(Math.max(opts.limit ?? 25, 1), 100),
      },
    });
    return (res.data ?? []).map((t) => ({
      id: t.id,
      amount: t.amount?.value ?? 0,
      currency: t.amount?.currency ?? DEFAULT_CURRENCY,
      status: t.status ?? 'unknown',
      flowType: t.flow?.type ?? t.category ?? null,
      description: t.description ?? null,
      created: t.created ? Math.floor(Date.parse(t.created) / 1000) : 0,
    }));
  },

  // --------------------------------------------------------------------------
  // Money movement — Phase 2 (v2 outbound payments / received credits).
  // The v1 Treasury flows do not work against a v2 financial account, so until
  // the v2 write flows are implemented these surface a clear, actionable error
  // instead of a confusing raw Stripe failure.
  // --------------------------------------------------------------------------

  deposit(_input: DepositInput): Promise<{ id: string; status: string; amount: number }> {
    return Promise.reject(
      new TreasuryError(
        'Funding this financial account is not yet available from this panel — add funds from the Stripe Dashboard for now.',
        400,
      ),
    );
  },

  send(_input: SendInput): Promise<{ id: string; status: string; amount: number }> {
    return Promise.reject(
      new TreasuryError(
        'Sending from this financial account is not yet available from this panel — use the Stripe Dashboard for now.',
        400,
      ),
    );
  },
};
