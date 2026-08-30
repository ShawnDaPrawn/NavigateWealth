/**
 * Treasury Routes
 *
 * Locked → Accounts → Manager. Surfaces a Stripe Treasury financial account's
 * real balance and bank (ABA) details, the standard Stripe payments balance
 * (for reconciliation), recent transactions, and money movement:
 *   - Deposit → InboundTransfer  (pull money in)
 *   - Send    → OutboundPayment  (pay money out)
 *
 * Every route is SUPER ADMIN only. Viewing full bank details and every money
 * movement is written to the admin audit trail. Static routes are registered
 * before parameterised routes (§14.2).
 */

import { Hono, type Context } from 'npm:hono';
import { requireSuperAdmin } from '../auth-mw.ts';
import { asyncHandler } from '../error.middleware.ts';
import { AdminAuditService } from '../admin-audit-service.ts';
import {
  TreasuryService,
  toClientError,
  type DepositInput,
  type SendInput,
} from './treasury-service.ts';

const app = new Hono();

/** Hard ceiling on a single money movement (minor units) — defence in depth. */
const MAX_AMOUNT_MINOR = 100_000_00; // $100,000.00

// Every route in this module is super-admin only.
app.use('*', requireSuperAdmin);

function audit(
  c: Context,
  action: string,
  summary: string,
  options: {
    severity?: 'info' | 'warning' | 'critical';
    entityId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  // Awaited at every call site so the isolate cannot suspend before the audit
  // entry is persisted. AdminAuditService.record never throws.
  return AdminAuditService.record({
    actorId: c.get('userId') as string,
    actorRole: c.get('userRole') as string,
    category: 'security',
    action,
    summary,
    severity: options.severity ?? 'info',
    entityType: 'treasury',
    entityId: options.entityId,
    metadata: options.metadata,
  });
}

function fail(c: Context, error: unknown) {
  const { message, status } = toClientError(error);
  return c.json({ error: message }, status as 400 | 404 | 500 | 502);
}

/**
 * Validate a money-movement body. Returns the parsed input or an error string.
 * Amounts are integer minor units (cents); we never accept floats.
 */
function parseMovement(
  body: Record<string, unknown>,
  paymentMethodField: 'originPaymentMethod' | 'destinationPaymentMethod',
):
  | {
      input: {
        amount: number;
        currency?: string;
        description?: string;
        paymentMethod: string;
        customer?: string;
        idempotencyKey: string;
      };
    }
  | { error: string } {
  const amount = body.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return { error: 'amount must be a positive integer in minor units (cents)' };
  }
  if (amount > MAX_AMOUNT_MINOR) {
    return { error: `amount exceeds the maximum of ${MAX_AMOUNT_MINOR} minor units` };
  }
  const paymentMethod = body[paymentMethodField];
  if (typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
    return { error: `${paymentMethodField} is required` };
  }
  const idempotencyKey = body.idempotencyKey;
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return { error: 'idempotencyKey is required' };
  }
  const currency = typeof body.currency === 'string' ? body.currency : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;
  const customer =
    typeof body.customer === 'string' && body.customer.trim() ? body.customer.trim() : undefined;
  return {
    input: {
      amount,
      currency,
      description,
      paymentMethod: paymentMethod.trim(),
      customer,
      idempotencyKey: idempotencyKey.trim(),
    },
  };
}

// ============================================================================
// Reads
// ============================================================================

/**
 * GET /financial-account
 *
 * Full financial account including the REAL ABA routing + account numbers.
 * Audited at warning severity (viewing full bank credentials is sensitive);
 * the numbers themselves are never written to the audit metadata.
 */
app.get(
  '/financial-account',
  asyncHandler(async (c) => {
    try {
      const account = await TreasuryService.getFinancialAccount(true);
      await audit(c, 'treasury_bank_details_viewed', 'Treasury bank details viewed', {
        severity: 'warning',
        entityId: account.id,
        // bankDetailsCount lets ops spot a silently-degraded reveal read from
        // the audit trail alone (0 while the FA is open = the list call failed).
        metadata: { status: account.status, bankDetailsCount: account.bankDetails.length },
      });
      return c.json({ success: true, account });
    } catch (error) {
      return fail(c, error);
    }
  }),
);

app.get(
  '/balance',
  asyncHandler(async (c) => {
    try {
      const balance = await TreasuryService.getBalance();
      return c.json({ success: true, balance });
    } catch (error) {
      return fail(c, error);
    }
  }),
);

app.get(
  '/platform-balance',
  asyncHandler(async (c) => {
    try {
      const balance = await TreasuryService.getPlatformBalance();
      return c.json({ success: true, balance });
    } catch (error) {
      return fail(c, error);
    }
  }),
);

app.get(
  '/transactions',
  asyncHandler(async (c) => {
    try {
      const limit = Number(c.req.query('limit') ?? '25');
      const transactions = await TreasuryService.listTransactions({
        limit: Number.isFinite(limit) ? limit : 25,
      });
      return c.json({ success: true, transactions });
    } catch (error) {
      return fail(c, error);
    }
  }),
);

// ============================================================================
// Money movement
// ============================================================================

/** POST /deposit — pull money IN (InboundTransfer). Audited at critical severity. */
app.post(
  '/deposit',
  asyncHandler(async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseMovement(body, 'originPaymentMethod');
    if ('error' in parsed) {
      return c.json({ error: parsed.error }, 400);
    }
    const input: DepositInput = {
      amount: parsed.input.amount,
      currency: parsed.input.currency,
      description: parsed.input.description,
      originPaymentMethod: parsed.input.paymentMethod,
      idempotencyKey: parsed.input.idempotencyKey,
    };
    try {
      const transfer = await TreasuryService.deposit(input);
      await audit(c, 'treasury_deposit_initiated', 'Treasury deposit initiated', {
        severity: 'critical',
        entityId: transfer.id,
        metadata: {
          amount: transfer.amount,
          currency: input.currency ?? 'usd',
          status: transfer.status,
          idempotencyKey: input.idempotencyKey,
        },
      });
      return c.json({ success: true, transfer }, 201);
    } catch (error) {
      return fail(c, error);
    }
  }),
);

/** POST /send — pay money OUT (OutboundPayment). Audited at critical severity. */
app.post(
  '/send',
  asyncHandler(async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseMovement(body, 'destinationPaymentMethod');
    if ('error' in parsed) {
      return c.json({ error: parsed.error }, 400);
    }
    const input: SendInput = {
      amount: parsed.input.amount,
      currency: parsed.input.currency,
      description: parsed.input.description,
      destinationPaymentMethod: parsed.input.paymentMethod,
      customer: parsed.input.customer,
      idempotencyKey: parsed.input.idempotencyKey,
    };
    try {
      const payment = await TreasuryService.send(input);
      await audit(c, 'treasury_send_initiated', 'Treasury payment sent', {
        severity: 'critical',
        entityId: payment.id,
        metadata: {
          amount: payment.amount,
          currency: input.currency ?? 'usd',
          status: payment.status,
          idempotencyKey: input.idempotencyKey,
        },
      });
      return c.json({ success: true, payment }, 201);
    } catch (error) {
      return fail(c, error);
    }
  }),
);

export default app;
