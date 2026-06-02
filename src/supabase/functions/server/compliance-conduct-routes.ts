import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { ComplianceService } from './compliance-service.ts';

const app = new Hono();
const service = new ComplianceService();

// ---- New Business Register ----

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

// ---- Complaints ----

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
    const id = c.req.param('id');
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
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateComplaint(id, body);
    return c.json(record);
  }),
);

app.post(
  '/compliance/complaints/:id/resolve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const { resolution, outcome } = await c.req.json();
    const record = await service.resolveComplaint(id, resolution, outcome);
    return c.json(record);
  }),
);

app.post(
  '/compliance/complaints/:id/escalate',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const { escalatedTo } = await c.req.json();
    const record = await service.escalateComplaint(id, escalatedTo);
    return c.json(record);
  }),
);

// ---- Marketing Compliance ----

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
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createMarketingRecord(body);
    return c.json(record, 201);
  }),
);

app.post(
  '/marketing/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const { approvedBy } = await c.req.json();
    const record = await service.approveMarketingRecord(id, approvedBy);
    return c.json(record);
  }),
);

// ---- Conflicts of Interest ----

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
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createConflictRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/conflicts/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateConflictRecord(id, body);
    return c.json(record);
  }),
);

// ---- TCF (Treating Customers Fairly) ----

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
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createTCFRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/tcf/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateTCFRecord(id, body);
    return c.json(record);
  }),
);

// ---- Supervision ----

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
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const record = await service.createSupervisionRecord(body);
    return c.json(record, 201);
  }),
);

app.put(
  '/supervision/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const record = await service.updateSupervisionRecord(id, body);
    return c.json(record);
  }),
);

export default app;
