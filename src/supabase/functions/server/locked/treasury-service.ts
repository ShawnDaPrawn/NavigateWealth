/**
 * Treasury Service
 *
 * Stripe Treasury integration for the Locked → Accounts → Manager panel.
 * Surfaces a financial account's real balance and bank (ABA) details, and
 * moves money in (InboundTransfer) and out (OutboundPayment).
 *
 * Talks to the Stripe REST API directly with `fetch` (no npm SDK) so it stays
 * Deno-native and free of Node type dependencies.
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - The Stripe secret key is read from the environment and NEVER leaves the
 *     server. No Stripe key (secret or publishable) is ever sent to the client.
 *   - Treasury financial accounts can live on a connected account; when
 *     STRIPE_CONNECTED_ACCOUNT_ID is set every call is scoped to it via the
 *     Stripe-Account header.
 *   - The full ABA account number is only fetched on the explicit, audited
 *     financial-account read (expand financial_addresses.aba.account_number).
 *   - Money-moving calls always pass an Idempotency-Key so client retries
 *     cannot double-spend.
 *
 * Env:
 *   STRIPE_SECRET_KEY            sk_… (Treasury-enabled)        [required]
 *   STRIPE_FINANCIAL_ACCOUNT_ID fba_… pinned financial account [required for money movement]
 *   STRIPE_CONNECTED_ACCOUNT_ID acct_… connected account owner [optional]
 *
 * @module server/locked/treasury-service
 */

import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('treasury');

/** Treasury operates in USD; expose as a constant so callers stay consistent. */
export const DEFAULT_CURRENCY = 'usd';

const STRIPE_BASE = 'https://api.stripe.com/v1';

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
// Stripe REST helper (fetch-based)
// ============================================================================

/** Encode a (possibly nested) object into Stripe's bracketed form syntax. */
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

interface StripeRequestOptions {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  /** Skip the Stripe-Account header (e.g. when retrieving a connected account). */
  skipAccountHeader?: boolean;
}

async function stripeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: StripeRequestOptions = {},
): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) {
    throw new TreasuryError('Stripe is not configured (STRIPE_SECRET_KEY missing)', 500);
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  const connectedAccount = Deno.env.get('STRIPE_CONNECTED_ACCOUNT_ID');
  if (connectedAccount && !opts.skipAccountHeader) headers['Stripe-Account'] = connectedAccount;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let url = `${STRIPE_BASE}${path}`;
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
  if (!res.ok) {
    const message = json?.error?.message ?? `Stripe request failed (${res.status})`;
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new TreasuryError(message, status);
  }
  return json as T;
}

// ============================================================================
// Raw Stripe response shapes (only the fields we read)
// ============================================================================

type Bucket = Record<string, number>;

interface RawAba {
  bank_name?: string | null;
  routing_number?: string | null;
  account_number?: string | null;
  account_number_last4?: string | null;
}

interface RawFinancialAddress {
  type: string;
  supported_networks?: string[] | null;
  aba?: RawAba | null;
}

interface RawFinancialAccount {
  id: string;
  status: string;
  balance?: { cash?: Bucket; inbound_pending?: Bucket; outbound_pending?: Bucket } | null;
  financial_addresses?: RawFinancialAddress[] | null;
  active_features?: string[] | null;
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

interface RawTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  flow_type?: string | null;
  description?: string | null;
  created: number;
}

interface RawList<T> {
  data: T[];
}

interface RawMovement {
  id: string;
  status: string;
  amount: number;
}

// ============================================================================
// DTOs (only the fields the UI needs)
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
  originPaymentMethod: string;
  description?: string;
  idempotencyKey: string;
}

export interface SendInput {
  amount: number;
  currency?: string;
  destinationPaymentMethod: string;
  /**
   * The customer that owns the destination PaymentMethod. Stripe requires this
   * when `destination_payment_method` is a reusable, customer-attached PM (the
   * common case for a saved external bank account).
   */
  customer?: string;
  description?: string;
  idempotencyKey: string;
}

// ============================================================================
// Mapping helpers
// ============================================================================

function bucketAmount(bucket: Bucket | undefined | null, currency: string): number {
  if (!bucket) return 0;
  return bucket[currency] ?? 0;
}

function faCurrency(fa: RawFinancialAccount): string {
  const cash = fa.balance?.cash ?? {};
  return Object.keys(cash)[0] ?? DEFAULT_CURRENCY;
}

