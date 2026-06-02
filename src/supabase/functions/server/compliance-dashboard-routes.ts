import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ComplianceService } from './compliance-service.ts';

const app = new Hono();
const log = createModuleLogger('compliance');
const service = new ComplianceService();

app.get(
  '/stats',
  requireAuth,
  asyncHandler(async (c) => {
    const summary = await service.getComplianceSummary();
    return c.json({
      success: true,
      data: summary,
    });
  }),
);

app.get(
  '/overview',
  requireAuth,
  asyncHandler(async (c) => {
    const summary = await service.getComplianceSummary();
    return c.json({
      success: true,
      data: summary,
    });
  }),
);

app.get(
  '/deadlines',
  requireAuth,
  asyncHandler(async (c) => {
    const days = c.req.query('days') || '30';
    const daysInt = parseInt(days, 10);
    const cutoff = new Date(Date.now() + 86400000 * daysInt);

    const records = await service.getFAISRecords();

    const deadlines = records
      .filter((r) => r.license_valid_until)
      .map((r) => ({
        id: r.id,
        title: `License Renewal: ${r.fsp_name}`,
        dueDate: r.license_valid_until,
        type: 'license_renewal',
        status: 'pending',
      }))
      .concat([
        {
          id: 'generic-1',
          title: 'Quarterly Compliance Report',
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          type: 'reporting',
          status: 'pending',
        },
        {
          id: 'generic-2',
          title: 'Staff Training Review',
          dueDate: new Date(Date.now() + 86400000 * 15).toISOString(),
          type: 'training',
          status: 'pending',
        },
      ])
      .filter((d) => new Date(d.dueDate) <= cutoff);

    return c.json({
      success: true,
      data: deadlines,
    });
  }),
);

app.get(
  '/activities',
  requireAuth,
  asyncHandler(async (c) => {
    const limit = c.req.query('limit') || '20';

    const audit = await service.getAuditTrail();
    const activities = audit.slice(0, parseInt(limit));

    return c.json({
      success: true,
      data: activities,
    });
  }),
);

app.post(
  '/refresh',
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    log.info('Refreshing all compliance checks');
    const summary = await service.getComplianceSummary();
    return c.json({ success: true, message: 'Compliance data refreshed', data: summary });
  }),
);

export default app;
