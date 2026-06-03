import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { ComplianceService } from './compliance-service.ts';

const app = new Hono();
const service = new ComplianceService();

// ============================================================================
// AML/FICA (Combined Anti-Money Laundering / FICA)
// §14.2: Static/specific paths registered BEFORE parameterised /:id routes
// ============================================================================

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

// ============================================================================
// STATUTORY RETURNS
// ============================================================================

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

// ============================================================================
// POPIA CONSENTS (specific /popia/consents path)
// ============================================================================

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

// ============================================================================
// PAIA REQUESTS
// ============================================================================

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

// ============================================================================
// RECORD KEEPING
// ============================================================================

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

// ============================================================================
// NEW BUSINESS REGISTER
// ============================================================================

app.get(
  '/new-business',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getNewBusinessRecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/new-business',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createNewBusinessRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/new-business/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateNewBusinessRecord(id, body);
    return c.json(record);
  }),
);

app.get(
  '/new-business/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const clientId = c.req.param('clientId');
    const records = await service.getNewBusinessRecords();
    const filtered = records.filter((r: Record<string, unknown>) => r.clientId === clientId);
    return c.json({ success: true, data: filtered, total: filtered.length });
  }),
);

export default app;
