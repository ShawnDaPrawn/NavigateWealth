/**
 * Treasury Service
 *
 * Stripe money-movement integration for the Locked → Accounts → Manager panel.
 * Surfaces a financial account's real balance and bank details, lists recent
 * transactions, and moves money in (InboundTransfer) and out (OutboundPayment).
 *
 * API: Stripe **v2 money-management** (Global Payouts), not the legacy v1
 * Treasury API. This account holds USD/EUR/GBP through Global Payouts, whose
 * objects live under `/v2/money_management/*`. The v1 `/v1/treasury/*` endpoints
 * are a different product (US-only Treasury) and return "Unrecognized request
 * URL … only allowed in test mode" for this account.
 *
 * v2 differences this module accounts for:
 *   - JSON request/response bodies (NOT form-encoded).
 *   - A mandatory `Stripe-Version: <date>.preview` header (env-overridable).
 *   - Monetary amounts are `{ value: <minor units>, currency }` objects.
 *   - `include` (not `expand`) reveals sensitive fields (bank credentials).
 *   - Cursor pagination via a `page` token, not `starting_after`.
 *
 * Talks to the Stripe REST API directly with `fetch` (no npm SDK) so it stays
 * Deno-native and free of Node type dependencies.
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - The Stripe secret key is read from the environment and NEVER leaves the
 *     server. No Stripe key (secret or publishable) is ever sent to the client.
 *   - The full bank account number is only fetched on the explicit, audited
 *     financial-account read (include=credentials).
 *   - Money-moving calls always pass an Idempotency-Key so client retries
 *     cannot double-spend.
 *
 * Env:
 *   STRIPE_SECRET_KEY            sk_… (money-management enabled)   [required]
 *   STRIPE_FINANCIAL_ACCOUNT_ID fa_… pinned financial account     [required for money movement]
 *   STRIPE_API_VERSION          v2 preview version date           [optional; has a default]
 *   STRIPE_CONNECTED_ACCOUNT_ID acct_… connected account owner    [optional; v1 reads only]
 *
 * @module server/locked/treasury-service
 */

import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('treasury');

/** Default reporting currency when an account holds multiple. */
export const DEFAULT_CURRENCY = 'usd';

const STRIPE_V1_BASE = 'https://api.stripe.com/v1';
const STRIPE_V2_BASE = 'https://api.stripe.com/v2';

/**
 * The v2 API requires a dated preview version header, and the accepted date
 * floats with Stripe's monthly releases. Default to a recent preview tag but
 * allow an env override so the value can be corrected WITHOUT a code change if
 * Stripe rejects it (a wrong/expired tag returns a version error naming the
 * accepted one).
 */
const DEFAULT_STRIPE_API_VERSION = '2025-09-30.preview';
function stripeApiVersion(): string {
  return Deno.env.get('STRIPE_API_VERSION')?.trim() || DEFAULT_STRIPE_API_VERSION;
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

/** Encode a (possibly nested) object into Stripe's v1 bracketed form syntax. */
function encodeForm(obj: Record<string, unknown>): string {
  const params = new URLSearchParams();
  const add = (key: string, val: unknown) => {
    if (val === undefined || val === null) return;
    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (item !== null && typeof item === 'object') add(`${key}[${i}]`, item);
        else add(`${key}[]`, item);
      });
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) add(`${key}[${k}]`, v);
    } else {
      params.append(key, String(val));
    }
  };
  for (const [k, v] of Object.entries(obj)) add(k, v);
  return params.toString();
}

function requireSecretKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) {
    throw new TreasuryError('Stripe is not configured (STRIPE_SECRET_KEY missing)', 500);
  }
  return key;
}

/** Map a Stripe (v1 or v2) error body + HTTP status into a TreasuryError. */
function stripeFailure(
  json: { error?: { message?: string }; message?: string },
  httpStatus: number,
): never {
  const message = json?.error?.message ?? json?.message ?? `Stripe request failed (${httpStatus})`;
  const status = httpStatus >= 400 && httpStatus < 500 ? httpStatus : 502;
  throw new TreasuryError(message, status);
}

interface StripeV1RequestOptions {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  /** Skip the Stripe-Account header (e.g. when retrieving the platform account). */
  skipAccountHeader?: boolean;
}