function mapBankDetails(fa: RawFinancialAccount): BankDetailsDTO[] {
  return (fa.financial_addresses ?? []).map((addr) => ({
    type: addr.type,
    bankName: addr.aba?.bank_name ?? null,
    routingNumber: addr.aba?.routing_number ?? null,
    accountNumber: addr.aba?.account_number ?? null,
    accountNumberLast4: addr.aba?.account_number_last4 ?? null,
    supportedNetworks: addr.supported_networks ?? [],
  }));
}

function mapBalance(fa: RawFinancialAccount): BalanceDTO {
  const currency = faCurrency(fa);
  const b = fa.balance;
  return {
    currency,
    cash: bucketAmount(b?.cash, currency),
    inboundPending: bucketAmount(b?.inbound_pending, currency),
    outboundPending: bucketAmount(b?.outbound_pending, currency),
  };
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
    const fa = await stripeRequest<RawFinancialAccount>(
      'GET',
      `/treasury/financial_accounts/${faId}`,
      revealAccountNumber ? { query: { expand: ['financial_addresses.aba.account_number'] } } : {},
    );

    let accountHolderName: string | null = null;
    try {
      const connectedAccount = Deno.env.get('STRIPE_CONNECTED_ACCOUNT_ID');
      const acct = connectedAccount
        ? await stripeRequest<RawAccount>('GET', `/accounts/${connectedAccount}`, {
            skipAccountHeader: true,
          })
        : await stripeRequest<RawAccount>('GET', '/account', { skipAccountHeader: true });
      accountHolderName = acct.business_profile?.name ?? acct.company?.name ?? null;
    } catch (err) {
      log.error('Failed to resolve account holder name (non-fatal)', err);
    }

    const balance = mapBalance(fa);
    return {
      id: fa.id,
      status: fa.status,
      currency: balance.currency,
      balance: {
        cash: balance.cash,
        inboundPending: balance.inboundPending,
        outboundPending: balance.outboundPending,
      },
      bankDetails: mapBankDetails(fa),
      accountHolderName,
      activeFeatures: fa.active_features ?? [],
    };
  },

  async getBalance(): Promise<BalanceDTO> {
    const faId = requireFinancialAccountId();
    const fa = await stripeRequest<RawFinancialAccount>(
      'GET',
      `/treasury/financial_accounts/${faId}`,
    );
    return mapBalance(fa);
  },

  async getPlatformBalance(): Promise<PlatformBalanceDTO> {
    const balance = await stripeRequest<RawBalance>('GET', '/balance');
    const flatten = (rows: RawBalanceRow[] = []) =>
      rows.map((r) => ({ amount: r.amount, currency: r.currency }));
    return { available: flatten(balance.available), pending: flatten(balance.pending) };
  },

  async listTransactions(
    opts: { limit?: number; starting_after?: string } = {},
  ): Promise<TreasuryTransactionDTO[]> {
    const faId = requireFinancialAccountId();
    const res = await stripeRequest<RawList<RawTransaction>>('GET', '/treasury/transactions', {
      query: {
        financial_account: faId,
        limit: Math.min(Math.max(opts.limit ?? 25, 1), 100),
        ...(opts.starting_after ? { starting_after: opts.starting_after } : {}),
      },
    });
    return res.data.map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      flowType: t.flow_type ?? null,
      description: t.description ?? null,
      created: t.created,
    }));
  },

  async deposit(input: DepositInput): Promise<{ id: string; status: string; amount: number }> {
    const faId = requireFinancialAccountId();
    const transfer = await stripeRequest<RawMovement>('POST', '/treasury/inbound_transfers', {
      idempotencyKey: input.idempotencyKey,
      body: {
        financial_account: faId,
        amount: input.amount,
        currency: input.currency ?? DEFAULT_CURRENCY,
        origin_payment_method: input.originPaymentMethod,
        ...(input.description ? { description: input.description } : {}),
      },
    });
    return { id: transfer.id, status: transfer.status, amount: transfer.amount };
  },

  async send(input: SendInput): Promise<{ id: string; status: string; amount: number }> {
    const faId = requireFinancialAccountId();
    const payment = await stripeRequest<RawMovement>('POST', '/treasury/outbound_payments', {
      idempotencyKey: input.idempotencyKey,
      body: {
        financial_account: faId,
        amount: input.amount,
        currency: input.currency ?? DEFAULT_CURRENCY,
        destination_payment_method: input.destinationPaymentMethod,
        ...(input.customer ? { customer: input.customer } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
    });
    return { id: payment.id, status: payment.status, amount: payment.amount };
  },
};
