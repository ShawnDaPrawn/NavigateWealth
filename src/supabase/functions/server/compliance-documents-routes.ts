import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ComplianceService } from './compliance-service.ts';
import { DocumentsInsuranceRecordSchema } from './compliance-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('compliance');
const service = new ComplianceService();

app.get(
  '/documents-insurance',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getDocumentsInsuranceRecords();
    return c.json({
      success: true,
      data: records,
    });
  }),
);

app.post(
  '/documents-insurance',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const parsed = DocumentsInsuranceRecordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Creating documents & insurance record', { adminUserId });

    const record = await service.createDocumentsInsuranceRecord(parsed.data);

    log.success('Documents & insurance record created', { recordId: record.id });

    return c.json(
      {
        success: true,
        data: record,
      },
      201,
    );
  }),
);

app.get(
  '/reports/summary',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const summary = await service.getComplianceSummary();
    return c.json(summary);
  }),
);

app.get(
  '/reports/audit',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const audit = await service.getAuditTrail({ startDate, endDate });

    return c.json({ audit });
  }),
);

app.get(
  '/record-keeping',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getRecordKeepingEntries();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/record-keeping',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createRecordKeepingEntry(body);
    return c.json(record, 201);
  }),
);

app.post(
  '/record-keeping/:id/dispose',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const record = await service.markRecordForDisposal(id);
    return c.json(record);
  }),
);

export default app;