/** Legacy v1 request — used only for `/v1/balance` and `/v1/account`. */
async function stripeV1Request<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: StripeV1RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${requireSecretKey()}` };
  const connectedAccount = Deno.env.get('STRIPE_CONNECTED_ACCOUNT_ID');
  if (connectedAccount && !opts.skipAccountHeader) headers['Stripe-Account'] = connectedAccount;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let url = `${STRIPE_V1_BASE}${path}`;
  if (opts.query) {
    const qs = encodeForm(opts.query);
    if (qs) url += `?${qs}`;
  }
  let body: string | undefined;
  if (opts.body) {
    body = encodeForm(opts.body);
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const res = await fetch(url, { method, headers, body });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) stripeFailure(json, res.status);
  return json as T;
}

/** Encode v2 query params: scalars plus bracket-indexed arrays (e.g. include[0]=credentials). */
function encodeV2Query(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(query)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      val.forEach((item, i) => params.append(`${key}[${i}]`, String(item)));
    } else {
      params.append(key, String(val));
    }
  }
  return params.toString();
}

interface StripeV2RequestOptions {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  /** v2 replacement for Stripe-Account; scopes a call to a recipient/connected account. */
  stripeContext?: string;
}

/** v2 money-management request — JSON bodies + mandatory preview version header. */
async function stripeV2Request<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: StripeV2RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireSecretKey()}`,
    'Stripe-Version': stripeApiVersion(),
  };
  if (opts.stripeContext) headers['Stripe-Context'] = opts.stripeContext;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let url = `${STRIPE_V2_BASE}${path}`;
  if (opts.query) {
    const qs = encodeV2Query(opts.query);
    if (qs) url += `?${qs}`;
  }
  let body: string | undefined;
  if (opts.body) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { method, headers, body });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    message?: string;
  };
  if (!res.ok) stripeFailure(json, res.status);
  return json as T;
}

// ============================================================================
// Raw Stripe v2 response shapes (only the fields we read)
// ============================================================================

/** A v2 money amount: integer minor units + lowercase ISO currency. */
interface V2Amount {
  value: number;
  currency: string;
}

interface RawV2FinancialAccount {
  id: string;
  status?: string;
  /** Sub-totals; leaf shape is tolerated (see amountForCurrency). */
  balance?: {
    available?: unknown;
    inbound_pending?: unknown;
    outbound_pending?: unknown;
  } | null;
  active_features?: string[] | null;
}

interface RawV2FinancialAddress {
  id?: string;
  type?: string | null;
  currency?: string | null;
  status?: string | null;
  supported_networks?: string[] | null;
  /** Bank credentials — only present when requested via include=credentials. */
  credentials?: Record<string, unknown> | null;
  [k: string]: unknown;
}

interface RawV2Transaction {
  id: string;
  amount?: V2Amount | null;
  status?: string | null;
  description?: string | null;
  created?: string | number | null;
  flow?: { type?: string | null } | null;
  flow_type?: string | null;
}

interface RawV2List<T> {
  data: T[];
  next_page_url?: string | null;
  previous_page_url?: string | null;
}

interface RawV2Movement {
  id: string;
  status?: string | null;
  amount?: V2Amount | null;
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
// DTOs (only the fields the UI needs) — UNCHANGED public contract
// ============================================================================

export interface BankDetailsDTO {
  type: string;
  bankName: string | null;
  routingNumber: string | null;
  /** Full account number — only populated on the audited reveal read. */
  accountNumber: string | null;
  accountNumberLast4: string | null;
  supportedNetworks: string[];
}

export interface FinancialAccountDTO {
  id: string;
  status: string;
  currency: string;
  balance: { cash: number; inboundPending: number; outboundPending: number };
  bankDetails: BankDetailsDTO[];
  accountHolderName: string | null;
  activeFeatures: string[];
}

export interface BalanceDTO {
  currency: string;
  cash: number;
  inboundPending: number;
  outboundPending: number;
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
  /** v2: a verified external bank account id (the InboundTransfer `payment_method`). */
  originPaymentMethod: string;
  description?: string;
  idempotencyKey: string;
}

export interface SendInput {
  amount: number;
  currency?: string;
  /** v2: a PayoutMethod id (frba_…) passed as the OutboundPayment `to.payout_method`. */
  destinationPaymentMethod: string;
  /**
   * v2: the recipient that receives the payment. Maps to the OutboundPayment
   * `recipient` (an Accounts-v2 acct_… id) and the `Stripe-Context` header.
   */
  customer?: string;
  description?: string;
  idempotencyKey: string;
}

// ============================================================================
// v2 parsing helpers (tolerant — leaf shapes are doc-confirmed-but-not-verified)
// ============================================================================

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Read a minor-unit amount for `currency` from a v2 balance sub-total, tolerating
 * every documented/plausible shape:
 *   - currency-keyed map of ints:        { usd: 250000 }
 *   - currency-keyed map of Amounts:     { usd: { value: 250000, currency: 'usd' } }
 *   - a single Amount object:            { value: 250000, currency: 'usd' }
 *   - a list of Amount objects:          [ { value: 250000, currency: 'usd' } ]
 */
function amountForCurrency(node: unknown, currency: string): number {
  if (node == null) return 0;
  const cur = currency.toLowerCase();
  if (Array.isArray(node)) {
    const match = node.find((x) => isRecord(x) && String(x.currency ?? '').toLowerCase() === cur);
    return match && isRecord(match) && typeof match.value === 'number' ? match.value : 0;
  }
  if (isRecord(node)) {
    // Single Amount object.
    if (typeof node.value === 'number' && typeof node.currency === 'string') {
      return String(node.currency).toLowerCase() === cur ? node.value : 0;
    }
    // Currency-keyed map.
    const entry = node[cur] ?? node[currency];
    if (typeof entry === 'number') return entry;
    if (isRecord(entry) && typeof entry.value === 'number') return entry.value;
  }
  return 0;
}

/** Collect the lowercase currency codes present in a v2 balance sub-total. */
function currenciesIn(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node
      .map((x) => (isRecord(x) ? String(x.currency ?? '').toLowerCase() : ''))
      .filter(Boolean);
  }
  if (isRecord(node)) {
    if (typeof node.value === 'number' && typeof node.currency === 'string') {
      return [String(node.currency).toLowerCase()];
    }
    return Object.keys(node).filter((k) => k !== 'value' && k !== 'currency');
  }
  return [];
}

