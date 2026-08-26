import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ComplianceService } from './compliance-service.ts';

const app = new Hono();
const log = createModuleLogger('compliance-governance');
const service = new ComplianceService();

// ============================================================================
// COMPLAINTS
// ============================================================================

app.get(
  '/complaints',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getComplaints();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.get(
  '/complaints/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const record = await service.getComplaintById(id);
    if (!record) return c.json({ error: 'Complaint not found' }, 404);
    return c.json(record);
  }),
);

app.post(
  '/complaints',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createComplaint(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/compliance/complaints/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const record = await service.updateComplaint(id, body);
    return c.json(record);
  }),
);

app.post(
  '/compliance/complaints/:id/resolve',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const { resolution, outcome } = await c.req.json();
    const record = await service.resolveComplaint(id, resolution, outcome);
    return c.json(record);
  }),
);

app.post(
  '/compliance/complaints/:id/escalate',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const { escalatedTo } = await c.req.json();
    const record = await service.escalateComplaint(id, escalatedTo);
    return c.json(record);
  }),
);

// ============================================================================
// MARKETING COMPLIANCE
// ============================================================================

app.get(
  '/marketing',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getMarketingRecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/marketing',
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createMarketingRecord(body);
    return c.json(record, 201);
  }),
);

app.post(
  '/marketing/:id/approve',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const { approvedBy } = await c.req.json();
    const record = await service.approveMarketingRecord(id, approvedBy);
    return c.json(record);
  }),
);

// ============================================================================
// CONFLICTS OF INTEREST
// ============================================================================

app.get(
  '/conflicts',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getConflictRecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/conflicts',
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createConflictRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/conflicts/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const record = await service.updateConflictRecord(id, body);
    return c.json(record);
  }),
);

// ============================================================================
// TCF (Treating Customers Fairly)
// ============================================================================

app.get(
  '/tcf',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getTCFRecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/tcf',
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createTCFRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/tcf/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const record = await service.updateTCFRecord(id, body);
    return c.json(record);
  }),
);

// ============================================================================
// SUPERVISION
// ============================================================================

app.get(
  '/supervision',
  requireAuth,
  asyncHandler(async (c) => {
    const records = await service.getSupervisionRecords();
    return c.json({ success: true, data: records, total: records.length });
  }),
);

app.post(
  '/supervision',
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createSupervisionRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/supervision/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const record = await service.updateSupervisionRecord(id, body);
    return c.json(record);
  }),
);

// ============================================================================
// REFRESH ALL
// ============================================================================

app.post(
  '/refresh',
  requireAdmin,
  asyncHandler(async (c) => {
    log.info('Refreshing all compliance checks');
    const summary = await service.getComplianceSummary();
    return c.json({ success: true, message: 'Compliance data refreshed', data: summary });
  }),
);

export default app;
