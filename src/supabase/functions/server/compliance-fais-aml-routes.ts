import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ComplianceService } from './compliance-service.ts';
import { CreateFAISRecordSchema, AMLCheckSchema } from './compliance-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('compliance');
const service = new ComplianceService();

app.get(
  '/fais',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const records = await service.getFAISRecords();
    return c.json({ records });
  }),
);

app.post(
  '/fais',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const parsed = CreateFAISRecordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Creating FAIS record', { adminUserId });

    const record = await service.createFAISRecord(parsed.data);

    log.success('FAIS record created', { recordId: record.id });

    return c.json({ record }, 201);
  }),
);

app.get(
  '/aml',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const checks = await service.getAMLChecks();
    return c.json({ checks });
  }),
);

app.post(
  '/aml/check',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const parsed = AMLCheckSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Performing AML check', { adminUserId, clientId: parsed.data.clientId });

    const check = await service.performAMLCheck(parsed.data.clientId, adminUserId);

    log.success('AML check completed', { checkId: check.id });

    return c.json({ check });
  }),
);

// §14.2: Static/specific paths registered BEFORE parameterised /:id routes

app.get(
  '/aml-fica',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getAMLFICARecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.get(
  '/aml-fica/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const clientId = c.req.param('clientId');
    const records = await service.getAMLFICARecords();
    const filtered = records.filter((r: Record<string, unknown>) => r.clientId === clientId);
    return c.json({ success: true, data: filtered, total: filtered.length });
  }),
);

app.post(
  '/aml-fica/screen/:clientId',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const clientId = c.req.param('clientId');
    const adminUserId = c.get('userId');
    const record = await service.createAMLFICARecord({
      clientId,
      checkedBy: adminUserId,
      checkType: 'screening',
      checkStatus: 'clear',
      riskLevel: 'low',
    });
    return c.json(record);
  }),
);

app.get(
  '/aml-fica/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const records = await service.getAMLFICARecords();
    const record = records.find((r: Record<string, unknown>) => r.id === id);
    if (!record) return c.json({ error: 'Record not found' }, 404);
    return c.json(record);
  }),
);

app.post(
  '/aml-fica',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createAMLFICARecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/aml-fica/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateAMLFICARecord(id, body);
    return c.json(record);
  }),
);

export default app;
