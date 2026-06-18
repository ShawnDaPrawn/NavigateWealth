/**
 * Treasury Service
 *
 * Stripe Treasury integration for the Locked → Accounts → Manager panel.
 * Surfaces a financial account's real balance and bank (ABA) details, and
 * moves money in (InboundTransfer) and out (OutboundPayment).
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - The Stripe secret key is read from the environment and NEVER leaves the
 *     server. No Stripe key (secret or publishable) is ever sent to the client.
 *   - Treasury financial accounts live on a connected account; when
 *     STRIPE_CONNECTED_ACCOUNT_ID is set every call is scoped to it via the
 *     `stripeAccount` request option (the Stripe-Account header).
 *   - The full ABA account number is only fetched on the explicit, audited
 *     financial-account read (expand: financial_addresses.aba.account_number).
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

import Stripe from 'npm:stripe@17';
import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('treasury');

/** Treasury operates in USD; expose as a constant so callers stay consistent. */
export const DEFAULT_CURRENCY = 'usd';

// ============================================================================
// Stripe client (lazy)
// ============================================================================

let _stripe: Stripe | null = null;

/**
 * Lazily construct the Stripe client. Built on first use (never at module load)
 * so a missing key cannot crash edge-function deployment — it surfaces as a
 * clean 500 on the first request instead. Uses the fetch HTTP client because
 * Deno has no Node http module.
 */
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) {
    throw new TreasuryError('Stripe is not configured (STRIPE_SECRET_KEY missing)', 500);
  }
  _stripe = new Stripe(key, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: 'NavigateWealth Treasury Manager' },
  });
  return _stripe;
}

/** Request options applied to every Treasury call (connected-account scoping). */
function requestOptions(extra: Stripe.RequestOptions = {}): Stripe.RequestOptions {
  const connectedAccount = Deno.env.get('STRIPE_CONNECTED_ACCOUNT_ID');
  return connectedAccount ? { stripeAccount: connectedAccount, ...extra } : extra;
}

