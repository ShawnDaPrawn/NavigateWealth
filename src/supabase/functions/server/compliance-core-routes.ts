import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ComplianceService } from './compliance-service.ts';
import {
  CreateFAISRecordSchema,
  AMLCheckSchema,
  POPIAConsentSchema,
  DebarmentCheckSchema,
  DocumentsInsuranceRecordSchema,
} from './compliance-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import type { FAISRecord, POPIAConsent, DocumentsInsuranceRecord } from './compliance-types.ts';

const app = new Hono();
const log = createModuleLogger('compliance-core');
const service = new ComplianceService();

// ============================================================================
// DASHBOARD & OVERVIEW
// ============================================================================

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

// ============================================================================
// FAIS COMPLIANCE
// ============================================================================

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
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = CreateFAISRecordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Creating FAIS record', { adminUserId });

    const record = await service.createFAISRecord(parsed.data as Partial<FAISRecord>);

    log.success('FAIS record created', { recordId: record.id });

    return c.json({ record }, 201);
  }),
);

// ============================================================================
// AML (ANTI-MONEY LAUNDERING)
// ============================================================================

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
    const adminUserId = c.get('userId') as string;
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

// ============================================================================
// POPIA (PRIVACY)
// ============================================================================

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
    const userId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = POPIAConsentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Recording POPIA consent', { userId });

    const consent = await service.recordPOPIAConsent(userId, parsed.data as Partial<POPIAConsent>);

    return c.json({ consent });
  }),
);

app.post(
  '/popia/withdraw',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;

    log.info('Withdrawing POPIA consent', { userId });

    const result = await service.withdrawPOPIAConsent(userId);

    return c.json(result);
  }),
);

// ============================================================================
// DEBARMENT CHECKS
// ============================================================================

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
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = DebarmentCheckSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Performing debarment check', { adminUserId, adviserId: parsed.data.adviserId });

    const check = await service.performDebarmentCheck(
      parsed.data.adviserId,
      parsed.data.name,
      parsed.data.idNumber ?? '',
      adminUserId,
    );

    log.success('Debarment check completed', { checkId: check.id });

    return c.json({ check });
  }),
);

// ============================================================================
// DOCUMENTS & INSURANCE
// ============================================================================

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
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = DocumentsInsuranceRecordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Creating documents & insurance record', { adminUserId });

    const record = await service.createDocumentsInsuranceRecord(
      parsed.data as Partial<DocumentsInsuranceRecord>,
    );

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

// ============================================================================
// COMPLIANCE REPORTS
// ============================================================================

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

export default app;
