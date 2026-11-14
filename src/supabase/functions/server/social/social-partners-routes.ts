/**
 * Social & Marketing — partner advertisers (routes).
 *
 *   GET    /social-partners          — list partners
 *   POST   /social-partners          — add a partner
 *   PUT    /social-partners/:id      — edit a partner
 *   DELETE /social-partners/:id      — remove a partner
 *
 * All admin. Referral performance is not tracked here yet.
 */

import { Hono } from 'npm:hono';
import { requireAdmin } from '../auth-mw.ts';
import { asyncHandler } from '../error.middleware.ts';
import { createModuleLogger } from '../stderr-logger.ts';
import { formatZodError } from '../shared-validation-utils.ts';
import {
  CreatePartnerSchema,
  PartnerIdSchema,
  UpdatePartnerSchema,
} from './social-partners-validation.ts';
import {
  PartnerConflictError,
  PartnerNotFoundError,
  createPartner,
  deletePartner,
  listPartners,
  updatePartner,
} from './social-partners-service.ts';

const app = new Hono();
const log = createModuleLogger('social-partners');

function knownError(err: unknown): { status: 404 | 409; message: string } | null {
  if (err instanceof PartnerNotFoundError) return { status: 404, message: err.message };
  if (err instanceof PartnerConflictError) return { status: 409, message: err.message };
  return null;
}

app.get(
  '/',
  requireAdmin,
  asyncHandler(async (c) => {
    const partners = await listPartners();
    return c.json({ success: true, data: partners });
  }),
);

app.post(
  '/',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreatePartnerSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    try {
      const partner = await createPartner(parsed.data, adminUserId);
      log.info('Partner added', { adminUserId, partnerId: partner.id });
      return c.json({ success: true, data: partner }, 201);
    } catch (err) {
      const known = knownError(err);
      if (known) return c.json({ error: known.message }, known.status);
      throw err;
    }
  }),
);

app.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const id = PartnerIdSchema.safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'Invalid partner id' }, 400);
    const raw = await c.req.json().catch(() => ({}));
    const parsed = UpdatePartnerSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    try {
      const partner = await updatePartner(id.data, parsed.data, adminUserId);
      log.info('Partner updated', { adminUserId, partnerId: partner.id });
      return c.json({ success: true, data: partner });
    } catch (err) {
      const known = knownError(err);
      if (known) return c.json({ error: known.message }, known.status);
      throw err;
    }
  }),
);

app.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = PartnerIdSchema.safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'Invalid partner id' }, 400);
    try {
      await deletePartner(id.data);
      log.info('Partner removed', { adminUserId: c.get('userId'), partnerId: id.data });
      return c.json({ success: true });
    } catch (err) {
      const known = knownError(err);
      if (known) return c.json({ error: known.message }, known.status);
      throw err;
    }
  }),
);

export default app;