/** Resolve the pinned financial account id, or throw a clear error. */
function requireFinancialAccountId(): string {
  const id = Deno.env.get('STRIPE_FINANCIAL_ACCOUNT_ID');
  if (!id) {
    throw new TreasuryError('No financial account configured (STRIPE_FINANCIAL_ACCOUNT_ID)', 500);
  }
  return id;
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

/** Normalise a thrown Stripe/Treasury error into a {message, status} we can return. */
export function toClientError(error: unknown): { message: string; status: number } {
  if (error instanceof TreasuryError) {
    return { message: error.message, status: error.status };
  }
  // Stripe SDK errors carry statusCode + a user-safe message.
  const e = error as { statusCode?: number; message?: string; type?: string };
  if (typeof e?.statusCode === 'number') {
    // 4xx are caller errors (bad amount, insufficient funds, etc.) — surface them.
    const status = e.statusCode >= 400 && e.statusCode < 500 ? e.statusCode : 502;
    return { message: e.message ?? 'Stripe request failed', status };
  }
  return { message: (error as Error)?.message ?? 'Unexpected error', status: 500 };
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
  description?: string;
  idempotencyKey: string;
}

// ============================================================================
// Mapping helpers
// ============================================================================

/** Sum a Treasury balance bucket ({usd: n, …}) for a single currency. */
function bucketAmount(bucket: Record<string, number> | undefined, currency: string): number {
  if (!bucket) return 0;
  return bucket[currency] ?? 0;
}

/** Pick the currency a financial account reports its cash balance in. */
function faCurrency(fa: Stripe.Treasury.FinancialAccount): string {
  const cash = (fa.balance?.cash ?? {}) as Record<string, number>;
  return Object.keys(cash)[0] ?? DEFAULT_CURRENCY;
}

function mapBankDetails(fa: Stripe.Treasury.FinancialAccount): BankDetailsDTO[] {
  return (fa.financial_addresses ?? []).map((addr) => {
    const aba = addr.aba;
    return {
      type: addr.type,
      bankName: aba?.bank_name ?? null,
      routingNumber: aba?.routing_number ?? null,
      // Present only when expanded with financial_addresses.aba.account_number.
      accountNumber: aba?.account_number ?? null,
      accountNumberLast4: aba?.account_number_last4 ?? null,
      supportedNetworks: (addr.supported_networks ?? []) as string[],
    };
  });
}

function mapBalance(fa: Stripe.Treasury.FinancialAccount): BalanceDTO {
  const currency = faCurrency(fa);
  const b = fa.balance;
  return {
    currency,
    cash: bucketAmount(b?.cash as Record<string, number>, currency),
    inboundPending: bucketAmount(b?.inbound_pending as Record<string, number>, currency),
    outboundPending: bucketAmount(b?.outbound_pending as Record<string, number>, currency),
  };
}

// ============================================================================
// Service
// ============================================================================

export const TreasuryService = {
  /**
   * Retrieve the pinned financial account, including its real ABA bank details.
   * When `revealAccountNumber` is true the full account number is expanded —
   * callers MUST audit that read.
   */
  async getFinancialAccount(revealAccountNumber = false): Promise<FinancialAccountDTO> {
    const faId = requireFinancialAccountId();
    const stripe = getStripe();
    const params: Stripe.Treasury.FinancialAccountRetrieveParams = revealAccountNumber
      ? { expand: ['financial_addresses.aba.account_number'] }
      : {};
    const fa = await stripe.treasury.financialAccounts.retrieve(faId, params, requestOptions());

    let accountHolderName: string | null = null;
    try {
      // Best-effort: the account holder is the (connected) account's business name.
      const acctId = Deno.env.get('STRIPE_CONNECTED_ACCOUNT_ID');
      if (acctId) {
        const acct = await stripe.accounts.retrieve(acctId);
        accountHolderName = acct.business_profile?.name ?? acct.company?.name ?? null;
      }
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
      activeFeatures: (fa.active_features ?? []) as string[],
    };
  },

  /** Treasury cash balance for the pinned financial account. */
  async getBalance(): Promise<BalanceDTO> {
    const faId = requireFinancialAccountId();
    const fa = await getStripe().treasury.financialAccounts.retrieve(faId, {}, requestOptions());
    return mapBalance(fa);
  },

  /** Standard Stripe payments balance (for reconciliation), same account context. */
  async getPlatformBalance(): Promise<PlatformBalanceDTO> {
    const balance = await getStripe().balance.retrieve({}, requestOptions());
    const flatten = (rows: Stripe.Balance.Available[] | Stripe.Balance.Pending[] = []) =>
      rows.map((r) => ({ amount: r.amount, currency: r.currency }));
    return {
      available: flatten(balance.available),
      pending: flatten(balance.pending),
    };
  },

  /** Recent Treasury transactions for the pinned financial account. */
  async listTransactions(
    opts: {
      limit?: number;
      starting_after?: string;
    } = {},
  ): Promise<TreasuryTransactionDTO[]> {
    const faId = requireFinancialAccountId();
    const res = await getStripe().treasury.transactions.list(
      {
        financial_account: faId,
        limit: Math.min(Math.max(opts.limit ?? 25, 1), 100),
        ...(opts.starting_after ? { starting_after: opts.starting_after } : {}),
      },
      requestOptions(),
    );
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

  /** Pull money INTO the financial account from a linked external bank account. */
  async deposit(input: DepositInput): Promise<{ id: string; status: string; amount: number }> {
    const faId = requireFinancialAccountId();
    const transfer = await getStripe().treasury.inboundTransfers.create(
      {
        financial_account: faId,
        amount: input.amount,
        currency: input.currency ?? DEFAULT_CURRENCY,
        origin_payment_method: input.originPaymentMethod,
        ...(input.description ? { description: input.description } : {}),
      },
      requestOptions({ idempotencyKey: input.idempotencyKey }),
    );
    return { id: transfer.id, status: transfer.status, amount: transfer.amount };
  },

  /** Pay money OUT of the financial account to an external recipient. */
  async send(input: SendInput): Promise<{ id: string; status: string; amount: number }> {
    const faId = requireFinancialAccountId();
    const payment = await getStripe().treasury.outboundPayments.create(
      {
        financial_account: faId,
        amount: input.amount,
        currency: input.currency ?? DEFAULT_CURRENCY,
        destination_payment_method: input.destinationPaymentMethod,
        ...(input.description ? { description: input.description } : {}),
      },
      requestOptions({ idempotencyKey: input.idempotencyKey }),
    );
    return { id: payment.id, status: payment.status, amount: payment.amount };
  },
};
