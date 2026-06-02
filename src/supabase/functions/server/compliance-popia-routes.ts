import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ComplianceService } from './compliance-service.ts';
import { POPIAConsentSchema } from './compliance-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('compliance');
const service = new ComplianceService();

app.get(
  '/popia',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const consents = await service.getPOPIAConsents();
    return c.json({ consents });
  }),
);

app.post(
  '/popia/consent',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const parsed = POPIAConsentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Recording POPIA consent', { userId });

    const consent = await service.recordPOPIAConsent(userId, parsed.data);

    return c.json({ consent });
  }),
);

app.post(
  '/popia/withdraw',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');

    log.info('Withdrawing POPIA consent', { userId });

    const result = await service.withdrawPOPIAConsent(userId);

    return c.json(result);
  }),
);

app.get(
  '/popia/consents',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getPOPIAConsentRecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/popia/consents',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createPOPIAConsentRecord(body);
    return c.json(record, 201);
  }),
);

app.post(
  '/popia/consents/:id/withdraw',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const record = await service.withdrawPOPIAConsentRecord(id);
    return c.json(record);
  }),
);

app.get(
  '/popia/consents/user/:userId',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.req.param('userId');
    const records = await service.getPOPIAConsentRecords();
    const filtered = records.filter(
      (r: Record<string, unknown>) => r.userId === userId || r.user_id === userId,
    );
    return c.json({ success: true, data: filtered, total: filtered.length });
  }),
);

export default app;
