/**
 * Issuing Service
 *
 * Stripe Issuing integration for the Locked → Accounts → Manager panel.
 * Creates company cardholders and virtual cards, lists them, and (for virtual
 * cards, live mode only) reveals the full card number + CVC.
 *
 * Talks to the Stripe REST API directly with `fetch` (no npm SDK) so it stays
 * Deno-native and free of Node type dependencies.
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - The Stripe secret key is read from the environment and NEVER leaves the
 *     server. No Stripe key is ever sent to the client.
 *   - When STRIPE_CONNECTED_ACCOUNT_ID is set, every call is scoped to it via
 *     the Stripe-Account header; otherwise it operates on the key's own account
 *     (here, Tokensoft).
 *   - Full PAN + CVC are only fetched on the explicit, audited reveal read.
 *   - When STRIPE_FINANCIAL_ACCOUNT_ID is set, new cards are backed by that
 *     Treasury financial account so spend draws from its balance.
 *
 * @module server/locked/issuing-service
 */

/** Cards are issued in USD by default. */
export const DEFAULT_CURRENCY = 'usd';

const STRIPE_BASE = 'https://api.stripe.com/v1';

// ============================================================================
// Errors
// ============================================================================

export class IssuingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'IssuingError';
  }
}

export function toClientError(error: unknown): { message: string; status: number } {
  if (error instanceof IssuingError) {
    return { message: error.message, status: error.status };
  }
  return { message: (error as Error)?.message ?? 'Unexpected error', status: 500 };
}

// ============================================================================
// Stripe REST helper (fetch-based)
// ============================================================================

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

async function stripeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { query?: Record<string, unknown>; body?: Record<string, unknown> } = {},
): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) {
    throw new IssuingError('Stripe is not configured (STRIPE_SECRET_KEY missing)', 500);
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  const connectedAccount = Deno.env.get('STRIPE_CONNECTED_ACCOUNT_ID');
  if (connectedAccount) headers['Stripe-Account'] = connectedAccount;

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
    throw new IssuingError(message, status);
  }
  return json as T;
}

// ============================================================================
// Raw Stripe response shapes (only the fields we read)
// ============================================================================

interface RawCardholder {
  id: string;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  type: string;
  status: string;
  created: number;
}

interface RawCard {
  id: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  status: string;
  currency: string;
  cardholder: string | RawCardholder;
  number?: string | null;
  cvc?: string | null;
  created: number;
}

interface RawList<T> {
  data: T[];
}

// ============================================================================
// DTOs
// ============================================================================

export type CardholderType = 'company' | 'individual';
export type SpendingLimitInterval =
  | 'per_authorization'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'all_time';

export interface BillingAddressInput {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface CardholderInput {
  name: string;
  email?: string;
  phoneNumber?: string;
  type?: CardholderType;
  taxId?: string;
  billingAddress: BillingAddressInput;
}

export interface CardInput {
  cardholderId: string;
  currency?: string;
  spendingLimitAmount?: number;
  spendingLimitInterval?: SpendingLimitInterval;
}

export interface CardholderDTO {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  type: string;
  status: string;
  created: number;
}

export interface CardDTO {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: string;
  currency: string;
  cardholderId: string;
  cardholderName: string | null;
  created: number;
}

export interface CardSecretsDTO {
  number: string;
  cvc: string;
  expMonth: number;
  expYear: number;
  last4: string;
}

// ============================================================================
// Mapping helpers
// ============================================================================

function mapCardholder(ch: RawCardholder): CardholderDTO {
  return {
    id: ch.id,
    name: ch.name,
    email: ch.email ?? null,
    phoneNumber: ch.phone_number ?? null,
    type: ch.type,
    status: ch.status,
    created: ch.created,
  };
}

function mapCard(card: RawCard): CardDTO {
  const ch = card.cardholder;
  return {
    id: card.id,
    last4: card.last4,
    brand: card.brand,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    status: card.status,
    currency: card.currency,
    cardholderId: typeof ch === 'string' ? ch : ch.id,
    cardholderName: typeof ch === 'string' ? null : ch.name,
    created: card.created,
  };
}

// ============================================================================
// Service
// ============================================================================

export const IssuingService = {
  async listCardholders(): Promise<CardholderDTO[]> {
    const res = await stripeRequest<RawList<RawCardholder>>('GET', '/issuing/cardholders', {
      query: { limit: 100 },
    });
    return res.data.map(mapCardholder);
  },

  async createCardholder(input: CardholderInput): Promise<CardholderDTO> {
    const a = input.billingAddress;
    const ch = await stripeRequest<RawCardholder>('POST', '/issuing/cardholders', {
      body: {
        name: input.name,
        type: input.type ?? 'company',
        status: 'active',
        ...(input.email ? { email: input.email } : {}),
        ...(input.phoneNumber ? { phone_number: input.phoneNumber } : {}),
        ...(input.taxId ? { company: { tax_id: input.taxId } } : {}),
        billing: {
          address: {
            line1: a.line1,
            ...(a.line2 ? { line2: a.line2 } : {}),
            city: a.city,
            ...(a.state ? { state: a.state } : {}),
            postal_code: a.postalCode,
            country: a.country,
          },
        },
      },
    });
    return mapCardholder(ch);
  },

  async listCards(): Promise<CardDTO[]> {
    const res = await stripeRequest<RawList<RawCard>>('GET', '/issuing/cards', {
      query: { limit: 100, expand: ['data.cardholder'] },
    });
    return res.data.map(mapCard);
  },

  /** Create an active virtual card, optionally backed by the Treasury account. */
  async createVirtualCard(input: CardInput): Promise<CardDTO> {
    const financialAccount = Deno.env.get('STRIPE_FINANCIAL_ACCOUNT_ID');
    const spendingControls =
      input.spendingLimitAmount && input.spendingLimitInterval
        ? {
            spending_controls: {
              spending_limits: [
                { amount: input.spendingLimitAmount, interval: input.spendingLimitInterval },
              ],
            },
          }
        : {};
    const card = await stripeRequest<RawCard>('POST', '/issuing/cards', {
      body: {
        cardholder: input.cardholderId,
        currency: input.currency ?? DEFAULT_CURRENCY,
        type: 'virtual',
        status: 'active',
        ...(financialAccount ? { financial_account: financialAccount } : {}),
        ...spendingControls,
        expand: ['cardholder'],
      },
    });
    return mapCard(card);
  },

  /**
   * Reveal the full PAN + CVC for a virtual card. Virtual + live mode only;
   * callers MUST audit this read.
   */
  async getCardSecrets(cardId: string): Promise<CardSecretsDTO> {
    const card = await stripeRequest<RawCard>('GET', `/issuing/cards/${cardId}`, {
      query: { expand: ['number', 'cvc'] },
    });
    if (!card.number || !card.cvc) {
      throw new IssuingError(
        'Card number is unavailable (only virtual cards in live mode can be revealed via the API)',
        400,
      );
    }
    return {
      number: card.number,
      cvc: card.cvc,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      last4: card.last4,
    };
  },
};
