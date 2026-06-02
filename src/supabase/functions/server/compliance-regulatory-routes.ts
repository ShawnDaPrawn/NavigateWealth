import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ComplianceService } from './compliance-service.ts';
import { DebarmentCheckSchema } from './compliance-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('compliance');
const service = new ComplianceService();

app.get(
  '/debarment',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const checks = await service.getDebarmentChecks();
    return c.json({ checks });
  }),
);

app.post(
  '/debarment/check',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const parsed = DebarmentCheckSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Performing debarment check', { adminUserId, adviserId: parsed.data.adviserId });

    const check = await service.performDebarmentCheck(
      parsed.data.adviserId,
      parsed.data.name,
      parsed.data.idNumber,
      adminUserId,
    );

    log.success('Debarment check completed', { checkId: check.id });

    return c.json({ check });
  }),
);

app.get(
  '/statutory',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getStatutoryRecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.get(
  '/statutory/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const records = await service.getStatutoryRecords();
    const record = records.find((r: Record<string, unknown>) => r.id === id);
    if (!record) return c.json({ error: 'Record not found' }, 404);
    return c.json(record);
  }),
);

app.post(
  '/statutory',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createStatutoryRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/statutory/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateStatutoryRecord(id, body);
    return c.json(record);
  }),
);

app.post(
  '/statutory/:id/submit',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateStatutoryRecord(id, {
      submitted: true,
      submittedBy: body.submittedBy,
      submittedDate: new Date().toISOString(),
    });
    return c.json(record);
  }),
);

app.get(
  '/paia/requests',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getPAIARequests();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/paia/requests',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createPAIARequest(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/paia/requests/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updatePAIARequest(id, body);
    return c.json(record);
  }),
);

export default app;
