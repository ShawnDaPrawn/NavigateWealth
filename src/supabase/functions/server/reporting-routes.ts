/**
 * Reporting Module - Routes
 * Fresh file moved to root to fix bundling issues
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ReportingService } from './reporting-service.ts';
import { generateClientOverviewPDF, type ClientOverviewReportData } from './client-overview-pdf-service.ts';

const app = new Hono();
const log = createModuleLogger('reporting');
const service = new ReportingService();

// Root handlers
app.get('/', (c) => c.json({ service: 'reporting', status: 'active' }));

/**
 * GET /reporting/dashboard
 * Get high-level reporting dashboard stats
 */
app.get('/dashboard', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const stats = await service.getDashboardReport();
  return c.json(stats);
}));

/**
 * GET /reporting/clients
 * Get client-related reporting
 */
app.get('/clients', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const data = await service.getClientDemographicsReport();
  return c.json(data);
}));

/**
 * GET /reporting/clients/personal-list
 * Export all personal client profiles as flat JSON rows for spreadsheet download
 */
app.get('/clients/personal-list', requireAuth, requireAdmin, asyncHandler(async (c) => {
  log.info('Generating personal clients export');
  const rows = await service.getPersonalClientsExport();
  return c.json({ rows, count: rows.length, generatedAt: new Date().toISOString() });
}));

/**
 * GET /reporting/clients/applications-pipeline
 * Export all applications as flat JSON rows for spreadsheet download
 */
app.get('/clients/applications-pipeline', requireAuth, requireAdmin, asyncHandler(async (c) => {
  log.info('Generating applications pipeline export');
  const startDate = c.req.query('startDate') || undefined;
  const endDate = c.req.query('endDate') || undefined;
  const dateRange = (startDate || endDate) ? { startDate, endDate } : undefined;
  const rows = await service.getApplicationsPipelineExport(dateRange);
  return c.json({ rows, count: rows.length, generatedAt: new Date().toISOString() });
}));

/**
 * GET /reporting/clients/fna-completion
 * Export all FNAs as flat JSON rows for spreadsheet download
 */
app.get('/clients/fna-completion', requireAuth, requireAdmin, asyncHandler(async (c) => {
  log.info('Generating FNA completion export');
  const startDate = c.req.query('startDate') || undefined;
  const endDate = c.req.query('endDate') || undefined;
  const dateRange = (startDate || endDate) ? { startDate, endDate } : undefined;
  const rows = await service.getFNACompletionExport(dateRange);
  return c.json({ rows, count: rows.length, generatedAt: new Date().toISOString() });
}));

/**
 * GET /reporting/clients/compliance-audit
 * Export POPIA/FAIS compliance audit as flat JSON rows for spreadsheet download
 */
app.get('/clients/compliance-audit', requireAuth, requireAdmin, asyncHandler(async (c) => {
  log.info('Generating POPIA/FAIS compliance audit export');
  const rows = await service.getComplianceAuditExport();
  return c.json({ rows, count: rows.length, generatedAt: new Date().toISOString() });
}));

/**
 * GET /reporting/clients/lifecycle-audit
 * Export client lifecycle audit as flat JSON rows for spreadsheet download.
 * Cross-references profile and security KV entries to surface inconsistencies.
 */
app.get('/clients/lifecycle-audit', requireAuth, requireAdmin, asyncHandler(async (c) => {
  log.info('Generating client lifecycle audit export');
  const rows = await service.getClientLifecycleAuditExport();
  return c.json({ rows, count: rows.length, generatedAt: new Date().toISOString() });
}));

/**
 * POST /reporting/client-overview-pdf
 * Generate a branded PDF report for a single client's overview.
 * Accepts pre-computed report data and returns a PDF binary.
 */
app.post('/client-overview-pdf', requireAuth, requireAdmin, asyncHandler(async (c) => {
  log.info('Generating client overview PDF');
  const body = await c.req.json<ClientOverviewReportData>();

  if (!body?.client?.firstName || !body?.client?.lastName) {
    return c.json({ success: false, error: 'Missing required client data' }, 400);
  }

  const pdfBytes = await generateClientOverviewPDF(body);

  const fileName = `Navigate_Wealth_Report_${body.client.lastName}_${body.client.firstName}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    },
  });
}));

export default app;