/** Pick the reporting currency for an account: prefer USD, else the first present. */
function resolveAccountCurrency(fa: RawV2FinancialAccount): string {
  const found = new Set<string>();
  for (const bucket of [
    fa.balance?.available,
    fa.balance?.inbound_pending,
    fa.balance?.outbound_pending,
  ]) {
    for (const c of currenciesIn(bucket)) found.add(c);
  }
  if (found.has(DEFAULT_CURRENCY)) return DEFAULT_CURRENCY;
  return [...found][0] ?? DEFAULT_CURRENCY;
}

function mapV2Balance(fa: RawV2FinancialAccount, currency: string): BalanceDTO {
  return {
    currency,
    cash: amountForCurrency(fa.balance?.available, currency),
    inboundPending: amountForCurrency(fa.balance?.inbound_pending, currency),
    outboundPending: amountForCurrency(fa.balance?.outbound_pending, currency),
  };
}

/**
 * Map a v2 FinancialAddress into our BankDetailsDTO. The exact credentials
 * nesting is not doc-verified, so probe the plausible paths and fall back
 * gracefully (an empty/partial entry is better than a thrown read).
 */
function mapV2BankDetails(addr: RawV2FinancialAddress): BankDetailsDTO {
  const type = String(addr.type ?? addr.currency ?? 'bank');
  const cred = isRecord(addr.credentials) ? addr.credentials : {};
  // Credentials may be flat, or nested under a network key (aba / gb / iban / type).
  const nestedCandidates = [
    cred[type],
    cred.aba,
    cred.gb_bank_account,
    cred.sort_code_account,
    cred.iban_account,
    cred.sepa,
  ].find(isRecord);
  const sub: Record<string, unknown> = nestedCandidates ?? cred;

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = sub[k] ?? cred[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return null;
  };

  const accountNumber = pick('account_number', 'iban');
  const last4 =
    pick('account_number_last4', 'last4') ?? (accountNumber ? accountNumber.slice(-4) : null);

  return {
    type,
    bankName: pick('bank_name'),
    routingNumber: pick('routing_number', 'sort_code', 'bic', 'swift'),
    accountNumber,
    accountNumberLast4: last4,
    supportedNetworks: Array.isArray(addr.supported_networks) ? addr.supported_networks : [],
  };
}

/** Read a minor-unit integer from a v2 Amount object (or a bare number). */
function movementAmount(amount: V2Amount | null | undefined): number {
  if (amount && typeof amount.value === 'number') return amount.value;
  return 0;
}

/** Normalise a v2 created field (RFC3339 string or epoch) to Unix seconds. */
function toEpochSeconds(created: string | number | null | undefined): number {
  if (typeof created === 'number') return created;
  if (typeof created === 'string') {
    const ms = Date.parse(created);
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  }
  return 0;
}

function requireFinancialAccountId(): string {
  const id = Deno.env.get('STRIPE_FINANCIAL_ACCOUNT_ID');
  if (!id) {
    throw new TreasuryError('No financial account configured (STRIPE_FINANCIAL_ACCOUNT_ID)', 500);
  }
  return id;
}

// ============================================================================
// Service
// ============================================================================

