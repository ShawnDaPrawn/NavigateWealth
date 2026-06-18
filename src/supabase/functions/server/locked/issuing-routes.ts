/**
 * Issuing Routes
 *
 * Locked → Accounts → Manager. Creates and lists Stripe Issuing company
 * cardholders and virtual cards, and reveals a virtual card's PAN + CVC.
 *
 * Every route is SUPER ADMIN only. Card creation and PAN/CVC reveals are
 * written to the admin audit trail. Static routes are registered before
 * parameterised routes (§14.2).
 */

import { Hono, type Context } from 'npm:hono';
import { requireSuperAdmin } from '../auth-mw.ts';
import { asyncHandler } from '../error.middleware.ts';
import { AdminAuditService } from '../admin-audit-service.ts';
import {
  IssuingService,
  toClientError,
  type CardholderInput,
  type CardInput,
  type SpendingLimitInterval,
} from './issuing-service.ts';

const app = new Hono();

const VALID_INTERVALS: SpendingLimitInterval[] = [
  'per_authorization',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'all_time',
];

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
  return AdminAuditService.record({
    actorId: c.get('userId') as string,
    actorRole: c.get('userRole') as string,
    category: 'security',
    action,
    summary,
    severity: options.severity ?? 'info',
    entityType: 'issuing',
    entityId: options.entityId,
    metadata: options.metadata,
  });
}

function fail(c: Context, error: unknown) {
  const { message, status } = toClientError(error);
  return c.json({ error: message }, status as 400 | 404 | 500 | 502);
}

// ============================================================================
// Cardholders
// ============================================================================

app.get(
  '/cardholders',
  asyncHandler(async (c) => {
    try {
      const cardholders = await IssuingService.listCardholders();
      return c.json({ success: true, cardholders });
    } catch (error) {
      return fail(c, error);
    }
  }),
);

app.post(
  '/cardholders',
  asyncHandler(async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return c.json({ error: 'name is required' }, 400);
    }
    const address = (body.billingAddress ?? {}) as Record<string, unknown>;
    const required = ['line1', 'city', 'postalCode', 'country'] as const;
    for (const field of required) {
      if (typeof address[field] !== 'string' || !(address[field] as string).trim()) {
        return c.json({ error: `billingAddress.${field} is required` }, 400);
      }
    }
    const type = body.type === 'individual' ? 'individual' : 'company';
    const input: CardholderInput = {
      name,
      type,
      email: typeof body.email === 'string' ? body.email.trim() || undefined : undefined,
      phoneNumber:
        typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() || undefined : undefined,
      taxId: typeof body.taxId === 'string' ? body.taxId.trim() || undefined : undefined,
      billingAddress: {
        line1: String(address.line1).trim(),
        line2: typeof address.line2 === 'string' ? address.line2.trim() || undefined : undefined,
        city: String(address.city).trim(),
        state: typeof address.state === 'string' ? address.state.trim() || undefined : undefined,
        postalCode: String(address.postalCode).trim(),
        country: String(address.country).trim().toUpperCase(),
      },
    };
    try {
      const cardholder = await IssuingService.createCardholder(input);
      await audit(c, 'issuing_cardholder_created', `Issuing cardholder created (${type})`, {
        severity: 'warning',
        entityId: cardholder.id,
        metadata: { type },
      });
      return c.json({ success: true, cardholder }, 201);
    } catch (error) {
      return fail(c, error);
    }
  }),
);

// ============================================================================
// Cards
// ============================================================================

app.get(
  '/cards',
  asyncHandler(async (c) => {
    try {
      const cards = await IssuingService.listCards();
      return c.json({ success: true, cards });
    } catch (error) {
      return fail(c, error);
    }
  }),
);

app.post(
  '/cards',
  asyncHandler(async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const cardholderId = typeof body.cardholderId === 'string' ? body.cardholderId.trim() : '';
    if (!cardholderId) {
      return c.json({ error: 'cardholderId is required' }, 400);
    }

    // Optional spending limit — both amount and interval must be present together.
    let spendingLimitAmount: number | undefined;
    let spendingLimitInterval: SpendingLimitInterval | undefined;
    if (body.spendingLimitAmount != null || body.spendingLimitInterval != null) {
      const amount = body.spendingLimitAmount;
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return c.json(
          { error: 'spendingLimitAmount must be a positive integer in minor units (cents)' },
          400,
        );
      }
      const interval = body.spendingLimitInterval as SpendingLimitInterval;
      if (!VALID_INTERVALS.includes(interval)) {
        return c.json(
          { error: `spendingLimitInterval must be one of: ${VALID_INTERVALS.join(', ')}` },
          400,
        );
      }
      spendingLimitAmount = amount;
      spendingLimitInterval = interval;
    }

    const input: CardInput = {
      cardholderId,
      currency: typeof body.currency === 'string' ? body.currency : undefined,
      spendingLimitAmount,
      spendingLimitInterval,
    };
    try {
      const card = await IssuingService.createVirtualCard(input);
      await audit(c, 'issuing_card_created', 'Virtual card created', {
        severity: 'warning',
        entityId: card.id,
        metadata: {
          cardholderId,
          currency: card.currency,
          last4: card.last4,
          ...(spendingLimitAmount ? { spendingLimitAmount, spendingLimitInterval } : {}),
        },
      });
      return c.json({ success: true, card }, 201);
    } catch (error) {
      return fail(c, error);
    }
  }),
);

/**
 * POST /cards/:cardId/secrets
 *
 * Reveal the full PAN + CVC for a virtual card. Always audited at critical
 * severity; the numbers themselves are never written to audit metadata.
 */
app.post(
  '/cards/:cardId/secrets',
  asyncHandler(async (c) => {
    const cardId = c.req.param('cardId') ?? '';
    try {
      const secrets = await IssuingService.getCardSecrets(cardId);
      await audit(c, 'issuing_card_secrets_revealed', 'Virtual card number revealed', {
        severity: 'critical',
        entityId: cardId,
        metadata: { last4: secrets.last4 },
      });
      return c.json({ success: true, secrets });
    } catch (error) {
      return fail(c, error);
    }
  }),
);

export default app;