export const TreasuryService = {
  async getFinancialAccount(revealAccountNumber = false): Promise<FinancialAccountDTO> {
    const faId = requireFinancialAccountId();
    const fa = await stripeV2Request<RawV2FinancialAccount>(
      'GET',
      `/money_management/financial_accounts/${faId}`,
    );

    const currency = resolveAccountCurrency(fa);
    const balance = mapV2Balance(fa, currency);

    // Bank details — non-fatal: a failure here must not block the balance read.
    let bankDetails: BankDetailsDTO[] = [];
    try {
      const addresses = await stripeV2Request<RawV2List<RawV2FinancialAddress>>(
        'GET',
        '/money_management/financial_addresses',
        {
          query: {
            financial_account: faId,
            limit: 100,
            ...(revealAccountNumber ? { include: ['credentials'] } : {}),
          },
        },
      );
      bankDetails = (addresses.data ?? []).map(mapV2BankDetails);
    } catch (err) {
      log.error('Failed to resolve financial addresses (non-fatal)', err);
    }

    // Account holder name — non-fatal; the platform account still lives on v1.
    let accountHolderName: string | null = null;
    try {
      const connectedAccount = Deno.env.get('STRIPE_CONNECTED_ACCOUNT_ID');
      const acct = connectedAccount
        ? await stripeV1Request<RawAccount>('GET', `/accounts/${connectedAccount}`, {
            skipAccountHeader: true,
          })
        : await stripeV1Request<RawAccount>('GET', '/account', { skipAccountHeader: true });
      accountHolderName = acct.business_profile?.name ?? acct.company?.name ?? null;
    } catch (err) {
      log.error('Failed to resolve account holder name (non-fatal)', err);
    }

    return {
      id: fa.id,
      status: fa.status ?? 'unknown',
      currency,
      balance: {
        cash: balance.cash,
        inboundPending: balance.inboundPending,
        outboundPending: balance.outboundPending,
      },
      bankDetails,
      accountHolderName,
      activeFeatures: fa.active_features ?? [],
    };
  },

  async getBalance(): Promise<BalanceDTO> {
    const faId = requireFinancialAccountId();
    const fa = await stripeV2Request<RawV2FinancialAccount>(
      'GET',
      `/money_management/financial_accounts/${faId}`,
    );
    return mapV2Balance(fa, resolveAccountCurrency(fa));
  },

  async getPlatformBalance(): Promise<PlatformBalanceDTO> {
    // The classic payments balance is still a v1 resource.
    const balance = await stripeV1Request<RawBalance>('GET', '/balance');
    const flatten = (rows: RawBalanceRow[] = []) =>
      rows.map((r) => ({ amount: r.amount, currency: r.currency }));
    return { available: flatten(balance.available), pending: flatten(balance.pending) };
  },

  async listTransactions(
    opts: { limit?: number; starting_after?: string } = {},
  ): Promise<TreasuryTransactionDTO[]> {
    const res = await stripeV2Request<RawV2List<RawV2Transaction>>(
      'GET',
      '/money_management/transactions',
      {
        query: {
          limit: Math.min(Math.max(opts.limit ?? 25, 1), 100),
          // v2 paginates with an opaque page token rather than starting_after.
          ...(opts.starting_after ? { page: opts.starting_after } : {}),
        },
      },
    );
    return (res.data ?? []).map((t) => ({
      id: t.id,
      amount: movementAmount(t.amount),
      currency: t.amount?.currency ?? DEFAULT_CURRENCY,
      status: t.status ?? 'unknown',
      flowType: t.flow?.type ?? t.flow_type ?? null,
      description: t.description ?? null,
      created: toEpochSeconds(t.created),
    }));
  },

  async deposit(input: DepositInput): Promise<{ id: string; status: string; amount: number }> {
    const faId = requireFinancialAccountId();
    const transfer = await stripeV2Request<RawV2Movement>(
      'POST',
      '/money_management/inbound_transfers',
      {
        idempotencyKey: input.idempotencyKey,
        body: {
          financial_account: faId,
          amount: { value: input.amount, currency: input.currency ?? DEFAULT_CURRENCY },
          payment_method: input.originPaymentMethod,
          ...(input.description ? { description: input.description } : {}),
        },
      },
    );
    return {
      id: transfer.id,
      status: transfer.status ?? 'unknown',
      amount: movementAmount(transfer.amount),
    };
  },

  async send(input: SendInput): Promise<{ id: string; status: string; amount: number }> {
    const faId = requireFinancialAccountId();
    const payment = await stripeV2Request<RawV2Movement>(
      'POST',
      '/money_management/outbound_payments',
      {
        idempotencyKey: input.idempotencyKey,
        // OutboundPayment to a recipient is scoped via Stripe-Context.
        ...(input.customer ? { stripeContext: input.customer } : {}),
        body: {
          financial_account: faId,
          amount: { value: input.amount, currency: input.currency ?? DEFAULT_CURRENCY },
          ...(input.customer ? { recipient: input.customer } : {}),
          to: { payout_method: input.destinationPaymentMethod },
          ...(input.description ? { description: input.description } : {}),
        },
      },
    );
    return {
      id: payment.id,
      status: payment.status ?? 'unknown',
      amount: movementAmount(payment.amount),
    };
  },
};
